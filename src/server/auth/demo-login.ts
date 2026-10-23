import "server-only";
import { cookies } from "next/headers";
import { DEMO_ROLES, DEMO_TAB_COOKIE, isDemoMode } from "@/lib/demo";
import { demoSessionCookies } from "@/server/auth/demo-session";

// 새 탭의 역할을 정하고 이동할 경로를 돌려줍니다. 세션은 서버가 역할별로 보관하므로 계정 로그인 과정이 없습니다.
export async function demoLogin(formData: FormData) {
  if (!isDemoMode()) return "/login";
  const option = DEMO_ROLES.find((entry) => entry.role === formData.get("role"));
  if (!option) return "/login?error=" + encodeURIComponent("데모 역할을 선택해 주세요.");
  try {
    await demoSessionCookies(option.role);
  } catch {
    return "/login?error=" + encodeURIComponent("데모에 연결하지 못했습니다. DB 연결과 데모 데이터 생성 상태를 확인해 주세요.");
  }
  // 브라우저 스크립트(DemoTabRole)가 탭 전환 때 다시 써야 하므로 httpOnly가 아닙니다. 역할 이름만 담습니다.
  (await cookies()).set(DEMO_TAB_COOKIE, option.role, { path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  return option.path;
}
