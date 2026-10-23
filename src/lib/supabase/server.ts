import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { DEMO_TAB_COOKIE, demoTabRole } from "@/lib/demo";
import { demoSessionCookies } from "@/server/auth/demo-session";

// 같은 렌더 요청에서만 재사용하며 사용자 간 세션은 공유하지 않습니다 (RLS 적용).
export const createClient = cache(async function createClient() {
  const cookieStore = await cookies();
  // 데모: 지금 조작 중인 탭의 역할에 맞는 공용 데모 세션을 씁니다. 세션 갱신 쿠키는 쓰지 않습니다.
  const demoRole = demoTabRole(cookieStore.get(DEMO_TAB_COOKIE)?.value);
  const demoCookies = demoRole ? await demoSessionCookies(demoRole) : null;

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return demoCookies ?? cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          if (demoCookies) return;
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // 서버 컴포넌트에서 호출되면 쓰기가 막혀 있습니다. proxy.ts가 세션을 갱신하므로 무시해도 됩니다.
          }
        },
      },
    },
  );
});
