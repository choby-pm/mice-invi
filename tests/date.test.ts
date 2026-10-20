import { expect, it, vi } from "vitest";
import { formatDate, formatDateTime, toFormDateTime, fromFormDateTime } from "@/lib/date";

it("해외 시간대에서도 생년월일·여권 만료일은 원래 날짜로 표시", () => {
  vi.stubEnv("TZ", "America/Los_Angeles");
  try {
    expect(formatDate("1980-02-29", "ko")).toBe("1980년 2월 29일");
    expect(formatDate("2030-01-01", "en")).toBe("1 Jan 2030");
  } finally { vi.unstubAllEnvs(); }
});

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
