// R4 — 조정 항목 담당 업체 재배정. 구현 전에 먼저 씁니다(영향 엔진 관련 쓰기 함수라 위험 영역과 같은 규칙 적용).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { bootstrapTenant } from "@/server/modules/org/bootstrap-tenant";

const admin = createAdminClient();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

async function createSignedInUser(tag: string) {
  const email = `r4d-test-${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const password = "Test-password-123!";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const client = createSupabaseClient(url, publishableKey);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { userId: data.user.id, client };
}

describe("조정 항목 담당 업체 재배정 (reassign_adjustment_item)", () => {
  let tenant: { id: string };
  let pco: Awaited<ReturnType<typeof createSignedInUser>>;
  let vendorStaff: Awaited<ReturnType<typeof createSignedInUser>>;
  let event: { id: string };
  let delegation: { id: string };
  let lodgingVendorAId: string;
  let lodgingVendorBId: string;
  let dietaryVendorId: string;
  let issueId: string;
  let itemId: string;

  beforeAll(async () => {
    pco = await createSignedInUser("pco");
    vendorStaff = await createSignedInUser("vendor");

    tenant = await bootstrapTenant("R4d 테스트 PCO", pco.userId);

    const { data: ev } = await pco.client.from("event").insert({ tenant_id: tenant.id, name: "R4d 테스트 행사" }).select().single();
    event = ev;
    const { data: del } = await pco.client
      .from("delegation")
      .insert({ tenant_id: tenant.id, event_id: event.id, name: "R4d 테스트 대표단", country: "VN", organization: "x" })
      .select()
      .single();
    delegation = del;

    const { data: vendorA } = await pco.client.from("vendor").insert({ name: "R4d 호텔 A" }).select().single();
    lodgingVendorAId = vendorA.id;
    const { data: vendorB } = await pco.client.from("vendor").insert({ name: "R4d 호텔 B" }).select().single();
    lodgingVendorBId = vendorB.id;
    const { data: dietaryVendor } = await pco.client.from("vendor").insert({ name: "R4d 케이터링" }).select().single();
    dietaryVendorId = dietaryVendor.id;

    const { data: evA } = await pco.client
      .from("event_vendor")
      .insert({ tenant_id: tenant.id, event_id: event.id, vendor_id: vendorA.id, service_types: ["LODGING"] })
      .select()
      .single();
    await pco.client.from("event_vendor").insert({ tenant_id: tenant.id, event_id: event.id, vendor_id: vendorB.id, service_types: ["LODGING"] });
    await pco.client.from("event_vendor").insert({ tenant_id: tenant.id, event_id: event.id, vendor_id: dietaryVendor.id, service_types: ["DIETARY"] });
    await admin.from("vendor_member").insert({ vendor_id: vendorA.id, user_id: vendorStaff.userId, role: "ADMIN" });

    const { data: lodgingItem } = await pco.client
      .from("service_item")
      .select("id")
      .eq("delegation_id", delegation.id)
      .eq("service_type", "LODGING")
      .single();
    await pco.client.from("service_item").update({ event_vendor_id: evA.id, status: "CONFIRMED" }).eq("id", lodgingItem!.id);

    const { data: p } = await pco.client
      .from("participant")
      .insert({ tenant_id: tenant.id, delegation_id: delegation.id, participant_type: "STAFF", last_name: "Bui", first_name: "X", nationality: "VN" })
      .select()
      .single();
    const { data: newIssueId } = await pco.client.rpc("evaluate_participant_change_impact", {
      p_delegation_id: delegation.id,
      p_participant_id: p!.id,
      p_participant_name: "Bui X",
      p_kind: "ADDED",
    });
    issueId = newIssueId as string;
    const { data: items } = await pco.client.from("adjustment_item").select("id").eq("issue_id", issueId);
    itemId = items![0].id;
  });

  afterAll(async () => {
    if (tenant?.id) {
      if (issueId) await admin.from("adjustment_item").delete().eq("issue_id", issueId);
      await admin.from("change_issue").delete().eq("tenant_id", tenant.id);
      if (delegation?.id) {
        await admin.from("service_item").delete().eq("delegation_id", delegation.id);
        await admin.from("participant").delete().eq("delegation_id", delegation.id);
      }
      if (event?.id) await admin.from("event_vendor").delete().eq("event_id", event.id);
      await admin.from("delegation").delete().eq("tenant_id", tenant.id);
      await admin.from("event").delete().eq("tenant_id", tenant.id);
      await admin.from("vendor_member").delete().eq("user_id", vendorStaff.userId);
      for (const vId of [lodgingVendorAId, lodgingVendorBId, dietaryVendorId]) {
        if (vId) await admin.from("vendor").delete().eq("id", vId);
      }
      await admin.from("tenant").delete().eq("id", tenant.id);
    }
    for (const u of [pco, vendorStaff]) {
      if (u?.userId) await admin.auth.admin.deleteUser(u.userId);
    }
  });

  it("업체는 담당 재배정을 할 수 없다", async () => {
    const { error } = await vendorStaff.client.rpc("reassign_adjustment_item", { p_item_id: itemId, p_new_vendor_id: lodgingVendorBId });
    expect(error).not.toBeNull();
  });

  it("해당 서비스 유형을 맡지 않은 업체로는 재배정할 수 없다", async () => {
    const { error } = await pco.client.rpc("reassign_adjustment_item", { p_item_id: itemId, p_new_vendor_id: dietaryVendorId });
    expect(error).not.toBeNull();
  });

  it("PCO는 같은 서비스 유형을 맡는 다른 업체로 재배정할 수 있고, 상태가 조치 필요로 초기화된다", async () => {
    await pco.client.rpc("acknowledge_adjustment_item", { p_item_id: itemId }); // IN_PROGRESS로 만들어둠
    const { error } = await pco.client.rpc("reassign_adjustment_item", { p_item_id: itemId, p_new_vendor_id: lodgingVendorBId });
    expect(error).toBeNull();

    const { data: item } = await pco.client.from("adjustment_item").select("assignee_vendor_id, status").eq("id", itemId).single();
    expect(item!.assignee_vendor_id).toBe(lodgingVendorBId);
    expect(item!.status).toBe("ACTION_REQUIRED");
  });

  it("완료된 항목은 재배정할 수 없다", async () => {
    await pco.client.rpc("acknowledge_adjustment_item", { p_item_id: itemId });
    await pco.client.rpc("complete_adjustment_item", { p_item_id: itemId, p_resolution_note: "완료", p_value_changed: true });

    const { error } = await pco.client.rpc("reassign_adjustment_item", { p_item_id: itemId, p_new_vendor_id: lodgingVendorAId });
    expect(error).not.toBeNull();
  });
});
