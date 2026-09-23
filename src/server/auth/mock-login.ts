"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { MockRole } from "@/proxy";

const SECTION_BY_ROLE: Record<MockRole, string> = {
  PCO_MANAGER: "/console",
  VENDOR_STAFF: "/vendor",
  PROXY: "/portal",
  PLATFORM_ADMIN: "/admin",
};

// R0 임시 로그인. 실제 인증(이메일 OTP·비밀번호, D-SY-10)은 R1에서 Supabase Auth로 교체합니다.
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
