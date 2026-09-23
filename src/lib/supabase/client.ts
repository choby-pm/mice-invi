import { createBrowserClient } from "@supabase/ssr";

// 브라우저에서 쓰는 클라이언트. publishable key는 공개되어도 안전합니다 (RLS로 보호됨, 03 §1.6).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
