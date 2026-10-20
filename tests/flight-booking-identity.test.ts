import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { bootstrapTenant } from "@/server/modules/org/bootstrap-tenant";

const admin = createAdminClient();
const users: { id: string; client: SupabaseClient }[] = [];
let tenantId: string, eventId: string, delegationId: string, participantId: string, flightId: string, lodgingId: string;
let flightVendorId: string, hotelVendorId: string, assignmentId: string, consentId: string;
let unassignedFlightId: string;
let pco: SupabaseClient, aviation: SupabaseClient, hotel: SupabaseClient, outsider: SupabaseClient;
async function user() {
  const email = `booking-${crypto.randomUUID()}@example.com`, password = `Test-${crypto.randomUUID()}!`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  users.push({ id: created.data.user.id, client });
  const signed = await client.auth.signInWithPassword({ email, password });
  if (signed.error) throw signed.error;
  return users.at(-1)!;
}
describe("항공 업체 발권용 신원·여권 정보", () => {
  beforeAll(async () => {
    const owner = await user(), airline = await user(), hotelUser = await user(), other = await user();
    pco = owner.client; aviation = airline.client; hotel = hotelUser.client; outsider = other.client;
    tenantId = (await bootstrapTenant("발권정보 검증 전용", owner.id)).id;
    const event = await admin.from("event").insert({ tenant_id: tenantId, name: "발권정보 검증 행사" }).select("id").single();
    if (event.error) throw event.error; eventId = event.data.id;
    const delegation = await admin.from("delegation").insert({ tenant_id: tenantId, event_id: eventId, name: "검증 대표단", country: "VN", organization: "가상 기관" }).select("id").single();
    if (delegation.error) throw delegation.error; delegationId = delegation.data.id;
    const participant = await admin.from("participant").insert({ tenant_id: tenantId, delegation_id: delegationId, participant_type: "VIP", first_name: "TEST", last_name: "ONLY", nationality: "VN", birth_date: "1980-02-29", gender: "F" }).select("id").single();
    if (participant.error) throw participant.error; participantId = participant.data.id;
    for (const [type, memberId] of [["FLIGHT", airline.id], ["LODGING", hotelUser.id]]) {
      const vendor = await admin.from("vendor").insert({ name: `검증 ${type}` }).select("id").single();
      if (vendor.error) throw vendor.error;
      if (type === "FLIGHT") flightVendorId = vendor.data.id; else hotelVendorId = vendor.data.id;
      await admin.from("vendor_member").insert({ vendor_id: vendor.data.id, user_id: memberId, role: "ADMIN" });
      const assignment = await admin.from("event_vendor").insert({ tenant_id: tenantId, event_id: eventId, vendor_id: vendor.data.id, service_types: [type] }).select("id").single();
      if (assignment.error) throw assignment.error;
      if (type === "FLIGHT") assignmentId = assignment.data.id;
      const item = await admin.from("service_item").update({ event_vendor_id: assignment.data.id, status: "REQUESTED" }).eq("delegation_id", delegationId).eq("service_type", type).select("id").single();
      if (item.error) throw item.error;
      if (type === "FLIGHT") flightId = item.data.id; else lodgingId = item.data.id;
    }
    const policy = await admin.from("consent_policy").insert({ tenant_id: tenantId, event_id: eventId, version: 1, is_current: true, published_at: new Date().toISOString() }).select("id").single();
    if (policy.error) throw policy.error;
    const item = await admin.from("consent_item").insert({ tenant_id: tenantId, event_id: eventId, policy_id: policy.data.id, category: "UNIQUE_ID", text: { ko: "검증용 여권 동의" } }).select("id").single();
    if (item.error) throw item.error;
    const consent = await admin.from("consent_record").insert({ tenant_id: tenantId, delegation_id: delegationId, participant_id: participantId, item_id: item.data.id, proxy_user_id: owner.id, agreed: true, policy_version: 1, status: "VALID" }).select("id").single();
    if (consent.error) throw consent.error; consentId = consent.data.id;
    const saved = await pco.rpc("write_participant_sensitive", { p_participant_id: participantId, p_passport_no: "TEST-NOT-REAL", p_passport_country: "VN", p_passport_expiry: "2030-01-01", p_medical_note: "NEVER-EXPOSE-MEDICAL", p_religion: "NEVER-EXPOSE-RELIGION" });
    if (saved.error) throw saved.error;
    const otherDelegation = await admin.from("delegation").insert({ tenant_id: tenantId, event_id: eventId, name: "미배정 대표단", country: "KR", organization: "가상 기관" }).select("id").single();
    if (otherDelegation.error) throw otherDelegation.error;
    const unassigned = await admin.from("service_item").update({ status: "REQUESTED" }).eq("delegation_id", otherDelegation.data.id).eq("service_type", "FLIGHT").select("id").single();
    if (unassigned.error) throw unassigned.error; unassignedFlightId = unassigned.data.id;
  }, 30000);
  afterAll(async () => {
    if (tenantId) {
      await admin.from("delegation").delete().eq("tenant_id", tenantId);
      await admin.from("event_vendor").delete().eq("tenant_id", tenantId);
      await admin.from("event").delete().eq("tenant_id", tenantId);
      await admin.from("tenant").delete().eq("id", tenantId);
    }
    for (const id of [flightVendorId, hotelVendorId]) if (id) await admin.from("vendor").delete().eq("id", id);
    for (const entry of users) await admin.auth.admin.deleteUser(entry.id);
  }, 30000);
  const read = (client = aviation, id = flightId) => client.rpc("read_flight_booking_identity", { p_service_item_id: id });
  it("배정 항공 업체가 발권 정보만 열람하고 참가자별 기록을 남김", async () => {
    const result = await read();
    expect(result.error).toBeNull();
    expect(result.data?.[0]).toMatchObject({ participant_id: participantId, first_name: "TEST", last_name: "ONLY", birth_date: "1980-02-29", gender: "F", nationality: "VN", passport_no: "TEST-NOT-REAL", passport_country: "VN", passport_expiry: "2030-01-01", passport_status: "AVAILABLE" });
    expect(JSON.stringify(result.data)).not.toMatch(/medical|religion|NEVER-EXPOSE/);
    const logs = await pco.from("sensitive_access_log").select("fields").eq("participant_id", participantId);
    expect(logs.data?.some((log) => log.fields.includes("passport_no") && !log.fields.includes("medical_note"))).toBe(true);
  });
  it("숙박 업체·다른 계정·다른 항목·존재하지 않는 항목은 거부", async () => {
    for (const [client, id] of [[hotel, flightId], [outsider, flightId], [aviation, lodgingId], [aviation, unassignedFlightId], [aviation, crypto.randomUUID()]] as const) {
      const result = await read(client, id); expect(result.error?.code).toBe("P0001"); expect(result.data).toBeNull();
    }
    expect((await aviation.from("participant_sensitive").select("*")).data).toEqual([]);
    expect((await aviation.rpc("read_participant_sensitive", { p_participant_id: participantId })).error).not.toBeNull();
    const anonymous = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    const blocked = await read(anonymous); expect(blocked.error).not.toBeNull(); expect(blocked.data).toBeNull();
  });
  it("같은 여권을 다시 저장해도 예약을 변경 중으로 돌리거나 재알림하지 않음", async () => {
    await admin.from("service_item").update({ status: "CONFIRMED" }).eq("id", flightId);
    const before = await admin.from("service_update").select("id", { count: "exact", head: true }).eq("service_item_id", flightId).eq("kind", "REQUEST");
    const saved = await pco.rpc("write_participant_sensitive", { p_participant_id: participantId, p_passport_no: "TEST-NOT-REAL", p_passport_country: "VN", p_passport_expiry: "2030-01-01" });
    expect(saved.error).toBeNull();
    expect((await aviation.from("service_item").select("status").eq("id", flightId).single()).data?.status).toBe("CONFIRMED");
    const after = await admin.from("service_update").select("id", { count: "exact", head: true }).eq("service_item_id", flightId).eq("kind", "REQUEST");
    expect(after.count).toBe(before.count);
  });
  it("고객 정보 수정 후 다시 열람하면 최신 여권을 반환", async () => {
    await admin.from("service_item").update({ status: "CONFIRMED" }).eq("id", flightId);
    const saved = await pco.rpc("write_participant_sensitive", { p_participant_id: participantId, p_passport_no: "TEST-UPDATED" });
    expect(saved.error).toBeNull(); expect((await read()).data?.[0].passport_no).toBe("TEST-UPDATED");
    expect((await aviation.from("service_item").select("status").eq("id", flightId).single()).data?.status).toBe("CHANGING");
    const notices = await aviation.from("service_update").select("before_text,after_text").eq("service_item_id", flightId).eq("kind", "REQUEST");
    expect(notices.data?.some((n) => n.after_text?.includes("발권 기본정보 또는 여권 정보"))).toBe(true);
    expect(JSON.stringify(notices.data)).not.toMatch(/TEST-UPDATED|TEST-NOT-REAL|NEVER-EXPOSE/);
  });
  it("동의 철회·이전 버전 동의에서는 여권을 반환하지 않음", async () => {
    for (const patch of [{ agreed: false, status: "WITHDRAWN", policy_version: 1 }, { agreed: true, status: "VALID", policy_version: 0 }]) {
      await admin.from("consent_record").update(patch).eq("id", consentId);
      const result = await read(); expect(result.error).toBeNull();
      expect(result.data?.[0]).toMatchObject({ passport_no: null, passport_country: null, passport_expiry: null, passport_status: "CONSENT_REQUIRED" });
    }
    await admin.from("consent_record").update({ agreed: true, status: "VALID", policy_version: 1 }).eq("id", consentId);
  });
  it("정산 완료·소속 해제 시 발권 정보 접근도 즉시 종료", async () => {
    await admin.from("event_vendor").update({ settled_at: new Date().toISOString() }).eq("id", assignmentId);
    expect((await read()).error).not.toBeNull();
    await admin.from("event_vendor").update({ settled_at: null }).eq("id", assignmentId);
    await admin.from("vendor_member").update({ status: "REMOVED" }).eq("vendor_id", flightVendorId);
    expect((await read()).error).not.toBeNull();
    await admin.from("vendor_member").update({ status: "ACTIVE" }).eq("vendor_id", flightVendorId);
  });
  it("미입력과 파기를 구분하고 취소된 참가자는 발권 명단에서 제외", async () => {
    await admin.from("participant_sensitive").update({ passport_no: null }).eq("participant_id", participantId);
    expect((await read()).data?.[0]).toMatchObject({ passport_no: null, passport_status: "MISSING" });
    await admin.from("participant").update({ status: "CANCELLED" }).eq("id", participantId);
    expect((await read()).data).toEqual([]);
    await admin.from("participant").update({ status: "REGISTERED" }).eq("id", participantId);
  });
  it("파기된 여권은 복호화하지 않고 암호화 키를 재생성하지 않음", async () => {
    expect((await pco.rpc("purge_event_sensitive_data", { p_event_id: eventId })).error).toBeNull();
    const result = await read(); expect(result.error).toBeNull();
    expect(result.data?.[0]).toMatchObject({ passport_no: null, passport_status: "PURGED" });
    expect((await admin.from("event_encryption_key").select("event_id").eq("event_id", eventId)).data).toEqual([]);
  });
});
