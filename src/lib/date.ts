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
  return `${formatDate(d, locale)} ${time} ${zoneName}`;
}
