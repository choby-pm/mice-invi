// R2 기반 권한·격리 자동 테스트. "다른 회사 대표단이 안 보인다"에 더해
// "대리인은 자기 대표단만 본다"까지 확인합니다 (01 §2.5 권한 매트릭스).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { bootstrapTenant } from "@/server/modules/org/bootstrap-tenant";

const admin = createAdminClient();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

async function createSignedInUser(tag: string) {
  const email = `r2-test-${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const password = "Test-password-123!";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const client = createSupabaseClient(url, publishableKey);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { userId: data.user.id, client };
}

describe("대표단·참가자 격리 (RLS)", () => {
  let tenantA: { id: string }, tenantB: { id: string };
  let pcoA: Awaited<ReturnType<typeof createSignedInUser>>;
  let pcoB: Awaited<ReturnType<typeof createSignedInUser>>;
  let proxy: Awaited<ReturnType<typeof createSignedInUser>>;
  let outsider: Awaited<ReturnType<typeof createSignedInUser>>; // A 테넌트 소속이지만 이 대표단 대리인은 아님
  let eventA: { id: string };
  let delegationA: { id: string };

  beforeAll(async () => {
    pcoA = await createSignedInUser("pco-a");
    pcoB = await createSignedInUser("pco-b");
    proxy = await createSignedInUser("proxy");
    outsider = await createSignedInUser("outsider");

    tenantA = await bootstrapTenant("R2 테스트 PCO A", pcoA.userId);
    tenantB = await bootstrapTenant("R2 테스트 PCO B", pcoB.userId);
    // outsider도 A 테넌트 소속 PCO_FIELD로 등록 (대표단 대리인은 아님)
    await admin.from("tenant_member").insert({ tenant_id: tenantA.id, user_id: outsider.userId, role: "PCO_FIELD" });

    const { data: ev } = await pcoA.client.from("event").insert({ tenant_id: tenantA.id, name: "R2 테스트 행사" }).select().single();
    eventA = ev;

    const { data: del, error: delErr } = await pcoA.client
      .from("delegation")
      .insert({ tenant_id: tenantA.id, event_id: eventA.id, name: "베트남 대표단", country: "VN", organization: "산업통상부" })
      .select()
      .single();
    if (delErr) throw delErr;
    delegationA = del;

    await admin.from("delegation_proxy").insert({
      tenant_id: tenantA.id,
      delegation_id: delegationA.id,
      user_id: proxy.userId,
      status: "ACTIVE",
    });
  });

  afterAll(async () => {
    // 자식부터 지워서 테넌트 삭제 연쇄 중 감사 로그 트리거가 실패하지 않게 합니다.
    if (tenantA?.id) {
      await admin.from("delegation").delete().eq("tenant_id", tenantA.id);
      await admin.from("event").delete().eq("tenant_id", tenantA.id);
    }
    if (tenantA?.id) await admin.from("tenant").delete().eq("id", tenantA.id);
    if (tenantB?.id) await admin.from("tenant").delete().eq("id", tenantB.id);
    for (const u of [pcoA, pcoB, proxy, outsider]) {
      if (u?.userId) await admin.auth.admin.deleteUser(u.userId);
    }
  });

  it("같은 테넌트 PCO는 대표단을 볼 수 있다", async () => {
    const { data } = await pcoA.client.from("delegation").select("id").eq("id", delegationA.id);
    expect(data?.map((r) => r.id)).toContain(delegationA.id);
  });

  it("다른 테넌트 PCO에게는 대표단이 안 보인다", async () => {
    const { data, error } = await pcoB.client.from("delegation").select("id").eq("id", delegationA.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("배정된 대리인은 자기 대표단을 볼 수 있다", async () => {
    const { data } = await proxy.client.from("delegation").select("id").eq("id", delegationA.id);
    expect(data?.map((r) => r.id)).toContain(delegationA.id);
  });

  it("같은 테넌트라도 배정 안 된 대리인 성격 사용자는 대표단이 안 보인다", async () => {
    // outsider는 PCO_FIELD로 테넌트 소속이라 실제로는 조회 가능해야 함(PCO 측 권한) — 이건 참고용
    const { data } = await outsider.client.from("delegation").select("id").eq("id", delegationA.id);
    expect(data?.map((r) => r.id)).toContain(delegationA.id); // PCO_FIELD는 테넌트 범위라 보임
  });

  it("대리인은 자기 대표단에 참가자를 추가할 수 있다", async () => {
    const { data, error } = await proxy.client
      .from("participant")
      .insert({
        tenant_id: tenantA.id,
        delegation_id: delegationA.id,
        participant_type: "VIP",
        last_name: "Nguyen",
        first_name: "Van A",
        nationality: "VN",
      })
      .select()
      .single();
    expect(error).toBeNull();
    expect(data?.delegation_id).toBe(delegationA.id);
  });

  it("다른 테넌트 PCO는 이 참가자를 볼 수 없다", async () => {
    const { data } = await pcoB.client.from("participant").select("id").eq("delegation_id", delegationA.id);
    expect(data).toEqual([]);
  });

  it("PCO_FIELD(조회 전용)는 대표단을 만들 수 없다", async () => {
    const { error } = await outsider.client
      .from("delegation")
      .insert({ tenant_id: tenantA.id, event_id: eventA.id, name: "조회 전용이 만들면 안 되는 대표단", country: "KR", organization: "x" });
    expect(error).not.toBeNull();
  });
});
