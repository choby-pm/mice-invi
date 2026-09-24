// R5 — 대표단 자체 일정의 수송 자동 생성·PCO 조정 요청 함수. 새 SECURITY DEFINER 함수라
// 권한 검사를 먼저 테스트합니다(0016 이후 이 프로젝트의 일관된 패턴).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { bootstrapTenant } from "@/server/modules/org/bootstrap-tenant";

const admin = createAdminClient();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

async function createSignedInUser(tag: string) {
  const email = `r5b-test-${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const password = "Test-password-123!";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const client = createSupabaseClient(url, publishableKey);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { userId: data.user.id, client };
}

describe("대표단 자체 일정 — 수송 자동 생성 / PCO 조정 요청", () => {
  let tenant: { id: string };
  let pco: Awaited<ReturnType<typeof createSignedInUser>>;
  let proxyA: Awaited<ReturnType<typeof createSignedInUser>>;
  let proxyB: Awaited<ReturnType<typeof createSignedInUser>>; // 다른 대표단(무관)
  let event: { id: string };
  let delegationA: { id: string };
  let delegationB: { id: string };
  let participantA: { id: string };
  let programId: string;

  beforeAll(async () => {
    pco = await createSignedInUser("pco");
    proxyA = await createSignedInUser("proxy-a");
    proxyB = await createSignedInUser("proxy-b");

    tenant = await bootstrapTenant("R5b 테스트 PCO", pco.userId);

    const { data: ev } = await pco.client.from("event").insert({ tenant_id: tenant.id, name: "R5b 테스트 행사" }).select().single();
    event = ev;
    const { data: delA } = await pco.client
      .from("delegation")
      .insert({ tenant_id: tenant.id, event_id: event.id, name: "R5b 대표단A", country: "VN", organization: "x" })
      .select()
      .single();
    delegationA = delA;
    const { data: delB } = await pco.client
      .from("delegation")
      .insert({ tenant_id: tenant.id, event_id: event.id, name: "R5b 대표단B", country: "KR", organization: "y" })
      .select()
      .single();
    delegationB = delB;

    await admin.from("delegation_proxy").insert({ tenant_id: tenant.id, delegation_id: delegationA.id, user_id: proxyA.userId, status: "ACTIVE" });
    await admin.from("delegation_proxy").insert({ tenant_id: tenant.id, delegation_id: delegationB.id, user_id: proxyB.userId, status: "ACTIVE" });

    const { data: p } = await pco.client
      .from("participant")
      .insert({ tenant_id: tenant.id, delegation_id: delegationA.id, participant_type: "VIP", last_name: "Kim", first_name: "E", nationality: "VN" })
      .select()
      .single();
    participantA = p;

    const { data: transferVendor } = await pco.client.from("vendor").insert({ name: "R5b 수송업체" }).select().single();
    await pco.client.from("event_vendor").insert({ tenant_id: tenant.id, event_id: event.id, vendor_id: transferVendor.id, service_types: ["TRANSFER"] });

    const { data: program } = await proxyA.client
      .from("program")
      .insert({
        tenant_id: tenant.id, event_id: event.id, name: "R5b 자체 일정", program_type: "SELF_SCHEDULED",
        organizer_type: "DELEGATION", organizer_delegation_id: delegationA.id, registered_by_type: "PROXY",
        visibility: "STAKEHOLDER", status: "CONFIRMED", start_at: "2027-04-01T09:00:00Z", venue: "R5b 장소",
      })
      .select()
      .single();
    programId = program!.id;
  });

  afterAll(async () => {
    if (tenant?.id) {
      const { data: items } = await admin.from("service_item").select("id").eq("delegation_id", delegationA.id);
      for (const it of items ?? []) await admin.from("transfer_request").delete().eq("service_item_id", it.id);
      await admin.from("service_item").delete().eq("delegation_id", delegationA.id);
      await admin.from("program_attendance").delete().eq("program_id", programId);
      await admin.from("program").delete().eq("event_id", event.id);
      await admin.from("participant").delete().eq("delegation_id", delegationA.id);
      await admin.from("delegation_proxy").delete().in("delegation_id", [delegationA.id, delegationB.id]);
      await admin.from("event_vendor").delete().eq("event_id", event.id);
      await admin.from("delegation").delete().eq("tenant_id", tenant.id);
      await admin.from("event").delete().eq("tenant_id", tenant.id);
      await admin.from("tenant").delete().eq("id", tenant.id);
    }
    for (const u of [pco, proxyA, proxyB]) {
      if (u?.userId) await admin.auth.admin.deleteUser(u.userId);
    }
  });

  it("무관한 대표단 대리인은 이 자체 일정의 수송을 생성할 수 없다", async () => {
    const { error } = await proxyB.client.rpc("generate_self_scheduled_transfer", {
      p_program_id: programId,
      p_participant_ids: [participantA.id],
    });
    expect(error).not.toBeNull();
  });

  let transferServiceItemId: string;

  it("주관 대표단 대리인은 수송을 생성할 수 있고, 업체가 수송 요청 상세를 볼 수 있다", async () => {
    const { data, error } = await proxyA.client.rpc("generate_self_scheduled_transfer", {
      p_program_id: programId,
      p_participant_ids: [participantA.id],
    });
    expect(error).toBeNull();
    transferServiceItemId = data as string;

    const { data: item } = await pco.client.from("service_item").select("service_type, status").eq("id", transferServiceItemId).single();
    expect(item!.service_type).toBe("TRANSFER");
    expect(item!.status).toBe("REQUESTED");

    const { data: tr } = await pco.client.from("transfer_request").select("direction, source_program_id, participant_ids").eq("service_item_id", transferServiceItemId).single();
    expect(tr!.direction).toBe("PROGRAM");
    expect(tr!.source_program_id).toBe(programId);
    expect(tr!.participant_ids).toEqual([participantA.id]);
  });

  it("같은 자체 일정을 다시 호출해도 새 항목이 또 생기지 않고 갱신만 된다", async () => {
    const { data } = await proxyA.client.rpc("generate_self_scheduled_transfer", {
      p_program_id: programId,
      p_participant_ids: [participantA.id],
    });
    expect(data).toBe(transferServiceItemId);
  });

  it("PCO는 자체 일정에 조정 요청을 남길 수 있고, 대리인은 남길 수 없다", async () => {
    const { error: proxyErr } = await proxyA.client.rpc("send_program_adjust_note", { p_program_id: programId, p_note: "대리인이 시도" });
    expect(proxyErr).not.toBeNull();

    const { error: pcoErr } = await pco.client.rpc("send_program_adjust_note", { p_program_id: programId, p_note: "이 시간엔 본회의가 있습니다. 확인 부탁드립니다." });
    expect(pcoErr).toBeNull();

    const { data: after } = await admin.from("program").select("pco_adjust_note").eq("id", programId).single();
    expect(after!.pco_adjust_note).toBe("이 시간엔 본회의가 있습니다. 확인 부탁드립니다.");
  });

  it("PCO 조정 요청은 자체 일정이 아닌 공식 하위 행사에는 쓸 수 없다", async () => {
    const { data: officialProgram } = await pco.client
      .from("program")
      .insert({ tenant_id: tenant.id, event_id: event.id, name: "R5b 공식 행사", program_type: "PLENARY", organizer_type: "HOST", visibility: "PUBLIC" })
      .select()
      .single();
    const { error } = await pco.client.rpc("send_program_adjust_note", { p_program_id: officialProgram!.id, p_note: "테스트" });
    expect(error).not.toBeNull();
    await admin.from("program").delete().eq("id", officialProgram!.id);
  });
});
