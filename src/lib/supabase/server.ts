import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// 서버 컴포넌트·서버 액션에서 로그인한 사용자 권한으로 쓰는 클라이언트 (RLS 적용).
// 실제 Supabase Auth 로그인(D-SY-10)이 붙는 R1부터 의미가 생깁니다.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
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
}
