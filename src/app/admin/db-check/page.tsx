import { createAdminClient } from "@/lib/supabase/admin";
import { StatusBadge } from "@/components/shared/status-badge";

export const dynamic = "force-dynamic"; // 매번 실제로 연결을 확인합니다 (빌드 시점 결과를 굳히지 않음)

export default async function DbCheckPage() {
  const supabase = createAdminClient();

  // 테이블이 아직 없어도 됩니다 — 인증된 API 응답이 오는지(연결·키가 맞는지)만 확인합니다.
  const { error } = await supabase.auth.admin.listUsers({ perPage: 1 });

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-lg font-semibold">DB 연결 확인 (R0-8)</h1>
      <p className="flex items-center gap-2 text-sm">
        Supabase 연결 상태:{" "}
        {error ? (
          <StatusBadge status="urgent">실패</StatusBadge>
        ) : (
          <StatusBadge status="done">연결됨</StatusBadge>
        )}
      </p>
      {error && (
        <p className="text-sm text-status-urgent-fg">
          {error.message} — .env.local의 URL·키를 확인하세요.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        URL: {process.env.NEXT_PUBLIC_SUPABASE_URL}
      </p>
    </div>
  );
}
