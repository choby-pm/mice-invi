"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { readFlightBookingIdentity, type FlightBookingIdentity } from "@/server/modules/participant/flight-booking-actions";
import { formatDate } from "@/lib/date";

const STATUS = { MISSING: "여권 정보 미입력 · VIP 측 또는 PCO의 정보 보완이 필요합니다.", PURGED: "파기된 여권 정보입니다.", CONSENT_REQUIRED: "현재 고유식별정보 동의가 확인되지 않습니다. VIP 측 동의 확인이 필요합니다.", AVAILABLE: "" };
function Field({ label, value }: { label: string; value: string | null }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 select-text break-all font-medium">{value || "미입력"}</dd></div>;
}
export function FlightBookingIdentityPanel({ serviceItemId }: { serviceItemId: string }) {
  const [rows, setRows] = useState<FlightBookingIdentity[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const load = () => startTransition(async () => {
    setRows(null); setError(null);
    try { setRows(await readFlightBookingIdentity(serviceItemId)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "발권 정보 조회에 실패했습니다."); }
  });
  return <section aria-label="항공 예약·발권용 정보" className="space-y-4 rounded-xl border bg-background p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">항공 예약·발권용 정보</h3><p className="mt-1 text-sm text-muted-foreground">고객이 입력한 최신 정보를 조회합니다. 열람할 때마다 기록되며, 팝업을 닫으면 표시한 정보가 지워집니다.</p></div><div className="flex gap-2"><Button type="button" size="sm" onClick={load} disabled={pending}>{pending ? "조회 중…" : rows ? "최신 정보 다시 조회" : "발권용 여권 정보 열람"}</Button>{rows && <Button type="button" size="sm" variant="outline" onClick={() => setRows(null)}>숨기기</Button>}</div></div>
    {error && <p role="alert" className="text-sm text-status-urgent-fg">{error}</p>}
    {rows?.length === 0 && <p className="text-sm text-muted-foreground">예약 대상 참가자가 없습니다.</p>}
    {rows?.map((row) => <article key={row.participant_id} className="space-y-3 rounded-lg border p-4">
      <h4 className="font-semibold">{row.last_name} {row.first_name}</h4>
      <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3"><Field label="여권상 성 / Surname" value={row.last_name}/><Field label="여권상 이름 / Given names" value={row.first_name}/><Field label="생년월일" value={row.birth_date ? formatDate(row.birth_date, "ko") : null}/><Field label="성별" value={row.gender ? ({ M: "남 / M", F: "여 / F", X: "X" }[row.gender] ?? row.gender) : null}/><Field label="국적" value={row.nationality}/><Field label="여권번호" value={row.passport_no}/><Field label="여권 발급국" value={row.passport_country}/><Field label="여권 만료일" value={row.passport_expiry ? formatDate(row.passport_expiry, "ko") : null}/></dl>
      {STATUS[row.passport_status] && <p className="rounded bg-status-action-bg p-3 text-sm text-status-action-fg">{STATUS[row.passport_status]}</p>}
      {row.passport_status === "AVAILABLE" && (!row.birth_date || !row.gender || !row.passport_country || !row.passport_expiry) && <p className="text-sm text-status-action-fg">발권 필수 정보에 미입력 항목이 있습니다. 여권과 대조해 보완해 주세요.</p>}
    </article>)}
  </section>;
}
