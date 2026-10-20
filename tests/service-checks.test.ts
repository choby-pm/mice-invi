import { expect, it } from "vitest";
import { serviceChecks, type CheckService } from "@/lib/service-checks";
const delegation = [{ id: "d", participant: [{ id: "p1" }, { id: "p2" }] }];
const services: CheckService[] = [
  { delegation_id: "d", service_type: "FLIGHT", status: "CONFIRMED", flight_segment: [{ direction: "INBOUND", arr_at: "2027-01-02T10:00:00Z", is_final_arrival: true }] },
  { delegation_id: "d", service_type: "TRANSFER", status: "REQUESTED", transfer_request: { direction: "INBOUND", scheduled_at: "2027-01-02T09:00:00Z" } },
  { delegation_id: "d", service_type: "LODGING", status: "CONFIRMED", room_assignment: [{ participant_ids: ["p1"], check_in_at: "2027-01-01T10:00:00Z", check_out_at: "2027-01-02T09:00:00Z" }] },
];
it("항공·픽업·숙박의 시간 불일치와 참가자 누락을 검출", () => expect(serviceChecks(services, delegation)).toHaveLength(3));
it("다른 대표단·취소된 서비스는 검사 대상에서 제외", () => {
  expect(serviceChecks(services.map((s) => ({ ...s, status: "CANCELLED" })), delegation)).toEqual([]);
  expect(serviceChecks(services, [{ id: "other", participant: [] }])).toEqual([]);
});
