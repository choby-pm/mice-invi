import { NextRequest, NextResponse } from "next/server";

// R0 임시 로그인 (D-SY-10 이전). 실제 인증(Supabase Auth)은 R1에서 붙입니다.
// 쿠키 mock_role 하나로 역할별 화면 접근만 흉내 냅니다.
// 주최측 포털(host)은 MVP 제외 항목입니다 (D-RM-04, D-UX-01 — 고도화 1순위).
// 현장 앱도 MVP 제외이며, 현장 스태프는 PCO 콘솔의 조회 전용 화면을 씁니다 (D-UX-08).
export type MockRole = "PCO_MANAGER" | "VENDOR_STAFF" | "PROXY" | "PLATFORM_ADMIN";

const SECTION_BY_ROLE: Record<MockRole, string> = {
  PCO_MANAGER: "/console",
  VENDOR_STAFF: "/vendor",
  PROXY: "/portal",
  PLATFORM_ADMIN: "/admin",
};

const ROLE_BY_SECTION: Record<string, MockRole> = {
  "/console": "PCO_MANAGER",
  "/vendor": "VENDOR_STAFF",
  "/portal": "PROXY",
  "/admin": "PLATFORM_ADMIN",
};

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const section = Object.keys(ROLE_BY_SECTION).find((prefix) => pathname.startsWith(prefix));
  if (!section) return NextResponse.next();

  const role = request.cookies.get("mock_role")?.value as MockRole | undefined;
  if (!role || !(role in SECTION_BY_ROLE)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (ROLE_BY_SECTION[section] !== role) {
    return NextResponse.redirect(new URL(SECTION_BY_ROLE[role], request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/console/:path*", "/vendor/:path*", "/portal/:path*", "/admin/:path*"],
};
