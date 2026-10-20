import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ServiceUpdates } from "@/components/shared/service-updates";
import { needsAttention } from "@/lib/service-update";
import { SERVICE_STATUS_LABEL, SERVICE_TYPES } from "@/lib/service-item-constants";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDateTime } from "@/lib/date";
import { serviceChecks } from "@/lib/service-checks";

export default async function EventHomePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await createClient();
  const [services, issues, delegations] = await Promise.all([
    client.from("service_item").select("id,delegation_id,service_type,status,event_vendor_id,scheduled_at,delegation:delegation_id(name),flight_segment(direction,arr_at,is_final_arrival),transfer_request(direction,scheduled_at),room_assignment(participant_ids,check_in_at,check_out_at)").eq("event_id", id).order("scheduled_at", { nullsFirst: false }).limit(3000),
    client.from("change_issue").select("id,summary,max_urgency,adjustment_item(id,status,due_at,assignee_vendor_id)").eq("event_id", id).in("status", ["OPEN", "IN_PROGRESS"]),
    client.from("delegation").select("id,name,rsvp,participant(id)").eq("event_id", id),
  ]);
  for (const result of [services, issues, delegations]) if (result.error) throw result.error;
  const tasks = (services.data ?? []).filter(needsAttention);
  const warnings = serviceChecks(services.data ?? [], delegations.data ?? []);
  const missing = (delegations.data ?? []).filter((d) => d.rsvp !== "DECLINED" && (!d.rsvp || !d.participant.length));
  const now = new Date().getTime();
  const overdue = (issues.data ?? []).flatMap((i) => i.adjustment_item).filter((a) => ["ACTION_REQUIRED", "IN_PROGRESS", "WAITING"].includes(a.status) && a.due_at && Date.parse(a.due_at) < now);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  const arrivals = (services.data ?? []).filter((s) => s.scheduled_at && new Date(s.scheduled_at).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }) === today && !["CANCELLED", "NOT_APPLICABLE"].includes(s.status));
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-semibold">행사 운영 현황</h1><p className="mt-2 text-sm text-muted-foreground">전달·독촉이 필요한 건부터 확인하세요. 입력 중이 아닐 때 15초마다 최신 상태를 확인합니다.</p></div>
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[
      { label: "확인·배정 필요", count: tasks.length, href: "services" }, { label: "미종결 변경", count: issues.data?.length ?? 0, href: "issues" },
      { label: "기한 초과 조정", count: overdue.length, href: "issues" }, { label: "참석·명단 확인 필요", count: missing.length, href: "delegations" },
    ].map((metric) => <Link key={metric.label} href={`/console/events/${id}/${metric.href}`} className="rounded-xl border bg-background p-5 hover:border-primary"><p className="text-sm text-muted-foreground">{metric.label}</p><p className="mt-2 text-3xl font-semibold tabular-nums">{metric.count}</p></Link>)}</div>
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
    <section className="space-y-3 rounded-xl border bg-background p-5 sm:p-6"><h2 className="text-lg font-semibold">우선 대응할 서비스</h2>{!tasks.length && <p className="text-sm text-muted-foreground">배정·요청·변경·취소 대기 항목이 없습니다.</p>}{tasks.slice(0, 15).map((item) => <Link key={item.id} href={`/console/events/${id}/delegations/${item.delegation_id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"><span>{(item.delegation as unknown as { name: string } | null)?.name} · {SERVICE_TYPES.find((s) => s.value === item.service_type)?.label}</span><StatusBadge status={!item.event_vendor_id || item.status === "CANCEL_REQ" ? "urgent" : "action"}>{!item.event_vendor_id ? "담당 업체 미배정" : SERVICE_STATUS_LABEL[item.status]}</StatusBadge></Link>)}{tasks.length > 15 && <Link className="text-sm underline" href={`/console/events/${id}/services`}>전체 {tasks.length}건 보기</Link>}</section>
    <section className="space-y-3 rounded-xl border bg-background p-5 sm:p-6"><h2 className="text-lg font-semibold">오늘 예정된 서비스 · 서울 시간</h2>{!arrivals.length && <p className="text-sm text-muted-foreground">오늘 예정된 서비스가 없습니다.</p>}{arrivals.map((item) => <Link key={item.id} href={`/console/events/${id}/delegations/${item.delegation_id}`} className="block rounded-lg border p-3 text-sm">{(item.delegation as unknown as {name: string} | null)?.name} · {SERVICE_TYPES.find((s) => s.value === item.service_type)?.label} · {formatDateTime(item.scheduled_at!, "ko")}</Link>)}</section>
    </div>
    {!!warnings.length && <section className="space-y-3 rounded-xl border border-status-action-fg/30 bg-background p-5"><h2 className="text-lg font-semibold">자동 점검 · 확인할 불일치 {warnings.length}건</h2>{warnings.map((warning, index) => <Link key={index} href={`/console/events/${id}/delegations/${warning.delegationId}`} className="block rounded-lg border p-3 text-sm">{delegations.data?.find((d) => d.id === warning.delegationId)?.name} · {warning.message}</Link>)}</section>}
    <ServiceUpdates audience="console" eventId={id}/>
  </div>;
}
