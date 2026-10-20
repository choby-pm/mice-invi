import { expect, it } from "vitest";
import { updateChanges, needsAttention } from "@/lib/service-update";
it("변경된 필드만 이전·이후로 비교", () => {
  expect(updateChanges('{"inbound_origin_city":"Hanoi","note":"old"}', '{"inbound_origin_city":"Hanoi","note":"new"}', "REQUEST"))
    .toEqual([{ label: "요청 메모 / Request note", before: "old", after: "new" }]);
});
it("첫 입력·일반 메모·상태도 표시", () => {
  expect(updateChanges(null, '{"note":"first"}', "REQUEST")[0].before).toBe("—");
  expect(updateChanges("old", "new", "CONFIRMED")[0].after).toBe("new");
  expect(updateChanges("REQUESTED", "CONFIRMED", "STATUS")[0].after).toBe("확정");
});
it("의전 범위 배열을 인원수로 오표시하지 않음", () => {
  expect(updateChanges(null, '{"scope":["FAST_TRACK","MEET_GREET"]}', "REQUEST")[0].after).toBe("FAST_TRACK · MEET_GREET");
});
it("미배정·변경·취소 요청은 개입 대상, 취소 완료는 제외", () => {
  expect(needsAttention({ status: "CHANGING", event_vendor_id: "v" })).toBe(true);
  expect(needsAttention({ status: "CONFIRMED", event_vendor_id: null })).toBe(true);
  expect(needsAttention({ status: "CANCELLED", event_vendor_id: null })).toBe(false);
});
