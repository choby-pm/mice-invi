// 🔒 민감정보 자동 테스트 (04 §2.4 / 08 §5.3 위험 영역 3번).
// 확인할 3가지: 암호화 저장, 열람 기록 없는 조회 불가, 파기 후 잔존 없음 (03 B10).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { bootstrapTenant } from "@/server/modules/org/bootstrap-tenant";

const admin = createAdminClient();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

async function createSignedInUser(tag: string) {
  const email = `r2-sens-${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const password = "Test-password-123!";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const client = createSupabaseClient(url, publishableKey);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { userId: data.user.id, client };
}

describe("🔒 민감정보 (암호화·접근 기록·파기)", () => {
  let tenantA: { id: string }, tenantB: { id: string };
  let pcoA: Awaited<ReturnType<typeof createSignedInUser>>;
  let pcoB: Awaited<ReturnType<typeof createSignedInUser>>;
  let eventA: { id: string };
  let delegationA: { id: string };
  let participantA: { id: string };

  beforeAll(async () => {
    pcoA = await createSignedInUser("pco-a");
    pcoB = await createSignedInUser("pco-b");
    tenantA = await bootstrapTenant("민감정보 테스트 PCO A", pcoA.userId);
    tenantB = await bootstrapTenant("민감정보 테스트 PCO B", pcoB.userId);

    const { data: ev } = await pcoA.client.from("event").insert({ tenant_id: tenantA.id, name: "민감정보 테스트 행사" }).select().single();
    eventA = ev;
    const { data: del } = await pcoA.client
      .from("delegation")
      .insert({ tenant_id: tenantA.id, event_id: eventA.id, name: "테스트 대표단", country: "VN", organization: "x" })
      .select()
      .single();
    delegationA = del;
    const { data: p } = await pcoA.client
      .from("participant")
      .insert({ tenant_id: tenantA.id, delegation_id: delegationA.id, participant_type: "VIP", last_name: "Nguyen", first_name: "A", nationality: "VN" })
      .select()
      .single();
    participantA = p;
  });

  afterAll(async () => {
    if (delegationA?.id) await admin.from("service_item").delete().eq("delegation_id", delegationA.id);
    if (tenantA?.id) {
      await admin.from("delegation").delete().eq("tenant_id", tenantA.id);
      await admin.from("event").delete().eq("tenant_id", tenantA.id);
    }
    if (tenantA?.id) await admin.from("tenant").delete().eq("id", tenantA.id);
    if (tenantB?.id) await admin.from("tenant").delete().eq("id", tenantB.id);
    if (pcoA?.userId) await admin.auth.admin.deleteUser(pcoA.userId);
    if (pcoB?.userId) await admin.auth.admin.deleteUser(pcoB.userId);
  });

  it("저장은 암호화되어 있다 (원문이 테이블에 그대로 없음)", async () => {
    const { error } = await pcoA.client.rpc("write_participant_sensitive", {
      p_participant_id: participantA.id,
      p_passport_no: "M12345678",
      p_religion: "Buddhism",
    });
    expect(error).toBeNull();

    const { data: raw } = await admin.from("participant_sensitive").select("passport_no, religion").eq("participant_id", participantA.id).single();
    expect(raw?.passport_no).not.toBeNull();
    // bytea가 base64/hex로 오더라도 평문 "M12345678"이 그대로 보이면 안 됨
    expect(JSON.stringify(raw?.passport_no)).not.toContain("M12345678");
    expect(JSON.stringify(raw?.religion)).not.toContain("Buddhism");
  });

  it("직접 테이블 조회로는 아무것도 못 본다 (RLS에 select 정책이 없음)", async () => {
    const { data, error } = await pcoA.client.from("participant_sensitive").select("*").eq("participant_id", participantA.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("정식 함수로 조회하면 원문이 복호화되어 나온다", async () => {
    const { data, error } = await pcoA.client.rpc("read_participant_sensitive", { p_participant_id: participantA.id });
    expect(error).toBeNull();
    const row = data?.[0];
    expect(row?.passport_no).toBe("M12345678");
    expect(row?.religion).toBe("Buddhism");
  });

  it("조회할 때마다 접근 기록이 남는다", async () => {
    const { count: before } = await admin
      .from("sensitive_access_log")
      .select("id", { count: "exact", head: true })
      .eq("participant_id", participantA.id);

    await pcoA.client.rpc("read_participant_sensitive", { p_participant_id: participantA.id });

    const { count: after } = await admin
      .from("sensitive_access_log")
      .select("id", { count: "exact", head: true })
      .eq("participant_id", participantA.id);
    expect((after ?? 0)).toBeGreaterThan(before ?? 0);
  });

  it("다른 테넌트 PCO는 조회·기록 조회 모두 거부된다", async () => {
    const { data, error } = await pcoB.client.rpc("read_participant_sensitive", { p_participant_id: participantA.id });
    expect(data).toBeNull();
    expect(error).not.toBeNull();

    const { error: writeErr } = await pcoB.client.rpc("write_participant_sensitive", {
      p_participant_id: participantA.id,
      p_passport_no: "다른회사가몰래쓰면안됨",
    });
    expect(writeErr).not.toBeNull();
  });

  it("행사를 파기하면 값도 지워지고 다시 조회해도 아무것도 안 나온다", async () => {
    const { error: purgeErr } = await pcoA.client.rpc("purge_event_sensitive_data", { p_event_id: eventA.id });
    expect(purgeErr).toBeNull();

    const { data } = await pcoA.client.rpc("read_participant_sensitive", { p_participant_id: participantA.id });
    expect(data).toEqual([]);

    const { data: keyRow } = await admin.from("event_encryption_key").select("event_id").eq("event_id", eventA.id);
    expect(keyRow).toEqual([]); // 키 자체가 폐기됨 — 백업에 암호문이 남아도 복구 불가
  });
});
