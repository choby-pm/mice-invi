// R4 위험 영역(영향 엔진) — 03 §1.5, 01 §P11. 구현 전에 먼저 씁니다(핸드오프 문서 규칙).
// evaluate_flight_change_impact()가 항공 재확정을 감지해 변경 이슈·조정 항목을 올바르게
// 만드는지, 완료 시 이슈가 자동 종결되는지, 재변경 시 기존 이슈가 대체(SUPERSEDED)되는지,
// 권한 밖 사용자는 아무것도 못 하는지를 확인합니다.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { bootstrapTenant } from "@/server/modules/org/bootstrap-tenant";

const admin = createAdminClient();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

async function createSignedInUser(tag: string) {
  const email = `r4-test-${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const password = "Test-password-123!";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const client = createSupabaseClient(url, publishableKey);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { userId: data.user.id, client };
}

describe("변경 이슈·영향 엔진 (evaluate_flight_change_impact 등)", () => {
  let tenant: { id: string };
  let pco: Awaited<ReturnType<typeof createSignedInUser>>;
  let flightStaff: Awaited<ReturnType<typeof createSignedInUser>>;
  let transferStaff: Awaited<ReturnType<typeof createSignedInUser>>;
  let outsiderVendorStaff: Awaited<ReturnType<typeof createSignedInUser>>;
  let event: { id: string };
  let delegation: { id: string };
  let flightItemId: string;
  let flightVendorId: string;
  let transferVendorId: string;
  let outsiderVendorId: string;

  beforeAll(async () => {
    pco = await createSignedInUser("pco");
    flightStaff = await createSignedInUser("flight");
    transferStaff = await createSignedInUser("transfer");
    outsiderVendorStaff = await createSignedInUser("outsider");

    tenant = await bootstrapTenant("R4 테스트 PCO", pco.userId);

    const { data: ev } = await pco.client.from("event").insert({ tenant_id: tenant.id, name: "R4 테스트 행사" }).select().single();
    event = ev;
    const { data: del } = await pco.client
      .from("delegation")
      .insert({ tenant_id: tenant.id, event_id: event.id, name: "R4 테스트 대표단", country: "VN", organization: "x" })
      .select()
      .single();
    delegation = del;

    const { data: flightVendor } = await pco.client.from("vendor").insert({ name: "R4 항공사" }).select().single();
    flightVendorId = flightVendor.id;
    const { data: flightEv } = await pco.client
      .from("event_vendor")
      .insert({ tenant_id: tenant.id, event_id: event.id, vendor_id: flightVendor.id, service_types: ["FLIGHT"] })
      .select()
      .single();
    await admin.from("vendor_member").insert({ vendor_id: flightVendor.id, user_id: flightStaff.userId, role: "ADMIN" });

    const { data: transferVendor } = await pco.client.from("vendor").insert({ name: "R4 수송업체" }).select().single();
    transferVendorId = transferVendor.id;
    const { data: transferEv } = await pco.client
      .from("event_vendor")
      .insert({ tenant_id: tenant.id, event_id: event.id, vendor_id: transferVendor.id, service_types: ["TRANSFER"] })
      .select()
      .single();
    await admin.from("vendor_member").insert({ vendor_id: transferVendor.id, user_id: transferStaff.userId, role: "ADMIN" });

    const { data: outsiderVendor } = await pco.client.from("vendor").insert({ name: "R4 무관 업체" }).select().single();
    outsiderVendorId = outsiderVendor.id;
    await admin.from("vendor_member").insert({ vendor_id: outsiderVendor.id, user_id: outsiderVendorStaff.userId, role: "ADMIN" });

    const { data: flightItem } = await pco.client
      .from("service_item")
      .select("id")
      .eq("delegation_id", delegation.id)
      .eq("service_type", "FLIGHT")
      .single();
    flightItemId = flightItem!.id;
    await pco.client.from("service_item").update({ event_vendor_id: flightEv.id }).eq("id", flightItemId);

    // 수송(입국)을 미리 만들고 IN_PROGRESS까지 진행시켜 "처리중 이상" 대상으로 만듭니다.
    const { data: transferItem } = await pco.client
      .from("service_item")
      .insert({ tenant_id: tenant.id, event_id: event.id, delegation_id: delegation.id, service_type: "TRANSFER", event_vendor_id: transferEv.id, status: "IN_PROGRESS" })
      .select()
      .single();
    await pco.client.from("transfer_request").insert({
      service_item_id: transferItem.id,
      direction: "INBOUND",
      from_text: "ICN",
      to_text: "숙소",
      scheduled_at: "2026-12-01T07:00:00Z",
    });
  });

  afterAll(async () => {
    if (tenant?.id) {
      const { data: issues } = await admin.from("change_issue").select("id").eq("tenant_id", tenant.id);
      for (const i of issues ?? []) await admin.from("adjustment_item").delete().eq("issue_id", i.id);
      await admin.from("change_issue").delete().eq("tenant_id", tenant.id);
      if (delegation?.id) {
        const { data: items } = await admin.from("service_item").select("id").eq("delegation_id", delegation.id);
        for (const it of items ?? []) await admin.from("transfer_request").delete().eq("service_item_id", it.id);
        await admin.from("service_item").delete().eq("delegation_id", delegation.id);
      }
      if (event?.id) await admin.from("event_vendor").delete().eq("event_id", event.id);
      await admin.from("delegation").delete().eq("tenant_id", tenant.id);
      await admin.from("event").delete().eq("tenant_id", tenant.id);
      await admin.from("vendor_member").delete().in("user_id", [flightStaff.userId, transferStaff.userId, outsiderVendorStaff.userId]);
      for (const vId of [flightVendorId, transferVendorId, outsiderVendorId]) {
        if (vId) await admin.from("vendor").delete().eq("id", vId);
      }
      await admin.from("tenant").delete().eq("id", tenant.id);
    }
    for (const u of [pco, flightStaff, transferStaff, outsiderVendorStaff]) {
      if (u?.userId) await admin.auth.admin.deleteUser(u.userId);
    }
  });

  it("최초 확정(이전 값 없음)은 이슈를 만들지 않는다", async () => {
    const { data, error } = await flightStaff.client.rpc("evaluate_flight_change_impact", {
      p_flight_service_item_id: flightItemId,
      p_old_inbound_arr_at: null,
      p_old_inbound_arr_airport: null,
      p_new_inbound_arr_at: "2026-12-01T07:00:00Z",
      p_new_inbound_arr_airport: "ICN",
      p_old_outbound_dep_at: null,
      p_old_outbound_dep_airport: null,
      p_new_outbound_dep_at: null,
      p_new_outbound_dep_airport: null,
    });
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("30분 미만의 사소한 변경은 이슈를 만들지 않는다", async () => {
    const { data, error } = await flightStaff.client.rpc("evaluate_flight_change_impact", {
      p_flight_service_item_id: flightItemId,
      p_old_inbound_arr_at: "2026-12-01T07:00:00Z",
      p_old_inbound_arr_airport: "ICN",
      p_new_inbound_arr_at: "2026-12-01T07:10:00Z",
      p_new_inbound_arr_airport: "ICN",
      p_old_outbound_dep_at: null,
      p_old_outbound_dep_airport: null,
      p_new_outbound_dep_at: null,
      p_new_outbound_dep_airport: null,
    });
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("권한 없는 업체는 이 함수를 호출할 수 없다", async () => {
    const { error } = await outsiderVendorStaff.client.rpc("evaluate_flight_change_impact", {
      p_flight_service_item_id: flightItemId,
      p_old_inbound_arr_at: "2026-12-01T07:00:00Z",
      p_old_inbound_arr_airport: "ICN",
      p_new_inbound_arr_at: "2026-12-01T12:00:00Z",
      p_new_inbound_arr_airport: "GMP",
      p_old_outbound_dep_at: null,
      p_old_outbound_dep_airport: null,
      p_new_outbound_dep_at: null,
      p_new_outbound_dep_airport: null,
    });
    expect(error).not.toBeNull();
  });

  let firstIssueId: string;

  it("처리중인 수송이 있는 상태에서 도착 공항이 크게 바뀌면 이슈+조정항목이 생긴다", async () => {
    const { data, error } = await flightStaff.client.rpc("evaluate_flight_change_impact", {
      p_flight_service_item_id: flightItemId,
      p_old_inbound_arr_at: "2026-12-01T07:00:00Z",
      p_old_inbound_arr_airport: "ICN",
      p_new_inbound_arr_at: "2026-12-01T12:00:00Z",
      p_new_inbound_arr_airport: "GMP",
      p_old_outbound_dep_at: null,
      p_old_outbound_dep_airport: null,
      p_new_outbound_dep_at: null,
      p_new_outbound_dep_airport: null,
    });
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    firstIssueId = data as string;

    const { data: issue } = await pco.client.from("change_issue").select("*").eq("id", firstIssueId).single();
    expect(issue.status).toBe("OPEN");
    expect(issue.delegation_id).toBe(delegation.id);

    const { data: items } = await pco.client.from("adjustment_item").select("*").eq("issue_id", firstIssueId);
    expect(items?.length).toBe(1); // 수송(입국)만 처리중이었으므로 1건
    expect(items?.[0].status).toBe("ACTION_REQUIRED");
    expect(items?.[0].assignee_vendor_id).toBe(transferVendorId);
  });

  it("무관한 업체는 이 조정 항목을 볼 수 없다", async () => {
    const { data } = await outsiderVendorStaff.client.from("adjustment_item").select("id").eq("issue_id", firstIssueId);
    expect(data).toEqual([]);
  });

  it("배정된 수송 업체는 조정 항목을 볼 수 있다", async () => {
    const { data } = await transferStaff.client.from("adjustment_item").select("id").eq("issue_id", firstIssueId);
    expect(data?.length).toBe(1);
  });

  it("무관한 업체는 완료 처리를 할 수 없다", async () => {
    const { data: items } = await pco.client.from("adjustment_item").select("id").eq("issue_id", firstIssueId);
    const itemId = items![0].id;
    const { error } = await outsiderVendorStaff.client.rpc("complete_adjustment_item", {
      p_item_id: itemId,
      p_resolution_note: "무단 시도",
      p_value_changed: true,
    });
    expect(error).not.toBeNull();
  });

  it("배정된 업체가 확인→완료 처리하면 이슈가 자동 종결된다", async () => {
    const { data: items } = await pco.client.from("adjustment_item").select("id").eq("issue_id", firstIssueId);
    const itemId = items![0].id;

    const { error: ackErr } = await transferStaff.client.rpc("acknowledge_adjustment_item", { p_item_id: itemId });
    expect(ackErr).toBeNull();

    const { data: issueAfterAck } = await pco.client.from("change_issue").select("status").eq("id", firstIssueId).single();
    expect(issueAfterAck!.status).toBe("IN_PROGRESS");

    const { error: completeErr } = await transferStaff.client.rpc("complete_adjustment_item", {
      p_item_id: itemId,
      p_resolution_note: "재배차 완료",
      p_value_changed: true,
    });
    expect(completeErr).toBeNull();

    const { data: issueAfterComplete } = await pco.client.from("change_issue").select("status, closed_at").eq("id", firstIssueId).single();
    expect(issueAfterComplete!.status).toBe("CLOSED");
    expect(issueAfterComplete!.closed_at).not.toBeNull();
  });

  it("이미 종결된 이슈 이후 같은 항공편이 다시 크게 바뀌면 새 이슈가 생긴다(이전 이슈는 종결 상태 유지)", async () => {
    const { data, error } = await flightStaff.client.rpc("evaluate_flight_change_impact", {
      p_flight_service_item_id: flightItemId,
      p_old_inbound_arr_at: "2026-12-01T12:00:00Z",
      p_old_inbound_arr_airport: "GMP",
      p_new_inbound_arr_at: "2026-12-01T15:00:00Z",
      p_new_inbound_arr_airport: "GMP",
      p_old_outbound_dep_at: null,
      p_old_outbound_dep_airport: null,
      p_new_outbound_dep_at: null,
      p_new_outbound_dep_airport: null,
    });
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data).not.toBe(firstIssueId);

    const { data: oldIssue } = await pco.client.from("change_issue").select("status").eq("id", firstIssueId).single();
    expect(oldIssue!.status).toBe("CLOSED"); // 이미 종결된 이슈는 재변경으로도 안 바뀜(OPEN/IN_PROGRESS만 대체 대상)
  });

  let secondIssueId: string;

  it("진행 중인 이슈가 있는데 같은 항공편이 다시 바뀌면 기존 이슈는 대체되고 미완료 항목은 무효화된다", async () => {
    // 위 테스트에서 만든 이슈를 진행 중 상태로 둔 채 다시 변경
    const { data: issues } = await pco.client
      .from("change_issue")
      .select("id")
      .eq("origin_service_id", flightItemId)
      .eq("status", "OPEN");
    const openIssueId = issues![0].id;

    const { data, error } = await flightStaff.client.rpc("evaluate_flight_change_impact", {
      p_flight_service_item_id: flightItemId,
      p_old_inbound_arr_at: "2026-12-01T15:00:00Z",
      p_old_inbound_arr_airport: "GMP",
      p_new_inbound_arr_at: "2026-12-01T20:00:00Z",
      p_new_inbound_arr_airport: "ICN",
      p_old_outbound_dep_at: null,
      p_old_outbound_dep_airport: null,
      p_new_outbound_dep_at: null,
      p_new_outbound_dep_airport: null,
    });
    expect(error).toBeNull();
    secondIssueId = data as string;
    expect(secondIssueId).not.toBe(openIssueId);

    const { data: superseded } = await pco.client.from("change_issue").select("status, superseded_by_id").eq("id", openIssueId).single();
    expect(superseded!.status).toBe("SUPERSEDED");
    expect(superseded!.superseded_by_id).toBe(secondIssueId);

    const { data: voidedItems } = await pco.client.from("adjustment_item").select("status").eq("issue_id", openIssueId);
    for (const it of voidedItems ?? []) expect(it.status).toBe("VOID");
  });

  it("PCO는 진행 중인 이슈를 사유와 함께 강제 종결할 수 있다", async () => {
    const { error } = await pco.client.rpc("force_close_change_issue", { p_issue_id: secondIssueId, p_reason: "테스트 강제 종결" });
    expect(error).toBeNull();
    const { data: issue } = await pco.client.from("change_issue").select("status, force_close_reason").eq("id", secondIssueId).single();
    expect(issue!.status).toBe("FORCE_CLOSED");
    expect(issue!.force_close_reason).toBe("테스트 강제 종결");
  });
});
