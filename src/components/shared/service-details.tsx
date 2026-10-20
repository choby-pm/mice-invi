import { FileText, CircleCheck, Users, Plane, ArrowRight } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/date";
import { SUPPORT_TYPE_LABEL } from "@/lib/service-item-constants";

type Person = { id: string; first_name: string; last_name: string; participant_type?: string; nationality?: string; title?: string | null };
type FlightRequest = { inbound_origin_city?: string | null; inbound_dest_airport?: string | null; inbound_preferred_date?: string | null; outbound_preferred_date?: string | null; outbound_origin_airport?: string | null; outbound_dest_city?: string | null; note?: string | null };
type LodgingRequest = { check_in_preferred_date?: string | null; check_out_preferred_date?: string | null; room_grouping_note?: string | null; note?: string | null };
type TransferRequest = { direction?: string; from_text?: string | null; to_text?: string | null; scheduled_at?: string | null; participant_ids?: string[]; luggage_note?: string | null };

export interface ServiceDetailsItem {
  id: string; service_type: string; status: string; note?: string | null; scheduled_at?: string | null;
  support_type?: string | null; confirmation_note?: string | null; confirmed_at?: string | null;
  delegation?: { name: string; event?: { name: string } | null; participant?: Person[] } | null;
  flight_request?: FlightRequest | FlightRequest[] | null;
  lodging_request?: LodgingRequest | LodgingRequest[] | null;
  transfer_request?: TransferRequest | TransferRequest[] | null;
  airport_request?: { scope: string[]; note?: string | null } | { scope: string[]; note?: string | null }[] | null;
  dietary_requirement?: { participant_id?: string; dietary_code: string; note?: string | null; participant?: { first_name: string; last_name: string } | null }[] | null;
  flight_segment?: { direction: string; seq?: number; flight_no: string; dep_airport: string | null; arr_airport: string | null; dep_at: string; arr_at: string; cabin_class?: string | null; pnr?: string | null; ticket_no?: string | null; ticket_status: string; change_fee?: number | null; change_fee_currency?: string | null }[] | null;
  room_assignment?: { hotel_name: string; room_type: string | null; participant_ids: string[]; check_in_at?: string | null; check_out_at?: string | null; room_no?: string | null; confirmation_no?: string | null; note?: string | null }[] | null;
  vehicle_dispatch?: { participant_ids: string[]; from_text?: string | null; to_text?: string | null; depart_at?: string | null; vehicle_class?: string | null; plate_no?: string | null; driver_name?: string | null; driver_phone?: string | null; luggage_note?: string | null }[] | null;
  airport_assignment?: { attendant_name?: string | null; meeting_point?: string | null; meeting_at?: string | null; note?: string | null }[] | null;
}

const first = <T,>(value: T | T[] | null | undefined): T | null => Array.isArray(value) ? value[0] ?? null : value ?? null;
const date = (value?: string | null) => value ? formatDate(value, "ko") : null;
const time = (value?: string | null) => value ? formatDateTime(value, "ko") : null;
const DIRECTION: Record<string, string> = { INBOUND: "입국", OUTBOUND: "귀국", PROGRAM: "일정 이동" };
const DIET: Record<string, string> = { NONE: "일반", HALAL: "할랄", VEGETARIAN: "채식", VEGAN: "비건", KOSHER: "코셔", ALLERGY: "알레르기", OTHER: "기타" };
const SCOPE: Record<string, string> = { GREETING: "영접 인사", FAST_TRACK: "패스트트랙", LOUNGE: "라운지", BAGGAGE: "수하물 대행" };
const PERSON_TYPE: Record<string, string> = { VIP: "VIP", COMPANION: "동반자", STAFF: "수행원" };

export function serviceSummary(item: ServiceDetailsItem) {
  const f = first(item.flight_request);
  if (item.service_type === "FLIGHT" && f) return [f.inbound_origin_city, f.inbound_dest_airport].filter(Boolean).join(" → ") || item.note || "요청 내용 확인";
  const l = first(item.lodging_request);
  if (item.service_type === "LODGING" && l) return [date(l.check_in_preferred_date), date(l.check_out_preferred_date)].filter(Boolean).join(" → ") || item.note || "숙박 요청";
  const t = first(item.transfer_request);
  if (item.service_type === "TRANSFER" && t) return [t.from_text, t.to_text].filter(Boolean).join(" → ") || item.note || "수송 요청";
  return item.note || "상세 내용에서 확인해 주세요";
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return <div className="min-w-0 space-y-1"><dt className="text-sm font-medium text-muted-foreground">{label}</dt><dd className="whitespace-pre-wrap break-words text-base font-medium leading-7">{value === null || value === undefined || value === "" ? <span className="text-muted-foreground">미입력</span> : value}</dd></div>;
}

