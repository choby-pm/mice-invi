import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * ⚠️ RLS(행 단위 보안)를 완전히 우회합니다 (03 §1.6). 테넌트 격리가 적용되지 않으므로
 * 사용자 요청 경로에서 쓰지 마세요 — 파기 배치(retention) 등 운영사 신뢰 코드 전용입니다.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
