// R5 위험 영역(하위 행사 공개 범위) — BR-02C-3: "공개 범위 밖의 사용자에게는 하위 행사가
// 존재한다는 사실 자체가 보이지 않는다." 권한·테넌트 격리와 같은 무게로 다뤄 구현 전에 먼저 씁니다.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { bootstrapTenant } from "@/server/modules/org/bootstrap-tenant";

const admin = createAdminClient();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

async function createSignedInUser(tag: string) {
  const email = `r5-test-${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const password = "Test-password-123!";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const client = createSupabaseClient(url, publishableKey);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { userId: data.user.id, client };
}

describe("하위 행사 공개 범위 (program RLS)", () => {
  let tenant: { id: string };
  let pco: Awaited<ReturnType<typeof createSignedInUser>>;
  let proxyA: Awaited<ReturnType<typeof createSignedInUser>>; // 참석 대표단 대리인
  let proxyB: Awaited<ReturnType<typeof createSignedInUser>>; // 같은 행사, 참석 안 하는 대표단 대리인
  let event: { id: string };
  let delegationA: { id: string };
  let delegationB: { id: string };
  let participantA: { id: string };

  beforeAll(async () => {
    pco = await createSignedInUser("pco");
    proxyA = await createSignedInUser("proxy-a");
    proxyB = await createSignedInUser("proxy-b");

    tenant = await bootstrapTenant("R5 테스트 PCO", pco.userId);

    const { data: ev } = await pco.client.from("event").insert({ tenant_id: tenant.id, name: "R5 테스트 행사" }).select().single();
    event = ev;
    const { data: delA } = await pco.client
      .from("delegation")
      .insert({ tenant_id: tenant.id, event_id: event.id, name: "R5 참석 대표단", country: "VN", organization: "x" })
      .select()
      .single();
    delegationA = delA;
    const { data: delB } = await pco.client
      .from("delegation")
      .insert({ tenant_id: tenant.id, event_id: event.id, name: "R5 비참석 대표단", country: "KR", organization: "y" })
      .select()
      .single();
    delegationB = delB;

    await admin.from("delegation_proxy").insert({ tenant_id: tenant.id, delegation_id: delegationA.id, user_id: proxyA.userId, status: "ACTIVE" });
    await admin.from("delegation_proxy").insert({ tenant_id: tenant.id, delegation_id: delegationB.id, user_id: proxyB.userId, status: "ACTIVE" });

    const { data: p } = await pco.client
      .from("participant")
      .insert({ tenant_id: tenant.id, delegation_id: delegationA.id, participant_type: "VIP", last_name: "Ngo", first_name: "C", nationality: "VN" })
      .select()
      .single();
    participantA = p;
  });

  afterAll(async () => {
    if (tenant?.id) {
      const { data: programs } = await admin.from("program").select("id").eq("tenant_id", tenant.id);
      for (const pr of programs ?? []) await admin.from("program_attendance").delete().eq("program_id", pr.id);
      await admin.from("program").delete().eq("tenant_id", tenant.id);
      await admin.from("participant").delete().eq("delegation_id", delegationA.id);
      await admin.from("delegation").delete().eq("tenant_id", tenant.id);
      await admin.from("event").delete().eq("tenant_id", tenant.id);
      await admin.from("tenant").delete().eq("id", tenant.id);
    }
    for (const u of [pco, proxyA, proxyB]) {
      if (u?.userId) await admin.auth.admin.deleteUser(u.userId);
    }
  });

  it("PUBLIC 하위 행사는 같은 행사의 아무 대리인이나(참석 여부 무관) 볼 수 있다", async () => {
    const { data: program } = await pco.client
      .from("program")
      .insert({ tenant_id: tenant.id, event_id: event.id, name: "본회의", program_type: "PLENARY", organizer_type: "HOST", visibility: "PUBLIC" })
      .select()
      .single();

    const { data: seenByA } = await proxyA.client.from("program").select("id").eq("id", program!.id);
    const { data: seenByB } = await proxyB.client.from("program").select("id").eq("id", program!.id);
    expect(seenByA?.length).toBe(1);
    expect(seenByB?.length).toBe(1);
  });

  it("STAKEHOLDER 하위 행사는 참석 대표단 대리인만 보고, 비참석 대표단 대리인에게는 존재 자체가 안 보인다", async () => {
    const { data: program } = await pco.client
      .from("program")
      .insert({ tenant_id: tenant.id, event_id: event.id, name: "양자 면담", program_type: "BILATERAL", organizer_type: "HOST", visibility: "STAKEHOLDER" })
      .select()
      .single();
    await pco.client.from("program_attendance").insert({ tenant_id: tenant.id, program_id: program!.id, participant_id: participantA.id, role: "ATTENDEE" });

    const { data: seenByA } = await proxyA.client.from("program").select("id").eq("id", program!.id);
    const { data: seenByB, error: errB } = await proxyB.client.from("program").select("id").eq("id", program!.id);
    expect(seenByA?.length).toBe(1);
    expect(errB).toBeNull();
    expect(seenByB).toEqual([]); // 에러가 아니라 그냥 안 보임 — "존재 비노출"
  });

  it("PRIVATE 하위 행사는 어떤 대리인에게도 안 보인다(참석자라도)", async () => {
    const { data: program } = await pco.client
      .from("program")
      .insert({ tenant_id: tenant.id, event_id: event.id, name: "PCO 내부 검토", program_type: "PROTOCOL", organizer_type: "PCO", visibility: "PRIVATE" })
      .select()
      .single();
    await pco.client.from("program_attendance").insert({ tenant_id: tenant.id, program_id: program!.id, participant_id: participantA.id, role: "ATTENDEE" });

    const { data: seenByA } = await proxyA.client.from("program").select("id").eq("id", program!.id);
    expect(seenByA).toEqual([]);
  });

  it("대리인은 자기 대표단 참가자의 참석 행만 보고, 다른 대표단 참석자 행은 못 본다", async () => {
    const { data: program } = await pco.client
      .from("program")
      .insert({ tenant_id: tenant.id, event_id: event.id, name: "공식 연회", program_type: "BANQUET", organizer_type: "HOST", visibility: "PUBLIC" })
      .select()
      .single();
    await pco.client.from("program_attendance").insert({ tenant_id: tenant.id, program_id: program!.id, participant_id: participantA.id, role: "ATTENDEE" });

    const { data: seenByA } = await proxyA.client.from("program_attendance").select("id").eq("program_id", program!.id);
    const { data: seenByB } = await proxyB.client.from("program_attendance").select("id").eq("program_id", program!.id);
    expect(seenByA?.length).toBe(1);
    expect(seenByB).toEqual([]);
  });

  it("대리인은 자기 대표단 참석 상태를 회신(수정)할 수 있다", async () => {
    const { data: program } = await pco.client
      .from("program")
      .insert({ tenant_id: tenant.id, event_id: event.id, name: "회신 테스트", program_type: "BANQUET", organizer_type: "HOST", visibility: "PUBLIC" })
      .select()
      .single();
    await pco.client.from("program_attendance").insert({ tenant_id: tenant.id, program_id: program!.id, participant_id: participantA.id, role: "ATTENDEE" });

    const { error } = await proxyA.client.from("program_attendance").update({ status: "CONFIRMED" }).eq("program_id", program!.id).eq("participant_id", participantA.id);
    expect(error).toBeNull();
    const { data: check } = await admin.from("program_attendance").select("status").eq("program_id", program!.id).eq("participant_id", participantA.id).single();
    expect(check!.status).toBe("CONFIRMED");
  });

  it("대리인은 자기 대표단 명의로 자체 일정을 등록하면 곧바로 확정 상태가 된다", async () => {
    const { data: program, error } = await proxyA.client
      .from("program")
      .insert({
        tenant_id: tenant.id, event_id: event.id, name: "대사관 간담회", program_type: "SELF_SCHEDULED",
        organizer_type: "DELEGATION", organizer_delegation_id: delegationA.id, registered_by_type: "PROXY",
        visibility: "STAKEHOLDER", status: "CONFIRMED",
      })
      .select()
      .single();
    expect(error).toBeNull();
    expect(program!.status).toBe("CONFIRMED");
  });

  it("대리인은 자체 일정이 아닌 유형을 자기 명의로 만들 수 없다", async () => {
    const { error } = await proxyA.client
      .from("program")
      .insert({
        tenant_id: tenant.id, event_id: event.id, name: "무단 본회의", program_type: "PLENARY",
        organizer_type: "DELEGATION", organizer_delegation_id: delegationA.id, registered_by_type: "PROXY",
      });
    expect(error).not.toBeNull();
  });

  it("PCO는 가안 하위 행사를 확정 처리할 수 있고, 대리인은 할 수 없다", async () => {
    const { data: program } = await pco.client
      .from("program")
      .insert({ tenant_id: tenant.id, event_id: event.id, name: "확정 테스트", program_type: "PLENARY", organizer_type: "HOST", visibility: "PUBLIC" })
      .select()
      .single();

    const { error: proxyErr } = await proxyA.client.rpc("confirm_program", { p_program_id: program!.id });
    expect(proxyErr).not.toBeNull();

    const { error: pcoErr } = await pco.client.rpc("confirm_program", { p_program_id: program!.id });
    expect(pcoErr).toBeNull();
    const { data: after } = await admin.from("program").select("status").eq("id", program!.id).single();
    expect(after!.status).toBe("CONFIRMED");
  });

  it("PCO는 확정된 하위 행사를 취소할 수 있다", async () => {
    const { data: program } = await pco.client
      .from("program")
      .insert({ tenant_id: tenant.id, event_id: event.id, name: "취소 테스트", program_type: "PLENARY", organizer_type: "HOST", visibility: "PUBLIC", status: "CONFIRMED" })
      .select()
      .single();

    const { error } = await pco.client.rpc("cancel_program", { p_program_id: program!.id });
    expect(error).toBeNull();
    const { data: after } = await admin.from("program").select("status").eq("id", program!.id).single();
    expect(after!.status).toBe("CANCELLED");
  });
});
