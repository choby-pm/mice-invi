import { expect, it } from "vitest";
import { formatDateTime, toFormDateTime, fromFormDateTime } from "@/lib/date";

it("서울 시각 입력을 다시 저장해도 9시간 밀리지 않음", () => {
  const original = "2027-03-01T00:00:00.000Z";
  expect(toFormDateTime(original)).toBe("2027-03-01T09:00");
  expect(fromFormDateTime(toFormDateTime(original))).toBe(original);
});
it("날짜가 바뀌는 서울 시각도 올바른 날짜로 표시", () => {
  expect(formatDateTime("2027-03-01T17:00:00Z", "ko")).toContain("2027년 3월 2일 02:00");
  expect(formatDateTime("2027-03-01T17:00:00Z", "en")).toContain("2 Mar 2027 02:00");
});
it.each(["2027-02-30T09:00", "2027-03-01T25:00", "bad"])("잘못된 일시 %s를 거부", (value) => {
  expect(() => fromFormDateTime(value)).toThrow();
});
