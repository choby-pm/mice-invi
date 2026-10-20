import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { bootstrapTenant } from "@/server/modules/org/bootstrap-tenant";
import { saveFlightRequest, saveFlightSegments } from "@/server/modules/service-item/flight-actions";
import { saveLodgingRequest } from "@/server/modules/service-item/lodging-actions";
import { saveDietaryRequirements } from "@/server/modules/service-item/dietary-actions";
import { createDelegation } from "@/server/modules/delegation/actions";

const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const admin = createAdminClient();
const users: { id: string; client: SupabaseClient }[] = [];
let tenantId: string, eventId: string, vendorId: string, delegationId: string, participantId: string;
const items: Record<string, string> = {};

function form(values: Record<string, string>) {
  const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data;
}

async function user(tag: string) {
  const email = `linked-${tag}-${crypto.randomUUID()}@example.com`, password = `Test-${crypto.randomUUID()}!`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const entry = { id: created.data.user.id, client }; users.push(entry);
  const signedIn = await client.auth.signInWithPassword({ email, password }); if (signedIn.error) throw signedIn.error;
  return entry;
}

describe("고객 입력 → 업체 처리 → 고객 확정 조회 (독립 DB 데이터)", () => {
  let proxy: SupabaseClient, vendor: SupabaseClient, pco: SupabaseClient;
  const segments = [{ direction: "INBOUND", flightNo: "QA100", depAirport: "HAN", arrAirport: "ICN", depAt: "2027-04-01T09:00", arrAt: "2027-04-01T13:00", pnr: "QA-ONLY", ticketStatus: "TICKETED" },
    { direction: "OUTBOUND", flightNo: "QA101", depAirport: "ICN", arrAirport: "HAN", depAt: "2027-04-04T11:00", arrAt: "2027-04-04T15:00", ticketStatus: "BOOKED" }];

  beforeAll(async () => {
    const owner = await user("pco"), proxyUser = await user("proxy"), vendorUser = await user("vendor");
    pco = owner.client; proxy = proxyUser.client; vendor = vendorUser.client;
    tenantId = (await bootstrapTenant("연동 자동검증 전용", owner.id)).id;
    const event = await admin.from("event").insert({ tenant_id: tenantId, name: "연동 검증 행사" }).select("id").single(); if (event.error) throw event.error; eventId = event.data.id;
    const company = await admin.from("vendor").insert({ name: "연동 검증 업체" }).select("id").single(); if (company.error) throw company.error; vendorId = company.data.id;
    const membership = await admin.from("vendor_member").insert({ vendor_id: vendorId, user_id: vendorUser.id, role: "ADMIN" }); if (membership.error) throw membership.error;
    const assignment = await admin.from("event_vendor").insert({ tenant_id: tenantId, event_id: eventId, vendor_id: vendorId, service_types: ["FLIGHT", "LODGING", "DIETARY", "AIRPORT", "TRANSFER"] }); if (assignment.error) throw assignment.error;
    mocks.client.mockResolvedValue(pco);
    await createDelegation(form({ eventId, name: "연동 검증 대표단", country: "VN", organization: "가상 기관" }));
    const delegation = await admin.from("delegation").select("id").eq("tenant_id", tenantId).single(); if (delegation.error) throw delegation.error; delegationId = delegation.data.id;
    const proxyAssignment = await admin.from("delegation_proxy").insert({ tenant_id: tenantId, delegation_id: delegationId, user_id: proxyUser.id, status: "ACTIVE" }); if (proxyAssignment.error) throw proxyAssignment.error;
    const participant = await admin.from("participant").insert({ tenant_id: tenantId, delegation_id: delegationId, participant_type: "VIP", first_name: "Test", last_name: "Only", nationality: "VN" }).select("id").single(); if (participant.error) throw participant.error; participantId = participant.data.id;
    const services = await admin.from("service_item").select("id,service_type").eq("delegation_id", delegationId); if (services.error) throw services.error;
    for (const item of services.data ?? []) items[item.service_type] = item.id;
  }, 30000);

  afterAll(async () => {
    if (tenantId) {
      await admin.from("change_issue").delete().eq("tenant_id", tenantId);
      await admin.from("program").delete().eq("tenant_id", tenantId);
      await admin.from("service_item").delete().eq("tenant_id", tenantId);
      await admin.from("participant").delete().eq("tenant_id", tenantId);
      await admin.from("delegation").delete().eq("tenant_id", tenantId);
      await admin.from("event_vendor").delete().eq("tenant_id", tenantId);
      await admin.from("event").delete().eq("tenant_id", tenantId);
      await admin.from("tenant").delete().eq("id", tenantId);
    }
    if (vendorId) await admin.from("vendor").delete().eq("id", vendorId);
    for (const entry of users) await admin.auth.admin.deleteUser(entry.id);
  }, 30000);

  it("고객 항공 요청의 도시·날짜·메모를 실제 업체 권한으로 조회", async () => {
    mocks.client.mockResolvedValue(proxy);
    await saveFlightRequest(form({ serviceItemId: items.FLIGHT, inboundOriginCity: "Hanoi", inboundDestAirport: "ICN", inboundPreferredDate: "2027-04-01", outboundPreferredDate: "2027-04-04", outboundOriginAirport: "ICN", outboundDestCity: "Hanoi", note: "창가 좌석 희망" }));
    const result = await vendor.from("service_item").select("status, note, flight_request(*)").eq("id", items.FLIGHT).single();
    expect(result.error).toBeNull(); expect(result.data?.status).toBe("REQUESTED");
    expect(result.data?.note).toContain("Hanoi"); expect(result.data?.note).toContain("창가 좌석 희망");
    expect(result.data?.flight_request).toBeTruthy();
  });

  it("업체 확정은 고객에게 편명·발권·예약번호로 보이고 수송이 자동 생성", async () => {
    mocks.client.mockResolvedValue(vendor);
    await saveFlightSegments(form({ id: items.FLIGHT, segments: JSON.stringify(segments) }));
    const result = await proxy.from("flight_segment").select("flight_no, dep_at, pnr").eq("service_item_id", items.FLIGHT).order("flight_no");
    expect(result.error).toBeNull(); expect(result.data).toHaveLength(2);
    expect(result.data?.[0]).toMatchObject({ flight_no: "QA100", dep_at: "2027-04-01T00:00:00+00:00", pnr: "QA-ONLY" });
    const transfers = await pco.from("service_item").select("id").eq("delegation_id", delegationId).eq("service_type", "TRANSFER");
    expect(transfers.data).toHaveLength(2);
  });

  it("고객이 요청을 바꾸면 기존 발권 정보는 남고 업체 상태가 변경 처리로 전환", async () => {
    mocks.client.mockResolvedValue(proxy);
    await saveFlightRequest(form({ serviceItemId: items.FLIGHT, inboundOriginCity: "Hanoi", inboundDestAirport: "ICN", inboundPreferredDate: "2027-04-01", outboundPreferredDate: "2027-04-04", outboundOriginAirport: "ICN", outboundDestCity: "Hanoi", note: "통로 좌석으로 변경 요청" }));
    const result = await vendor.from("service_item").select("status, flight_segment(pnr)").eq("id", items.FLIGHT).single();
    expect(result.data?.status).toBe("CHANGING"); expect(result.data?.flight_segment).toHaveLength(2);
    mocks.client.mockResolvedValue(vendor);
    await saveFlightSegments(form({ id: items.FLIGHT, segments: JSON.stringify(segments) }));
    const count = await proxy.from("flight_segment").select("id").eq("service_item_id", items.FLIGHT);
    expect(count.data).toHaveLength(2);
  });

  it("숙박 구성과 참가자별 식이도 업체로 전달", async () => {
    mocks.client.mockResolvedValue(proxy);
    await saveLodgingRequest(form({ serviceItemId: items.LODGING, checkInPreferredDate: "2027-04-01", checkOutPreferredDate: "2027-04-04", roomGroupingNote: "VIP 1실", note: "금연 객실" }));
    await saveDietaryRequirements(form({ serviceItemId: items.DIETARY, entries: JSON.stringify([{ participantId, dietaryCode: "VEGETARIAN", note: "가상 식이 요청" }]) }));
    const lodging = await vendor.from("service_item").select("note").eq("id", items.LODGING).single(); expect(lodging.data?.note).toContain("금연 객실");
    const dietary = await vendor.from("dietary_requirement").select("dietary_code").eq("service_item_id", items.DIETARY); expect(dietary.data?.[0].dietary_code).toBe("VEGETARIAN");
  });
});
