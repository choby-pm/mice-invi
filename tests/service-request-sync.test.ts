import { beforeEach, expect, it, vi } from "vitest";
import { saveFlightRequest } from "@/server/modules/service-item/flight-actions";
import { saveLodgingRequest } from "@/server/modules/service-item/lodging-actions";
import { saveDietaryRequirements } from "@/server/modules/service-item/dietary-actions";
import { updateRsvp } from "@/server/modules/delegation/rsvp-actions";
import { requestStatus } from "@/lib/service-request-status";

const mocks = vi.hoisted(() => ({ from: vi.fn(), update: vi.fn(), upsert: vi.fn(), single: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: mocks.from }) }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.refresh }));

beforeEach(() => {
  vi.clearAllMocks();
  const chain = { select: () => chain, eq: () => chain, single: mocks.single, maybeSingle: async () => ({ data: { id: "item" }, error: null }), update: mocks.update, upsert: mocks.upsert };
  mocks.from.mockReturnValue(chain); mocks.update.mockReturnValue(chain);
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.single.mockResolvedValue({ data: { status: "CONFIRMED", service_type: "FLIGHT", flight_request: [{ inbound_origin_city: "Hanoi", inbound_dest_airport: "ICN", inbound_preferred_date: null, outbound_preferred_date: null, outbound_origin_airport: null, outbound_dest_city: null, note: "old" }] }, error: null });
});

function flightForm(note: string) {
  const form = new FormData();
  for (const [k, v] of Object.entries({ serviceItemId: "item", inboundOriginCity: "Hanoi", inboundDestAirport: "ICN", note })) form.set(k, v);
  return form;
}

it("고객이 확정 후 요청을 바꾸면 예약을 덮어쓰지 않고 변경 처리로 표시하고 세 접점을 갱신", async () => {
  await saveFlightRequest(flightForm("new request"));
  expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ status: "CHANGING", note: expect.stringContaining("new request") }));
  expect(mocks.from).not.toHaveBeenCalledWith("flight_segment");
  for (const path of ["/console", "/vendor", "/portal"]) expect(mocks.refresh).toHaveBeenCalledWith(path, "layout");
});

it("내용이 같은 저장은 확정 상태 유지", async () => {
  await saveFlightRequest(flightForm("old"));
  expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ status: "CONFIRMED" }));
});

it("요청 저장 실패 시 상태와 갱신을 성공으로 진행하지 않음", async () => {
  mocks.upsert.mockResolvedValue({ error: new Error("save failed") });
  await expect(saveFlightRequest(flightForm("new"))).rejects.toThrow("save failed");
  expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.refresh).not.toHaveBeenCalled();
});

it("숙박의 객실 구성·요청 메모가 담당자 요약으로 연결", async () => {
  mocks.single.mockResolvedValue({ data: { status: "DRAFT", service_type: "LODGING", lodging_request: [] } });
  const form = new FormData();for (const [k,v] of Object.entries({ serviceItemId: "item", checkInPreferredDate: "2027-03-01", checkOutPreferredDate: "2027-03-04", roomGroupingNote: "VIP+동반자", note: "금연 객실" })) form.set(k,v);
  await saveLodgingRequest(form);
  expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ status: "REQUESTED", note: expect.stringContaining("금연 객실") }));
});

it("잘못된 날짜와 식이 JSON은 쓰기 전에 거부", async () => {
  const form = flightForm("new"); form.set("inboundPreferredDate", "2027-02-30");
  await expect(saveFlightRequest(form)).rejects.toThrow("날짜"); expect(mocks.upsert).not.toHaveBeenCalled();
  const dietary = new FormData();dietary.set("serviceItemId", "item");dietary.set("entries", "broken");
  await expect(saveDietaryRequirements(dietary)).rejects.toThrow("형식");
});

it.each(["CANCELLED", "CANCEL_REQ", "NOT_APPLICABLE"])("%s 요청은 고객이 다시 제출할 수 없음", (status) => {
  expect(() => requestStatus(status, true)).toThrow("수정할 수 없습니다");
});

it("불참에서 참석으로 바꾸면 대표단 불참 표시도 해제", async () => {
  mocks.single.mockResolvedValue({ data: { invite_status: "DECLINED", submitted_at: null } });
  const form = new FormData();form.set("delegationId", "d1");form.set("rsvp", "ATTENDING");
  await updateRsvp(form);
  expect(mocks.update).toHaveBeenCalledWith({ rsvp: "ATTENDING", invite_status: "IN_PROGRESS" });
});
