import { cookies } from "next/headers";
import ko from "./messages/ko.json";
import en from "./messages/en.json";

// 다국어 적용 범위는 초청자 측(대리인 포털·행사 페이지·메일·일정표)만입니다 (02 §1.13).
// PCO 콘솔·업체 포털·운영사 도구는 MVP에서 국문 고정이라 이 파일을 쓰지 않습니다.
export type Locale = "ko" | "en";
export type Messages = typeof ko;

const DICTS: Record<Locale, Messages> = { ko, en };

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  return store.get("locale")?.value === "en" ? "en" : "ko";
}

export async function getMessages(): Promise<{ locale: Locale; messages: Messages }> {
  const locale = await getLocale();
  return { locale, messages: DICTS[locale] };
}
