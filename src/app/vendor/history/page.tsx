import Link from "next/link";
import { getVendorContext } from "@/server/auth/vendor-context";
import { SERVICE_TYPES, SERVICE_STATUS_LABEL, SERVICE_STATUS_BADGE } from "@/lib/service-item-constants";
import { ADJUSTMENT_STATUS_LABEL, ADJUSTMENT_STATUS_BADGE } from "@/lib/change-issue-constants";
import { formatDateTime } from "@/lib/date";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PROCESSED = ["CONFIRMED", "NOTIFIED", "CANCELLED", "NOT_APPLICABLE"];

export default async function VendorHistoryPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const { supabase, memberships, assignments, flightDemo } = await getVendorContext();
  const results = assignments.length ? await Promise.all([
    supabase.from("service_item").select("id, service_type, status, confirmation_note, confirmed_at, delegation:delegation_id(name, event:event_id(name)), flight_segment(id, direction, seq, flight_no, dep_airport, arr_airport, dep_at, arr_at, ticket_status)")
      .in("event_vendor_id", assignments.map((a) => a.id)).in("status", PROCESSED.includes(status ?? "") ? [status!] : PROCESSED)
      .order("confirmed_at", { ascending: false, nullsFirst: false }).limit(100),
    supabase.from("adjustment_item").select("id, instruction, status, resolution_note, resolved_at")
      .in("assignee_vendor_id", memberships.map((m) => m.vendor.id)).in("status", ["DONE", "NOT_APPLICABLE", "VOID"])
      .order("resolved_at", { ascending: false, nullsFirst: false }).limit(100),
  ]) : [];
  for (const result of results) if (result.error) throw result.error;
  const items = results[0]?.data ?? [];
  const adjustments = results[1]?.data ?? [];

  return <div className="space-y-4">
    <h1 className="text-lg font-semibold">{flightDemo ? "항공 업체 · 처리 내역" : "처리 내역"}</h1>
    <p className="text-sm text-muted-foreground">확정·취소·지원 제외된 서비스와 완료된 조정 결과를 각각 최근 100건까지 표시합니다.</p>
    <form className="flex items-center gap-2">
      <label htmlFor="history-status" className="text-sm">서비스 상태</label>
      <select id="history-status" name="status" defaultValue={status} className="rounded-md border bg-background px-3 py-2 text-sm">
        <option value="">전체</option>{PROCESSED.map((s) => <option key={s} value={s}>{SERVICE_STATUS_LABEL[s]}</option>)}
      </select><Button type="submit" variant="outline">조회</Button>
    </form>
    <h2 className="font-medium">서비스 처리 결과 ({items.length})</h2>
    {items.map((item) => {
      const d = item.delegation as unknown as { name: string; event: { name: string } | null } | null;
      return <Card key={item.id}>
        <CardHeader><CardTitle className="flex flex-wrap items-center gap-2 text-base">
          {d?.name} · {SERVICE_TYPES.find((s) => s.value === item.service_type)?.label}
          <StatusBadge status={SERVICE_STATUS_BADGE[item.status]}>{SERVICE_STATUS_LABEL[item.status]}</StatusBadge>
        </CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">{d?.event?.name}{item.confirmed_at && ` · ${formatDateTime(item.confirmed_at, "ko")}`}</p>
          <p className="whitespace-pre-wrap">{item.confirmation_note || "추가 처리 메모 없음"}</p>
          {item.flight_segment?.toSorted((a, b) => a.dep_at.localeCompare(b.dep_at)).map((f) => <div key={f.id} className="rounded-md border p-3">
            <p>{f.direction === "INBOUND" ? "입국" : "귀국"} · {f.flight_no} · {f.dep_airport} → {f.arr_airport} · {f.ticket_status === "TICKETED" ? "발권" : f.ticket_status === "CANCELLED" ? "취소" : "예약"}</p>
            <p className="text-muted-foreground">{formatDateTime(f.dep_at, "ko")} → {formatDateTime(f.arr_at, "ko")}</p>
          </div>)}
        </CardContent>
      </Card>;
    })}
    {items.length === 0 && <p className="text-sm text-muted-foreground">조건에 맞는 처리 결과가 없습니다.</p>}
    <h2 className="font-medium">조정 처리 결과 ({adjustments.length})</h2>
    {adjustments.map((a) => <Card key={a.id}><CardContent className="space-y-2 py-4 text-sm">
      <StatusBadge status={ADJUSTMENT_STATUS_BADGE[a.status]}>{ADJUSTMENT_STATUS_LABEL[a.status]}</StatusBadge>
      <p>{a.instruction}</p><p className="whitespace-pre-wrap text-muted-foreground">{a.resolution_note || "처리 메모 없음"}</p>
    </CardContent></Card>)}
    {adjustments.length === 0 && <p className="text-sm text-muted-foreground">완료된 조정 작업이 없습니다.</p>}
    <Link href="/vendor" className="text-sm underline">진행 중인 업무 보기</Link>
  </div>;
}
