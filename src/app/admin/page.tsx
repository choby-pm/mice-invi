import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDemoMode } from "@/lib/demo";
import { demoId } from "../../../scripts/demo-data.mjs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";

export default async function AdminHomePage() {
  const store = await cookies();
  if (store.get("mock_role")?.value !== "PLATFORM_ADMIN") redirect("/login");
  const demo = isDemoMode();
  const admin = createAdminClient();
  const health = await admin.auth.admin.listUsers({ perPage: 1 });
  // 임시 운영자 로그인에서는 실제 조직의 정보 대신 가상 데모 조직의 건수만 표시합니다.
  const counts = demo && !health.error ? await Promise.all(
    ["event", "delegation", "participant", "service_item"].map(async (table) => {
      const result = await admin.from(table).select("id", { count: "exact", head: true }).eq("tenant_id", demoId("tenant"));
      return { table, count: result.count, error: !!result.error };
    }),
  ) : [];
  const labels: Record<string, string> = { event: "행사", delegation: "대표단", participant: "참가자", service_item: "서비스" };
  return <div className="max-w-5xl space-y-4">
    <h1 className="text-lg font-semibold">운영사 내부 도구</h1>
    <div className="grid gap-4 sm:grid-cols-2">
      <Card><CardHeader><CardTitle>서비스 모드</CardTitle></CardHeader><CardContent>
        <StatusBadge status={demo ? "progress" : "done"}>{demo ? "데모 운영 중" : "일반 로그인 운영"}</StatusBadge>
        <p className="mt-3 text-sm text-muted-foreground">운영사 화면은 조회용 임시 로그인으로 제공됩니다.</p>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>DB 연결</CardTitle></CardHeader><CardContent className="space-y-3">
        <StatusBadge status={health.error ? "urgent" : "done"}>{health.error ? "연결 확인 필요" : "연결 정상"}</StatusBadge>
        <p><Link href="/admin/db-check" className="text-sm underline">연결 상태 다시 점검</Link></p>
      </CardContent></Card>
    </div>
    {demo && <section className="space-y-3"><h2 className="font-medium">데모 조직 현황</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{counts.map((c) => <Card key={c.table}>
        <CardHeader><CardTitle className="text-sm">{labels[c.table]}</CardTitle></CardHeader>
        <CardContent className="text-xl font-semibold">{c.error ? "확인 필요" : c.count ?? 0}</CardContent>
      </Card>)}</div>
      <p className="text-sm text-muted-foreground">가상 데모 조직의 현재 건수입니다. 개인별 정보와 민감정보는 표시하지 않습니다.</p>
    </section>}
    <Card><CardHeader><CardTitle>접점별 업무 화면</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
      <p>관리자·담당자·현장 직원은 행사 콘솔, 항공 업체는 업체 포털, 대리인은 초청자 포털에서 업무를 확인합니다.</p>
      <Link href="/login" className="underline">역할 선택 화면으로 이동</Link>
    </CardContent></Card>
  </div>;
}
