import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { SERVICE_TYPES, SERVICE_STATUS_LABEL } from "@/lib/service-item-constants";
import { updateChanges } from "@/lib/service-update";
import { formatDateTime } from "@/lib/date";
import { acknowledgeServiceUpdate } from "@/server/modules/service-item/update-actions";

export async function ServiceUpdates({ audience, eventId, delegationId, locale = "ko" }: {
  audience: "console" | "vendor" | "portal"; eventId?: string; delegationId?: string; locale?: "ko" | "en";
}) {
  const client = await createClient();
  let query = client.from("service_update").select("id,kind,before_text,after_text,created_at,due_at,vendor_ack_at,service_update_receipt(acknowledged_at),service_item!inner(id,event_id,delegation_id,service_type,status,delegation:delegation_id(name))");
  if (eventId) query = query.eq("service_item.event_id", eventId);
  if (delegationId) query = query.eq("service_item.delegation_id", delegationId);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(20);
  if (error) throw new Error("변경 안내를 불러오지 못했습니다.");
  const english = locale === "en";
  const now = new Date().getTime();
  return <section className="space-y-3 rounded-xl border bg-background p-4 sm:p-5">
    <div><h2 className="text-lg font-semibold">{english ? "Recent updates" : "최근 변경 · 확인 필요"}</h2><p className="mt-1 text-sm text-muted-foreground">{english ? "Latest 20 updates. Refreshes every 15 seconds while idle. Acknowledged does not mean fulfilled." : "최근 20건 · 입력 중이 아닐 때 15초마다 갱신됩니다. ‘확인’과 ‘실제 반영 완료’는 별개입니다."}</p></div>
    {!data?.length && <p className="text-sm text-muted-foreground">{english ? "No new updates yet." : "새 변경이 없습니다. 앞으로 저장되는 요청·확정·상태 변경이 여기에 표시됩니다."}</p>}
    <div className="max-h-[32rem] space-y-3 overflow-y-auto pr-1">{data?.map((row) => {
      const item = row.service_item as unknown as { id: string; event_id: string; delegation_id: string; service_type: string; status: string; delegation: { name: string } | null };
      const checked = row.service_update_receipt.length > 0;
      const requiresVendor = ["REQUEST", "ASSIGNED"].includes(row.kind) || (row.kind === "STATUS" && row.after_text === "CANCEL_REQ");
      const overdue = audience !== "portal" && requiresVendor && !row.vendor_ack_at && Date.parse(row.due_at) < now && !["CONFIRMED", "CANCELLED", "NOT_APPLICABLE"].includes(item.status);
      const href = audience === "vendor" ? `/vendor#service-${item.id}` : audience === "portal" ? `/portal/delegation/${item.delegation_id}#flight` : `/console/events/${item.event_id}/delegations/${item.delegation_id}`;
      return <article key={row.id} className={`space-y-3 rounded-lg border p-4 ${overdue ? "border-l-4 border-l-status-urgent-fg" : ""}`}>
        <div className="flex flex-wrap items-center justify-between gap-2"><Link href={href} className="font-semibold underline underline-offset-4">{item.delegation?.name} · {SERVICE_TYPES.find((s) => s.value === item.service_type)?.label}</Link><span className="text-xs text-muted-foreground">{formatDateTime(row.created_at, locale)}</span></div>
        <div className="flex flex-wrap gap-2"><StatusBadge status={checked ? "done" : "action"}>{english ? (checked ? "Acknowledged" : "Unread") : (checked ? "내 확인 완료" : "내 확인 필요")}</StatusBadge>{audience !== "portal" && requiresVendor && <StatusBadge status={row.vendor_ack_at ? "done" : "wait"}>{row.vendor_ack_at ? "담당 업체 확인" : "담당 업체 확인 대기"}</StatusBadge>}<StatusBadge status={overdue ? "urgent" : "progress"}>{overdue ? "업체 확인 기한 초과" : SERVICE_STATUS_LABEL[item.status]}</StatusBadge></div>
        {audience !== "portal" && requiresVendor && <p className="text-xs text-muted-foreground">업체 확인 기한 {formatDateTime(row.due_at, locale)} · 기본 24시간</p>}
        <details><summary className="cursor-pointer text-sm font-medium">{english ? "View before / after" : "변경 전 → 변경 후 확인"}</summary><div className="mt-3 space-y-2 text-sm">{updateChanges(row.before_text, row.after_text, row.kind).map((change) => <div key={change.label}><p className="mb-1 text-xs text-muted-foreground">{change.label}</p><div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr]"><p className="whitespace-pre-wrap break-words rounded bg-muted p-2 text-muted-foreground">{change.before}</p><span aria-hidden className="self-center">→</span><p className="whitespace-pre-wrap break-words rounded border border-primary/20 bg-primary/5 p-2 font-medium">{change.after}</p></div></div>)}</div></details>
        {!checked && <form action={acknowledgeServiceUpdate}><input type="hidden" name="id" value={row.id}/><Button size="sm" variant="outline">{english ? "Acknowledge update" : "변경 내용 확인"}</Button></form>}
      </article>;
    })}</div>
  </section>;
}
