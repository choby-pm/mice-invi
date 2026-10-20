import { expect, it } from "vitest";
import { bookingBasics } from "@/lib/booking-basics";
const form = (date: string, gender = "F") => { const f = new FormData(); f.set("birthDate", date); f.set("gender", gender); return f; };
it("유효한 윤년 생년월일과 선택 입력을 처리", () => {
  expect(bookingBasics(form("1980-02-29"))).toEqual({ birth_date: "1980-02-29", gender: "F" });
  expect(bookingBasics(form("", ""))).toEqual({ birth_date: null, gender: null });
});
it("없는 날짜·미래 생년월일·잘못된 성별은 거부", () => {
  for (const date of ["1981-02-29", "not-a-date", "2999-01-01"]) expect(() => bookingBasics(form(date))).toThrow();
  expect(() => bookingBasics(form("1980-02-29", "invalid"))).toThrow();
});
