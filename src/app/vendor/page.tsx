import Link from "next/link";
import { getVendorContext } from "@/server/auth/vendor-context";
import { TaskList } from "@/components/vendor/task-list";
import { AdjustmentList } from "@/components/vendor/adjustment-list";
import { SERVICE_DETAILS_SELECT } from "@/lib/service-detail-query";
import { ServiceUpdates } from "@/components/shared/service-updates";
import { StatusBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";

// 업체는 여러 행사를 동시에 맡으므로 담당 행사를 고르는 것부터 시작합니다.
// 행사 안의 성격이 다른 세 영역은 탭으로 나누고, 행사·탭은 주소(?event=&tab=)로 유지합니다.
const TABS = [
  { key: "tasks", label: "서비스 업무" },
  { key: "adjustments", label: "변경 조정 요청" },
  { key: "updates", label: "고객 변경 알림" },
] as const;
const ACTION = ["REQUESTED", "CHANGING", "CANCEL_REQ"];
const EVENT_STATUS = { ACTIVE: ["progress", "진행 중"], PREPARING: ["wait", "준비 중"], CLOSED: ["done", "종료"] } as const;

export default async function VendorHomePage({ searchParams }: { searchParams: Promise<{ event?: string; tab?: string }> }) {
  const { event: eventParam, tab: requested } = await searchParams;
  const tab = TABS.find((t) => t.key === requested)?.key ?? "tasks";
  const { supabase, assignments, memberships, demoLabel } = await getVendorContext();
  if (!assignments.length) return <p>아직 배정된 행사가 없습니다.</p>;
  const [serviceResult, adjustmentResult] = await Promise.all([
    supabase
      .from("service_item")
      .select(SERVICE_DETAILS_SELECT)
      .in("event_vendor_id", assignments.map((a) => a.id))
      .in("status", ["REQUESTED", "IN_PROGRESS", "CONFIRMED", "CHANGING", "CANCEL_REQ"])
      .order("status"),
    supabase
      .from("adjustment_item")
      .select(
        "id, status, urgency, instruction, due_at, service_item:service_item_id(service_type), issue:issue_id(issue_no, event_id, delegation:delegation_id(name, event:event_id(name)))",
      )
      .in("assignee_vendor_id", memberships.map((m) => m.vendor.id))
      .in("status", ["ACTION_REQUIRED", "IN_PROGRESS"])
      .order("urgency"),
  ]);
  if (serviceResult.error) throw serviceResult.error;
  if (adjustmentResult.error) throw adjustmentResult.error;
  const allServices = (serviceResult.data ?? []) as unknown as { event_id: string; status: string }[];
  const allAdjustments = (adjustmentResult.data ?? []) as unknown as { status: string; issue: { event_id: string } | null }[];
  const events = [...new Map(assignments.flatMap((a) => (a.event ? [[a.event.id, a.event]] : []))).values()];
  const selected = events.find((e) => e.id === eventParam) ?? (events.length === 1 ? events[0] : null);
  const servicesOf = (eventId: string) => allServices.filter((s) => s.event_id === eventId);
  const adjustmentsOf = (eventId: string) => allAdjustments.filter((a) => a.issue?.event_id === eventId);

  const header = (
    <div className="space-y-2"><p className="text-xs font-semibold uppercase tracking-widest text-primary">{memberships.map((m) => m.vendor.name).join(" · ") || "PARTNER WORKSPACE"}</p><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{demoLabel ? `${demoLabel} 업무` : "통합 할 일"}</h1></div>
  );

  if (!selected) {
    return (
      <div className="space-y-6">
        {header}
        <p className="text-sm leading-6 text-muted-foreground">담당 중인 행사 {events.length}개입니다. 업무를 볼 행사를 선택하세요.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {events.map((e) => {
            const services = servicesOf(e.id);
            const adjustments = adjustmentsOf(e.id);
            const [badge, label] = EVENT_STATUS[e.status as keyof typeof EVENT_STATUS] ?? ["wait", e.status];
            return (
              <Link key={e.id} href={`/vendor?event=${e.id}`} className="space-y-4 rounded-xl border bg-background p-5 transition-colors hover:border-primary/50">
                <div className="flex items-start justify-between gap-3"><span className="font-semibold">{e.name}</span><StatusBadge status={badge}>{label}</StatusBadge></div>
                <dl className="grid grid-cols-3 gap-2 text-sm">
                  <div><dt className="text-muted-foreground">확인 필요</dt><dd className="text-xl font-semibold tabular-nums">{services.filter((s) => ACTION.includes(s.status)).length}</dd></div>
                  <div><dt className="text-muted-foreground">처리 중</dt><dd className="text-xl font-semibold tabular-nums">{services.filter((s) => s.status === "IN_PROGRESS").length}</dd></div>
                  <div><dt className="text-muted-foreground">변경 조정</dt><dd className="text-xl font-semibold tabular-nums">{adjustments.length}</dd></div>
                </dl>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  const services = servicesOf(selected.id);
  const adjustments = adjustmentsOf(selected.id);
  const counts = { tasks: services.length, adjustments: adjustments.length, updates: null };
  const actionNeeded = adjustments.filter((a) => a.status === "ACTION_REQUIRED").length;

  return (
    <div className="space-y-6">
      {header}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background px-4 py-3">
        <span className="text-sm"><span className="text-muted-foreground">담당 행사 · </span><span className="font-semibold">{selected.name}</span></span>
        {events.length > 1 && <Link href="/vendor" className="text-sm font-medium text-primary hover:underline">행사 변경</Link>}
      </div>
      <nav aria-label="업무 구분" className="flex gap-1 overflow-x-auto rounded-lg bg-muted/60 p-1">
        {TABS.map((t) => (
          <Link key={t.key} href={`/vendor?event=${selected.id}&tab=${t.key}`} scroll={false} aria-current={tab === t.key ? "page" : undefined}
            className={cn("flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
              tab === t.key && "bg-background text-foreground shadow-sm")}>
            {t.label}
            {counts[t.key] !== null && <span className="tabular-nums text-xs text-muted-foreground">{counts[t.key]}</span>}
            {t.key === "adjustments" && actionNeeded > 0 && (
              <span className="rounded-full bg-status-urgent-bg px-2 py-0.5 text-xs text-status-urgent-fg">조치 필요 {actionNeeded}</span>
            )}
          </Link>
        ))}
      </nav>
      {tab === "tasks" && <TaskList items={services as never} />}
      {tab === "adjustments" && (adjustments.length
        ? <AdjustmentList items={adjustments as never} />
        : <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">진행 중인 변경 조정 요청이 없습니다.</p>)}
      {tab === "updates" && <ServiceUpdates audience="vendor" eventId={selected.id} />}
    </div>
  );
}
