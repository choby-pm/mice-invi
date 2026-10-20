// R4 위험 영역(영향 엔진) 두 번째 규칙 — IR-08 참가자 추가·삭제. 구현 전에 먼저 씁니다.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { bootstrapTenant } from "@/server/modules/org/bootstrap-tenant";

const admin = createAdminClient();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

async function createSignedInUser(tag: string) {
  const email = `r4b-test-${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const password = "Test-password-123!";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const client = createSupabaseClient(url, publishableKey);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { userId: data.user.id, client };
}

describe("참가자 추가·삭제 영향 규칙 (evaluate_participant_change_impact)", () => {
  let tenant: { id: string };
  let pco: Awaited<ReturnType<typeof createSignedInUser>>;
  let proxy: Awaited<ReturnType<typeof createSignedInUser>>;
  let outsiderProxy: Awaited<ReturnType<typeof createSignedInUser>>;
  let event: { id: string };
  let delegation: { id: string };
  let hotelVendorId: string;

  beforeAll(async () => {
    pco = await createSignedInUser("pco");
    proxy = await createSignedInUser("proxy");
    outsiderProxy = await createSignedInUser("outsider");

    tenant = await bootstrapTenant("R4b 테스트 PCO", pco.userId);

    const { data: ev } = await pco.client.from("event").insert({ tenant_id: tenant.id, name: "R4b 테스트 행사" }).select().single();
    event = ev;
    const { data: del } = await pco.client
      .from("delegation")
      .insert({ tenant_id: tenant.id, event_id: event.id, name: "R4b 테스트 대표단", country: "VN", organization: "x" })
      .select()
      .single();
    delegation = del;

    await admin.from("delegation_proxy").insert({ tenant_id: tenant.id, delegation_id: delegation.id, user_id: proxy.userId, status: "ACTIVE" });

    const { data: hotelVendor } = await pco.client.from("vendor").insert({ name: "R4b 호텔" }).select().single();
    hotelVendorId = hotelVendor.id;
    const { data: hotelEv } = await pco.client
      .from("event_vendor")
      .insert({ tenant_id: tenant.id, event_id: event.id, vendor_id: hotelVendor.id, service_types: ["LODGING"] })
      .select()
      .single();

    const { data: lodgingItem } = await pco.client
      .from("service_item")
      .select("id")
      .eq("delegation_id", delegation.id)
      .eq("service_type", "LODGING")
      .single();
    await pco.client.from("service_item").update({ event_vendor_id: hotelEv!.id, status: "REQUESTED" }).eq("id", lodgingItem!.id);
    const confirmed = await pco.client.from("service_item").update({ status: "CONFIRMED" }).eq("id", lodgingItem!.id);
    if (confirmed.error) throw confirmed.error;
  });

  afterAll(async () => {
    if (tenant?.id) {
      const { data: issues } = await admin.from("change_issue").select("id").eq("tenant_id", tenant.id);
      for (const i of issues ?? []) await admin.from("adjustment_item").delete().eq("issue_id", i.id);
      await admin.from("change_issue").delete().eq("tenant_id", tenant.id);
      if (delegation?.id) {
        const { data: items } = await admin.from("service_item").select("id").eq("delegation_id", delegation.id);
        for (const it of items ?? []) await admin.from("room_assignment").delete().eq("service_item_id", it.id);
        await admin.from("service_item").delete().eq("delegation_id", delegation.id);
        await admin.from("participant").delete().eq("delegation_id", delegation.id);
      }
      if (event?.id) await admin.from("event_vendor").delete().eq("event_id", event.id);
      await admin.from("delegation").delete().eq("tenant_id", tenant.id);
      await admin.from("event").delete().eq("tenant_id", tenant.id);
      if (hotelVendorId) await admin.from("vendor").delete().eq("id", hotelVendorId);
      await admin.from("tenant").delete().eq("id", tenant.id);
    }
    for (const u of [pco, proxy, outsiderProxy]) {
      if (u?.userId) await admin.auth.admin.deleteUser(u.userId);
    }
  });

  it("권한 없는 사용자는 이 함수를 호출할 수 없다", async () => {
    const { error } = await outsiderProxy.client.rpc("evaluate_participant_change_impact", {
      p_delegation_id: delegation.id,
      p_participant_id: "00000000-0000-0000-0000-000000000000",
      p_participant_name: "무단 시도",
      p_kind: "ADDED",
    });
    expect(error).not.toBeNull();
  });

  let vipId: string;
  let issueId: string;

  it("숙박이 이미 확정된 상태에서 참가자를 추가하면 이슈+조정항목이 생긴다", async () => {
    const { data: vip } = await proxy.client
      .from("participant")
      .insert({ tenant_id: tenant.id, delegation_id: delegation.id, participant_type: "VIP", last_name: "Le", first_name: "Van D", nationality: "VN" })
      .select()
      .single();
    vipId = vip.id;

    const { data, error } = await proxy.client.rpc("evaluate_participant_change_impact", {
      p_delegation_id: delegation.id,
      p_participant_id: vipId,
      p_participant_name: "Le Van D",
      p_kind: "ADDED",
    });
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    issueId = data as string;

    const { data: issue } = await pco.client.from("change_issue").select("summary, source").eq("id", issueId).single();
    expect(issue!.summary).toContain("참가자 추가");
    expect(issue!.source).toBe("PROXY");

    const { data: items } = await pco.client.from("adjustment_item").select("*").eq("issue_id", issueId);
    expect(items?.length).toBe(1); // LODGING만 처리중 이상
    expect(items?.[0].assignee_vendor_id).toBe(hotelVendorId);
  });

  it("객실에 배정된 참가자를 삭제하면 room_assignment 참가자 목록에서도 자동으로 빠진다", async () => {
    const { data: lodgingItem } = await pco.client
      .from("service_item")
      .select("id")
      .eq("delegation_id", delegation.id)
      .eq("service_type", "LODGING")
      .single();
    await pco.client.from("room_assignment").insert({
      service_item_id: lodgingItem!.id,
      hotel_name: "테스트 호텔",
      participant_ids: [vipId],
    });

    await proxy.client.from("participant").delete().eq("id", vipId);
    const { error } = await proxy.client.rpc("evaluate_participant_change_impact", {
      p_delegation_id: delegation.id,
      p_participant_id: vipId,
      p_participant_name: "Le Van D",
      p_kind: "REMOVED",
    });
    expect(error).toBeNull();

    const { data: room } = await pco.client.from("room_assignment").select("participant_ids").eq("service_item_id", lodgingItem!.id).single();
    expect(room!.participant_ids).not.toContain(vipId);
  });

  it("처리중 이상 서비스가 전혀 없으면 이슈를 만들지 않는다", async () => {
    // 새 대표단: LODGING을 아직 처리중으로 안 올림 (DRAFT 그대로)
    const { data: freshDelegation } = await pco.client
      .from("delegation")
      .insert({ tenant_id: tenant.id, event_id: event.id, name: "R4b 참가자만 있는 대표단", country: "KR", organization: "x" })
      .select()
      .single();
    const { data: p } = await pco.client
      .from("participant")
      .insert({ tenant_id: tenant.id, delegation_id: freshDelegation!.id, participant_type: "STAFF", last_name: "Kim", first_name: "A", nationality: "KR" })
      .select()
      .single();

    const { data, error } = await pco.client.rpc("evaluate_participant_change_impact", {
      p_delegation_id: freshDelegation!.id,
      p_participant_id: p!.id,
      p_participant_name: "Kim A",
      p_kind: "ADDED",
    });
    expect(error).toBeNull();
    expect(data).toBeNull();

    await admin.from("participant").delete().eq("delegation_id", freshDelegation!.id);
    await admin.from("service_item").delete().eq("delegation_id", freshDelegation!.id);
    await admin.from("delegation").delete().eq("id", freshDelegation!.id);
  });
});