export function ServiceDetails({ item, participants = item.delegation?.participant ?? [] }: { item: ServiceDetailsItem; participants?: Person[] }) {
  const flight = first(item.flight_request);
  const lodging = first(item.lodging_request);
  const transfer = first(item.transfer_request);
  const airport = first(item.airport_request);
  const names = (ids: string[]) => ids.map((id) => {
    const p = participants.find((p) => p.id === id);
    return p ? `${p.last_name} ${p.first_name}` : "참가자 정보 확인 필요";
  }).join(", ") || "배정 없음";

  return <div className="space-y-5">
    {item.status === "CHANGING" && <p role="status" className="rounded-lg border border-status-action-fg/20 bg-status-action-bg p-4 text-sm leading-6 text-status-action-fg">고객 요청이 변경되어 업체 확인이 필요합니다. 아래 처리 결과는 변경 전에 확정된 정보이며, 새 요청에 맞춰 다시 확인해야 합니다.</p>}
    <div className="grid gap-5 lg:grid-cols-2">
      <section aria-label="고객 요청" className="overflow-hidden rounded-xl border bg-background">
        <div className="flex items-center gap-2 border-b bg-muted/50 px-5 py-4"><FileText className="size-4 text-primary" /><h3 className="font-semibold">고객 요청</h3><span className="ml-auto text-xs text-muted-foreground">고객이 입력한 내용</span></div>
        <dl className="grid gap-5 p-5 sm:grid-cols-2">
          {item.support_type && <div className="sm:col-span-2"><Field label="지원 방식" value={SUPPORT_TYPE_LABEL[item.support_type] ?? item.support_type} /></div>}
          {item.service_type === "FLIGHT" && <>
            <Field label="입국 출발 도시" value={flight?.inbound_origin_city} /><Field label="입국 도착 공항" value={flight?.inbound_dest_airport} />
            <Field label="희망 입국일" value={date(flight?.inbound_preferred_date)} /><Field label="희망 귀국일" value={date(flight?.outbound_preferred_date)} />
            <Field label="귀국 출발 공항" value={flight?.outbound_origin_airport} /><Field label="귀국 도착 도시" value={flight?.outbound_dest_city} />
            <div className="sm:col-span-2"><Field label="고객 요청 메모" value={flight?.note} /></div>
          </>}
          {item.service_type === "LODGING" && <>
            <Field label="희망 체크인" value={date(lodging?.check_in_preferred_date)} /><Field label="희망 체크아웃" value={date(lodging?.check_out_preferred_date)} />
            <Field label="객실 구성 요청" value={lodging?.room_grouping_note} /><Field label="고객 요청 메모" value={lodging?.note} />
          </>}
          {item.service_type === "TRANSFER" && <>
            <Field label="이동 구분" value={DIRECTION[transfer?.direction ?? ""]} /><Field label="희망 이동 시각" value={time(transfer?.scheduled_at)} />
            <Field label="출발지" value={transfer?.from_text} /><Field label="도착지" value={transfer?.to_text} />
            <Field label="탑승 대상" value={names(transfer?.participant_ids ?? [])} /><Field label="수하물 메모" value={transfer?.luggage_note} />
          </>}
          {item.service_type === "AIRPORT" && <><Field label="PCO 지정 의전 범위" value={airport?.scope.map((s) => SCOPE[s] ?? s).join(" · ")} /><Field label="의전 요청 메모" value={airport?.note} /></>}
          {item.service_type === "DIETARY" && <div className="space-y-4 sm:col-span-2">{item.dietary_requirement?.map((r, i) => {
            const p = r.participant ?? participants.find((p) => p.id === r.participant_id);
            return <div key={r.participant_id ?? i} className="rounded-lg border p-3"><Field label={p ? `${p.last_name} ${p.first_name}` : "참가자"} value={`${DIET[r.dietary_code] ?? r.dietary_code}${r.note ? ` · ${r.note}` : ""}`} /></div>;
          })}{!item.dietary_requirement?.length && <p className="text-sm text-muted-foreground">입력된 식이 요청이 없습니다.</p>}</div>}
          <div className="sm:col-span-2"><Field label="요청 요약" value={item.note} /></div>
        </dl>
      </section>
      <section aria-label="업체 처리 결과" className="overflow-hidden rounded-xl border bg-background">
        <div className="flex items-center gap-2 border-b bg-muted/50 px-5 py-4"><CircleCheck className="size-4 text-primary" /><h3 className="font-semibold">업체 처리 결과</h3></div>
        <div className="space-y-4 p-5">
          <dl className="grid gap-4 sm:grid-cols-2"><Field label="확정 메모" value={item.confirmation_note || "아직 확정된 내용이 없습니다."} /><Field label="확정 시각" value={time(item.confirmed_at)} /></dl>
          {item.flight_segment?.toSorted((a, b) => a.dep_at.localeCompare(b.dep_at)).map((f, i) => <div key={`${f.direction}-${f.seq ?? i}`} className="space-y-3 rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-2"><Plane className="size-4 text-primary" /><span className="font-semibold">{f.flight_no}</span><span className="rounded bg-muted px-2 py-1 text-xs">{DIRECTION[f.direction]} · {{ BOOKED: "예약", TICKETED: "발권", CANCELLED: "취소" }[f.ticket_status] ?? f.ticket_status}</span></div>
            <div className="flex items-center gap-3 text-base font-medium">{f.dep_airport}<ArrowRight className="size-4 text-muted-foreground" />{f.arr_airport}</div>
            <dl className="grid gap-3 sm:grid-cols-2"><Field label="출발 시각" value={time(f.dep_at)} /><Field label="도착 시각" value={time(f.arr_at)} /><Field label="좌석 등급" value={f.cabin_class} /><Field label="예약번호" value={f.pnr} /><Field label="항공권 번호" value={f.ticket_no} /><Field label="변경 수수료" value={f.change_fee === null || f.change_fee === undefined ? null : `${f.change_fee.toLocaleString()} ${f.change_fee_currency ?? ""}`} /></dl>
          </div>)}
          {item.room_assignment?.map((r, i) => <dl key={i} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2"><Field label="호텔" value={r.hotel_name} /><Field label="객실" value={[r.room_type, r.room_no].filter(Boolean).join(" · ")} /><Field label="체크인" value={time(r.check_in_at)} /><Field label="체크아웃" value={time(r.check_out_at)} /><Field label="예약번호" value={r.confirmation_no} /><Field label="배정 참가자" value={names(r.participant_ids)} /><Field label="객실 메모" value={r.note} /></dl>)}
          {item.vehicle_dispatch?.map((v, i) => <dl key={i} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2"><Field label="차량" value={[v.vehicle_class, v.plate_no].filter(Boolean).join(" · ")} /><Field label="출발 시각" value={time(v.depart_at)} /><Field label="출발지" value={v.from_text} /><Field label="도착지" value={v.to_text} /><Field label="기사" value={v.driver_name} /><Field label="기사 연락처" value={v.driver_phone} /><Field label="탑승 참가자" value={names(v.participant_ids)} /><Field label="수하물 메모" value={v.luggage_note} /></dl>)}
          {item.airport_assignment?.map((a, i) => <dl key={i} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2"><Field label="담당 요원" value={a.attendant_name} /><Field label="만남 장소" value={a.meeting_point} /><Field label="만남 시각" value={time(a.meeting_at)} /><Field label="처리 메모" value={a.note} /></dl>)}
        </div>
      </section>
    </div>
    <section className="rounded-xl border bg-background p-5">
      <h3 className="mb-4 flex items-center gap-2 font-semibold"><Users className="size-4 text-primary" />참가자 ({participants.length}명)</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{participants.map((p) => <div key={p.id} className="rounded-lg bg-muted/40 p-3"><p className="text-sm font-medium">{p.last_name} {p.first_name}</p><p className="mt-1 text-xs text-muted-foreground">{[PERSON_TYPE[p.participant_type ?? ""], p.nationality, p.title].filter(Boolean).join(" · ")}</p></div>)}</div>
      {participants.length === 0 && <p className="text-sm text-muted-foreground">등록된 참가자가 없습니다.</p>}
    </section>
  </div>;
}
