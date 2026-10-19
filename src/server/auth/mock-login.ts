"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { MockRole } from "@/proxy";

const SECTION_BY_ROLE: Record<MockRole, string> = {
  PLATFORM_ADMIN: "/admin",
};

// admin 임시 로그인. PCO 콘솔·대리인 포털·업체 포털은 실제 로그인으로 교체됐습니다
// (/console-login, /portal-login, /vendor-login — D-SY-10).
export async function mockLogin(formData: FormData) {
  const role = formData.get("role") as MockRole;
  if (role !== "PLATFORM_ADMIN") redirect("/login");
  const next = formData.get("next") as string | null;
  const store = await cookies();
  store.set("mock_role", role, { path: "/", sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production" });
  redirect(next === "/admin" || next?.startsWith("/admin/") ? next : SECTION_BY_ROLE[role]);
}

export async function mockLogout() {
  const store = await cookies();
  store.delete("mock_role");
  redirect("/login");
}
