"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { MockRole } from "@/proxy";

const SECTION_BY_ROLE: Record<MockRole, string> = {
  VENDOR_STAFF: "/vendor",
  PROXY: "/portal",
  PLATFORM_ADMIN: "/admin",
};

// vendor/portal/admin 임시 로그인. PCO 콘솔은 실제 로그인으로 교체됐습니다 (/console-login, D-SY-10).
export async function mockLogin(formData: FormData) {
  const role = formData.get("role") as MockRole;
  const next = formData.get("next") as string | null;
  const store = await cookies();
  store.set("mock_role", role, { path: "/", sameSite: "lax" });
  redirect(next && next.startsWith("/") ? next : SECTION_BY_ROLE[role]);
}

export async function mockLogout() {
  const store = await cookies();
  store.delete("mock_role");
  redirect("/login");
}
