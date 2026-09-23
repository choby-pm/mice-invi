"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// R0 임시 구현. 실제 메시지 파일(ko/en) 구조는 R0-7에서 만듭니다 (D-UX-07).
export async function setLocale(formData: FormData) {
  const locale = formData.get("locale") as string;
  const next = (formData.get("next") as string) || "/portal";
  const store = await cookies();
  store.set("locale", locale, { path: "/", sameSite: "lax" });
  redirect(next);
}
