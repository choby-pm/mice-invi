import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// R0 임시 로그인 흔적 (D-SY-10 이전). vendor/admin은 아직 mock_role 쿠키로 화면
// 접근만 흉내 냅니다 — 각 모듈이 만들어지는 릴리스에서 순서대로 실제 인증으로 바뀝니다.
// 주최측 포털(host)은 MVP 제외 항목입니다 (D-RM-04, D-UX-01 — 고도화 1순위).
// 현장 앱도 MVP 제외이며, 현장 스태프는 PCO 콘솔의 조회 전용 화면을 씁니다 (D-UX-08).
export type MockRole = "VENDOR_STAFF" | "PLATFORM_ADMIN";

const SECTION_BY_ROLE: Record<MockRole, string> = {
  VENDOR_STAFF: "/vendor",
  PLATFORM_ADMIN: "/admin",
};

const ROLE_BY_SECTION: Record<string, MockRole> = {
  "/vendor": "VENDOR_STAFF",
  "/admin": "PLATFORM_ADMIN",
};

function checkRealSession(request: NextRequest, loginPath: string) {
  return (async () => {
    let response = NextResponse.next({ request });
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          },
        },
      },
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.redirect(new URL(loginPath, request.url));
    }
    return response;
  })();
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // PCO 콘솔·대리인 포털: 실제 Supabase 세션 확인 (D-SY-10)
  if (pathname.startsWith("/console")) {
    return checkRealSession(request, "/console-login");
  }
  if (pathname.startsWith("/portal")) {
    return checkRealSession(request, "/portal-login");
  }

  // 나머지 구역: 아직 mock_role 쿠키
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
