export type SupportedLocale = "ko" | "en";

const MONTHS_EN = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * 모든 언어에서 월을 글자로 표기합니다 (02 §1.13) — 10/14 vs 14/10 같은 순서 혼동을
 * 원천 차단하기 위한 규칙입니다. 예: en `14 Oct 2026`, ko `2026년 10월 14일`.
 */
export function formatDate(date: Date | string, locale: SupportedLocale): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const day = d.getDate();
  const month = d.getMonth();
  const year = d.getFullYear();
  if (locale === "en") return `${day} ${MONTHS_EN[month]} ${year}`;
  return `${year}년 ${month + 1}월 ${day}일`;
}

/**
 * 시각 + 기준 시간대 표기 (CM-05, U7). 예: `19:30 GMT+9`.
 * "KST"/"ICT" 같은 도시별 약어·도시명은 IF-05 공항·시간대 코드 테이블(R2~R3에서 구현)이
 * 채워진 뒤에 붙입니다 — 지금은 IANA 시간대(`Asia/Seoul`)를 그대로 받습니다.
 */
export function formatDateTime(
  date: Date | string,
  locale: SupportedLocale,
  timeZone: string = "Asia/Seoul",
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const time = new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(d);
  const zoneName =
    new Intl.DateTimeFormat("en-US", { timeZoneName: "short", timeZone })
      .formatToParts(d)
      .find((p) => p.type === "timeZoneName")?.value ?? timeZone;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(d);
  const part = (name: string) => parts.find((p) => p.type === name)!.value;
  const dateText = locale === "en" ? `${part("day")} ${MONTHS_EN[Number(part("month")) - 1]} ${part("year")}` : `${part("year")}년 ${part("month")}월 ${part("day")}일`;
  return `${dateText} ${time} ${zoneName}`;
}

// datetime-local 입력은 시간대가 없으므로 운영 기준(서울)을 명시해서 왕복합니다.
export function toFormDateTime(value: string): string {
  const parts = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const part = (name: string) => parts.find((p) => p.type === name)!.value;
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function fromFormDateTime(value: string): string {
  const local = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value);
  if (!local && !/(Z|[+-]\d{2}:\d{2})$/.test(value)) throw new Error("일시 형식이 올바르지 않습니다.");
  const parsed = new Date(local ? `${value}+09:00` : value);
  if (!Number.isFinite(parsed.getTime()) || (local && toFormDateTime(parsed.toISOString()) !== value.slice(0, 16))) throw new Error("일시를 확인해 주세요.");
  return parsed.toISOString();
}
