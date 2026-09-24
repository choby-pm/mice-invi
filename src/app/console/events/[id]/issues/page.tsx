import Link from "next/link";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { IssueBoard, type IssueRow } from "@/components/console/issue-board";
import { BlankScreen } from "@/components/shared/blank-screen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SERVICE_TYPES } from "@/lib/service-item-constants";

const OPEN_ISSUE_STATUSES = ["OPEN", "IN_PROGRESS"];

// 목업(02 §3.4 PCO-E02)의 드롭다운 필터는 순수 GET 폼으로 구현했습니다 — 클라이언트
// 자바스크립트 없이 주소창 쿼리만으로 동작해서 서버 컴포넌트 하나로 충분합니다.
const SELECT_CLASS =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export default async function IssuesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ filter?: string; service?: string; vendor?: string; q?: string }>;
}) {
  const { id: eventId } = await params;
  const { filter, service, vendor, q } = await searchParams;
  const showAll = filter === "all";
  const hasActiveFilter = Boolean(showAll || service || vendor || q);

  const supabase = await createServerSupabaseClient();
  const [{ data: allIssues }, { data: eventVendors }] = await Promise.all([
    supabase
      .from("change_issue")
      .select(
        "id, issue_no, summary, max_urgency, status, created_at, closed_at, delegation:delegation_id(name), adjustment_item(id, status, urgency, due_at, assignee_vendor:assignee_vendor_id(id, name), service_item:service_item_id(service_type))",
      )
      .eq("event_id", eventId)
      .order("created_at", { ascending: false }),
    supabase.from("event_vendor").select("vendor:vendor_id(id, name)").eq("event_id", eventId),
  ]);

  const issues = (allIssues ?? []) as unknown as IssueRow[];
  const openIssues = issues.filter((i) => OPEN_ISSUE_STATUSES.includes(i.status));

  const urgencyBreakdown: Record<string, number> = { URGENT: 0, CAUTION: 0, NORMAL: 0 };
  for (const i of openIssues) urgencyBreakdown[i.max_urgency] = (urgencyBreakdown[i.max_urgency] ?? 0) + 1;

  let filtered = showAll ? issues : openIssues;
  if (service) {
    filtered = filtered.filter((i) => i.adjustment_item.some((a) => a.service_item?.service_type === service));
  }
  if (vendor) {
    filtered = filtered.filter((i) => i.adjustment_item.some((a) => a.assignee_vendor?.id === vendor));
  }
  if (q?.trim()) {
    const needle = q.trim().toLowerCase();
    filtered = filtered.filter((i) => i.delegation?.name?.toLowerCase().includes(needle));
  }

  const vendorRows = (eventVendors ?? []) as unknown as { vendor: { id: string; name: string } | null }[];
  const vendorOptions = Array.from(
    new Map(vendorRows.filter((ev) => ev.vendor).map((ev) => [ev.vendor!.id, ev.vendor!])).values(),
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">변경 이슈</h1>
        <p className="text-sm text-muted-foreground">
          미종결 {openIssues.length}건
          {openIssues.length > 0 && (
            <>
              {" "}(긴급 {urgencyBreakdown.URGENT} · 주의 {urgencyBreakdown.CAUTION} · 일반 {urgencyBreakdown.NORMAL})
            </>
          )}
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="filter" className="text-xs text-muted-foreground">상태</Label>
          <select id="filter" name="filter" defaultValue={showAll ? "all" : "open"} className={SELECT_CLASS}>
            <option value="open">미종결</option>
            <option value="all">전체</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="service" className="text-xs text-muted-foreground">서비스</Label>
          <select id="service" name="service" defaultValue={service ?? ""} className={SELECT_CLASS}>
            <option value="">전체</option>
            {SERVICE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="vendor" className="text-xs text-muted-foreground">업체</Label>
          <select id="vendor" name="vendor" defaultValue={vendor ?? ""} className={SELECT_CLASS}>
            <option value="">전체</option>
            {vendorOptions.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="q" className="text-xs text-muted-foreground">대표단 검색</Label>
          <Input id="q" name="q" defaultValue={q ?? ""} placeholder="대표단명" className="h-8 w-40" />
        </div>
        <Button type="submit" size="sm" variant="outline">필터 적용</Button>
        {hasActiveFilter && (
          <Link href={`/console/events/${eventId}/issues`} className="text-xs text-muted-foreground hover:text-foreground">
            초기화
          </Link>
        )}
      </form>

      {filtered.length === 0 ? (
        <BlankScreen
          title={!hasActiveFilter ? "모든 변경이 반영되었습니다" : "조건에 맞는 이슈가 없습니다"}
          note={
            !hasActiveFilter
              ? "미종결 변경 이슈가 없습니다. 항공편이 재확정되는 등 변경이 생기면 여기 나타납니다."
              : "필터를 바꿔서 다시 확인해보세요."
          }
        />
      ) : (
        <IssueBoard eventId={eventId} issues={filtered} />
      )}
    </div>
  );
}
