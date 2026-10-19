import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ServiceDetails, serviceSummary, type ServiceDetailsItem } from "@/components/shared/service-details";

const flight: ServiceDetailsItem = {
  id: "flight", service_type: "FLIGHT", status: "CONFIRMED", note: "요청 요약", confirmation_note: "예약 완료",
  flight_request: { inbound_origin_city: "Hanoi", inbound_dest_airport: "ICN", inbound_preferred_date: "2027-03-01", outbound_preferred_date: "2027-03-04", outbound_origin_airport: "ICN", outbound_dest_city: "Hanoi", note: "창가 좌석 희망: 긴 고객 메모도 생략 없이 표시" },
  flight_segment: [{ direction: "INBOUND", flight_no: "DEMO100", dep_airport: "HAN", arr_airport: "ICN", dep_at: "2027-03-01T00:00:00Z", arr_at: "2027-03-01T04:00:00Z", ticket_status: "TICKETED", pnr: "DEMO-PNR", ticket_no: "DEMO-TICKET" }],
  delegation: { name: "Demo", participant: [{ id: "p", first_name: "Alex", last_name: "DemoVN", participant_type: "VIP", nationality: "VN" }] },
};

it("고객의 모든 항공 요청과 업체의 예약·발권 결과를 구분해 표시", () => {
  const html = renderToStaticMarkup(createElement(ServiceDetails, { item: flight }));
  for (const value of ["Hanoi", "ICN", "창가 좌석 희망: 긴 고객 메모도 생략 없이 표시", "DEMO100", "DEMO-PNR", "DEMO-TICKET", "DemoVN", "발권"]) expect(html).toContain(value);
  expect(html).toContain('aria-label="고객 요청"');
  expect(html).toContain('aria-label="업체 처리 결과"');
  expect(serviceSummary(flight)).toBe("Hanoi → ICN");
});

it("객실·차량 배정을 참가자 이름으로 연결", () => {
  const item: ServiceDetailsItem = { ...flight, service_type: "LODGING", room_assignment: [{ hotel_name: "Demo Hotel", room_type: "Suite", participant_ids: ["p"], room_no: "1001" }], vehicle_dispatch: [{ participant_ids: ["p"], plate_no: "DEMO-CAR", driver_name: "Demo Driver" }] };
  const html = renderToStaticMarkup(createElement(ServiceDetails, { item }));
  for (const value of ["Demo Hotel", "Suite", "1001", "DemoVN", "DEMO-CAR", "Demo Driver"]) expect(html).toContain(value);
  expect(html).not.toContain("참가자 정보 확인 필요");
});

it("관계 데이터가 없을 때 미입력 상태를 안전하게 표시", () => {
  const html = renderToStaticMarkup(createElement(ServiceDetails, { item: { id: "empty", service_type: "FLIGHT", status: "REQUESTED" } }));
  expect(html).toContain("미입력"); expect(html).not.toContain("undefined");
});
