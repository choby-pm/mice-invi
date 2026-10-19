"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ServiceDetailDialog } from "@/components/shared/service-detail-dialog";
import { serviceSummary } from "@/components/shared/service-details";
import { Plus, X, Search, Users, CalendarDays, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { startServiceItem, confirmServiceItem } from "@/server/modules/service-item/vendor-actions";
import { saveFlightSegments } from "@/server/modules/service-item/flight-actions";
import { saveRoomAssignments } from "@/server/modules/service-item/lodging-actions";
import { saveVehicleDispatches } from "@/server/modules/service-item/transfer-actions";
import { saveAirportAssignment } from "@/server/modules/service-item/airport-actions";
import { Checkbox } from "@/components/ui/checkbox";
import {
  SERVICE_TYPES,
  SERVICE_STATUS_LABEL,
  SERVICE_STATUS_BADGE,
} from "@/lib/service-item-constants";
import { formatDateTime } from "@/lib/date";

interface FlightRequestRow {
  inbound_origin_city: string | null;
  inbound_dest_airport: string | null;
  inbound_preferred_date: string | null;
  outbound_preferred_date: string | null;
  outbound_origin_airport: string | null;
  outbound_dest_city: string | null;
  note: string | null;
}

interface FlightSegmentRow {
  direction: "INBOUND" | "OUTBOUND";
  seq: number;
  flight_no: string;
  dep_airport: string | null;
  arr_airport: string | null;
  dep_at: string;
  arr_at: string;
  cabin_class: string | null;
  pnr: string | null;
  ticket_no: string | null;
  ticket_status: string;
  change_fee: number | null;
  change_fee_currency: string | null;
}

interface LodgingRequestRow {
  check_in_preferred_date: string | null;
  check_out_preferred_date: string | null;
  room_grouping_note: string | null;
  note: string | null;
}

interface RoomAssignmentRow {
  hotel_name: string;
  room_type: string | null;
  participant_ids: string[];
  check_in_at: string | null;
  check_out_at: string | null;
  confirmation_no: string | null;
  room_no: string | null;
  note: string | null;
}

interface ParticipantOption {
  id: string;
  first_name: string;
  last_name: string;
  participant_type: string;
}

interface TransferRequestRow {
  direction: "INBOUND" | "OUTBOUND" | "PROGRAM";
  from_text: string;
  to_text: string;
  scheduled_at: string | null;
  participant_ids: string[];
  luggage_note: string | null;
}

interface VehicleDispatchRow {
  from_text: string | null;
  to_text: string | null;
  depart_at: string | null;
  vehicle_class: string | null;
  plate_no: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  participant_ids: string[];
  luggage_note: string | null;
}

interface AirportRequestRow {
  scope: string[];
  note: string | null;
}

interface AirportAssignmentRow {
  attendant_name: string | null;
  meeting_point: string | null;
  meeting_at: string | null;
  note: string | null;
}

interface DietaryRequirementRow {
  dietary_code: string;
  note: string | null;
  participant: { first_name: string; last_name: string } | null;
}

export interface VendorTaskRow {
  id: string;
  service_type: string;
  status: string;
  note: string | null;
  confirmation_note: string | null;
  scheduled_at: string | null;
  confirmed_at?: string | null;
  support_type?: string | null;
  delegation: { name: string; event: { name: string } | null; participant?: ParticipantOption[] } | null;
  flight_request?: FlightRequestRow | FlightRequestRow[] | null;
  flight_segment?: FlightSegmentRow[] | null;
  lodging_request?: LodgingRequestRow | LodgingRequestRow[] | null;
  room_assignment?: RoomAssignmentRow[] | null;
  transfer_request?: TransferRequestRow | TransferRequestRow[] | null;
  vehicle_dispatch?: VehicleDispatchRow[] | null;
  airport_request?: AirportRequestRow | AirportRequestRow[] | null;
  airport_assignment?: AirportAssignmentRow[] | null;
  dietary_requirement?: DietaryRequirementRow[] | null;
}

const AIRPORT_SCOPE_LABEL: Record<string, string> = {
  GREETING: "영접 인사",
  FAST_TRACK: "패스트트랙",
  LOUNGE: "라운지",
  BAGGAGE: "수하물 대행",
};

const DIETARY_CODE_LABEL: Record<string, string> = {
  NONE: "일반",
  HALAL: "할랄",
  VEGETARIAN: "채식",
  VEGAN: "비건",
  KOSHER: "코셔",
  ALLERGY: "알레르기",
  OTHER: "기타",
};

const SERVICE_TYPE_LABEL = Object.fromEntries(SERVICE_TYPES.map((t) => [t.value, t.label]));
const TICKET_STATUS_LABEL: Record<string, string> = { BOOKED: "예약", TICKETED: "발권", CANCELLED: "취소" };

function firstOrNull<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

interface SegmentDraft {
  key: string;
  direction: "INBOUND" | "OUTBOUND";
  flightNo: string;
  depAirport: string;
  arrAirport: string;
  depAt: string;
  arrAt: string;
  cabinClass: string;
  pnr: string;
  ticketNo: string;
  ticketStatus: string;
  changeFee: string;
  changeFeeCurrency: string;
}

function toDraft(row: FlightSegmentRow, key: string): SegmentDraft {
  return {
    key,
    direction: row.direction,
    flightNo: row.flight_no ?? "",
    depAirport: row.dep_airport ?? "",
    arrAirport: row.arr_airport ?? "",
    depAt: row.dep_at ? row.dep_at.slice(0, 16) : "",
    arrAt: row.arr_at ? row.arr_at.slice(0, 16) : "",
    cabinClass: row.cabin_class ?? "",
    pnr: row.pnr ?? "",
    ticketNo: row.ticket_no ?? "",
    ticketStatus: row.ticket_status ?? "BOOKED",
    changeFee: row.change_fee != null ? String(row.change_fee) : "",
    changeFeeCurrency: row.change_fee_currency ?? "",
  };
}

function emptyDraft(direction: "INBOUND" | "OUTBOUND"): SegmentDraft {
  return {
    key: `${direction}-${Math.random().toString(36).slice(2)}`,
    direction,
    flightNo: "",
    depAirport: "",
    arrAirport: "",
    depAt: "",
    arrAt: "",
    cabinClass: "",
    pnr: "",
    ticketNo: "",
    ticketStatus: "BOOKED",
    changeFee: "",
    changeFeeCurrency: "",
  };
}

function SegmentEditor({
  title,
  direction,
  segments,
  onChange,
}: {
  title: string;
  direction: "INBOUND" | "OUTBOUND";
  segments: SegmentDraft[];
  onChange: (next: SegmentDraft[]) => void;
}) {
  const rows = segments.filter((s) => s.direction === direction);

  function update(key: string, patch: Partial<SegmentDraft>) {
    onChange(segments.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }
  function remove(key: string) {
    onChange(segments.filter((s) => s.key !== key));
  }
  function add() {
    onChange([...segments, emptyDraft(direction)]);
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{title}</p>
        <Button type="button" variant="ghost" size="sm" onClick={add}>
          <Plus className="size-4" />
          구간 추가
        </Button>
      </div>
      {rows.length === 0 && <p className="text-xs text-muted-foreground">구간을 추가해주세요 (경유가 있으면 여러 구간)</p>}
      {rows.map((s, idx) => (
        <div key={s.key} className="grid grid-cols-2 gap-2 rounded border p-2 sm:grid-cols-4">
          <div className="col-span-2 flex items-center justify-between sm:col-span-4">
            <span className="text-xs text-muted-foreground">구간 {idx + 1}</span>
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(s.key)}>
              <X className="size-3.5" />
            </Button>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">편명</Label>
            <Input value={s.flightNo} onChange={(e) => update(s.key, { flightNo: e.target.value })} placeholder="KE642" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">출발 공항</Label>
            <Input value={s.depAirport} onChange={(e) => update(s.key, { depAirport: e.target.value })} placeholder="HAN" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">도착 공항</Label>
            <Input value={s.arrAirport} onChange={(e) => update(s.key, { arrAirport: e.target.value })} placeholder="ICN" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">좌석 등급</Label>
            <Input value={s.cabinClass} onChange={(e) => update(s.key, { cabinClass: e.target.value })} placeholder="비즈니스" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">출발 일시</Label>
            <Input type="datetime-local" value={s.depAt} onChange={(e) => update(s.key, { depAt: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">도착 일시</Label>
            <Input type="datetime-local" value={s.arrAt} onChange={(e) => update(s.key, { arrAt: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">예약번호(PNR)</Label>
            <Input value={s.pnr} onChange={(e) => update(s.key, { pnr: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">항공권 번호</Label>
            <Input value={s.ticketNo} onChange={(e) => update(s.key, { ticketNo: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">발권 상태</Label>
            <Select value={s.ticketStatus} onValueChange={(v) => update(s.key, { ticketStatus: v ?? "BOOKED" })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TICKET_STATUS_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">변경 수수료</Label>
            <Input value={s.changeFee} onChange={(e) => update(s.key, { changeFee: e.target.value })} placeholder="0" inputMode="decimal" />
          </div>
        </div>
      ))}
    </div>
  );
}

function FlightConfirmForm({ item, onClose }: { item: VendorTaskRow; onClose: () => void }) {
  const flightRequest = firstOrNull(item.flight_request);
  const existing = item.flight_segment ?? [];
  const [segments, setSegments] = useState<SegmentDraft[]>(() => {
    if (existing.length > 0) return existing.map((s, i) => toDraft(s, `existing-${i}`));
    return [emptyDraft("INBOUND"), emptyDraft("OUTBOUND")];
  });

  return (
    <form
      action={saveFlightSegments}
      onSubmit={onClose}
      className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto"
    >
      <input type="hidden" name="id" value={item.id} />
      <input type="hidden" name="segments" value={JSON.stringify(segments)} />

      {flightRequest && (
        <div className="rounded-md bg-muted/50 p-3 text-sm">
          <p className="font-medium">대리인 요청 내용</p>
          <p className="text-muted-foreground">
            입국: {flightRequest.inbound_origin_city ?? "-"} → {flightRequest.inbound_dest_airport ?? "-"} ({flightRequest.inbound_preferred_date ?? "미정"})
          </p>
          <p className="text-muted-foreground">
            귀국: {flightRequest.outbound_origin_airport ?? "-"} → {flightRequest.outbound_dest_city ?? "-"} ({flightRequest.outbound_preferred_date ?? "미정"})
          </p>
          {flightRequest.note && <p className="text-muted-foreground">메모: {flightRequest.note}</p>}
        </div>
      )}

      <SegmentEditor title="입국 구간" direction="INBOUND" segments={segments} onChange={setSegments} />
      <SegmentEditor title="귀국 구간" direction="OUTBOUND" segments={segments} onChange={setSegments} />

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>취소</DialogClose>
        <Button type="submit">확정</Button>
      </DialogFooter>
    </form>
  );
}

interface RoomDraft {
  key: string;
  hotelName: string;
  roomType: string;
  participantIds: string[];
  checkInAt: string;
  checkOutAt: string;
  confirmationNo: string;
  roomNo: string;
  note: string;
}

function toRoomDraft(row: RoomAssignmentRow, key: string): RoomDraft {
  return {
    key,
    hotelName: row.hotel_name ?? "",
    roomType: row.room_type ?? "",
    participantIds: row.participant_ids ?? [],
    checkInAt: row.check_in_at ? row.check_in_at.slice(0, 16) : "",
    checkOutAt: row.check_out_at ? row.check_out_at.slice(0, 16) : "",
    confirmationNo: row.confirmation_no ?? "",
    roomNo: row.room_no ?? "",
    note: row.note ?? "",
  };
}

function emptyRoomDraft(): RoomDraft {
  return {
    key: `room-${Math.random().toString(36).slice(2)}`,
    hotelName: "",
    roomType: "",
    participantIds: [],
    checkInAt: "",
    checkOutAt: "",
    confirmationNo: "",
    roomNo: "",
    note: "",
  };
}

function RoomEditor({
  rooms,
  onChange,
  participants,
}: {
  rooms: RoomDraft[];
  onChange: (next: RoomDraft[]) => void;
  participants: ParticipantOption[];
}) {
  function update(key: string, patch: Partial<RoomDraft>) {
    onChange(rooms.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function remove(key: string) {
    onChange(rooms.filter((r) => r.key !== key));
  }
  function toggleParticipant(key: string, participantId: string, checked: boolean) {
    const room = rooms.find((r) => r.key === key);
    if (!room) return;
    const next = checked
      ? [...room.participantIds, participantId]
      : room.participantIds.filter((id) => id !== participantId);
    update(key, { participantIds: next });
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">객실</p>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange([...rooms, emptyRoomDraft()])}>
          <Plus className="size-4" />
          객실 추가
        </Button>
      </div>
      {rooms.length === 0 && <p className="text-xs text-muted-foreground">객실을 추가해주세요 (한 대표단이 여러 객실을 쓸 수 있음)</p>}
      {rooms.map((r, idx) => (
        <div key={r.key} className="grid grid-cols-2 gap-2 rounded border p-2 sm:grid-cols-4">
          <div className="col-span-2 flex items-center justify-between sm:col-span-4">
            <span className="text-xs text-muted-foreground">객실 {idx + 1}</span>
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(r.key)}>
              <X className="size-3.5" />
            </Button>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">호텔</Label>
            <Input value={r.hotelName} onChange={(e) => update(r.key, { hotelName: e.target.value })} placeholder="롯데호텔 서울" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">객실 타입</Label>
            <Input value={r.roomType} onChange={(e) => update(r.key, { roomType: e.target.value })} placeholder="디럭스 트윈" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">체크인</Label>
            <Input type="datetime-local" value={r.checkInAt} onChange={(e) => update(r.key, { checkInAt: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">체크아웃</Label>
            <Input type="datetime-local" value={r.checkOutAt} onChange={(e) => update(r.key, { checkOutAt: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">예약번호</Label>
            <Input value={r.confirmationNo} onChange={(e) => update(r.key, { confirmationNo: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">객실 번호 (선택)</Label>
            <Input value={r.roomNo} onChange={(e) => update(r.key, { roomNo: e.target.value })} />
          </div>
          <div className="col-span-2 flex flex-col gap-1 sm:col-span-4">
            <Label className="text-xs">요청 반영 메모</Label>
            <Input value={r.note} onChange={(e) => update(r.key, { note: e.target.value })} placeholder="얼리 체크인 등" />
          </div>
          <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-4">
            <Label className="text-xs">투숙 참가자</Label>
            <div className="flex flex-wrap gap-3">
              {participants.length === 0 && <p className="text-xs text-muted-foreground">참가자 정보가 없습니다.</p>}
              {participants.map((p) => (
                <div key={p.id} className="flex items-center gap-1.5">
                  <Checkbox
                    id={`${r.key}-${p.id}`}
                    checked={r.participantIds.includes(p.id)}
                    onCheckedChange={(checked) => toggleParticipant(r.key, p.id, checked === true)}
                  />
                  <Label htmlFor={`${r.key}-${p.id}`} className="text-xs font-normal">
                    {p.last_name} {p.first_name}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function LodgingConfirmForm({ item, onClose }: { item: VendorTaskRow; onClose: () => void }) {
  const lodgingRequest = firstOrNull(item.lodging_request);
  const existing = item.room_assignment ?? [];
  const participants = item.delegation?.participant ?? [];
  const [rooms, setRooms] = useState<RoomDraft[]>(() => {
    if (existing.length > 0) return existing.map((r, i) => toRoomDraft(r, `existing-${i}`));
    return [emptyRoomDraft()];
  });

  return (
    <form action={saveRoomAssignments} onSubmit={onClose} className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto">
      <input type="hidden" name="id" value={item.id} />
      <input type="hidden" name="rooms" value={JSON.stringify(rooms)} />

      {lodgingRequest && (
        <div className="rounded-md bg-muted/50 p-3 text-sm">
          <p className="font-medium">대리인 요청 내용</p>
          <p className="text-muted-foreground">
            체크인 희망 {lodgingRequest.check_in_preferred_date ?? "미정"} · 체크아웃 희망 {lodgingRequest.check_out_preferred_date ?? "미정"}
          </p>
          {lodgingRequest.room_grouping_note && <p className="text-muted-foreground">객실 구성: {lodgingRequest.room_grouping_note}</p>}
          {lodgingRequest.note && <p className="text-muted-foreground">특이 요청: {lodgingRequest.note}</p>}
        </div>
      )}

      <RoomEditor rooms={rooms} onChange={setRooms} participants={participants} />

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>취소</DialogClose>
        <Button type="submit">확정</Button>
      </DialogFooter>
    </form>
  );
}

interface VehicleDraft {
  key: string;
  fromText: string;
  toText: string;
  departAt: string;
  vehicleClass: string;
  plateNo: string;
  driverName: string;
  driverPhone: string;
  participantIds: string[];
  luggageNote: string;
}

function toVehicleDraft(row: VehicleDispatchRow, key: string): VehicleDraft {
  return {
    key,
    fromText: row.from_text ?? "",
    toText: row.to_text ?? "",
    departAt: row.depart_at ? row.depart_at.slice(0, 16) : "",
    vehicleClass: row.vehicle_class ?? "",
    plateNo: row.plate_no ?? "",
    driverName: row.driver_name ?? "",
    driverPhone: row.driver_phone ?? "",
    participantIds: row.participant_ids ?? [],
    luggageNote: row.luggage_note ?? "",
  };
}

function emptyVehicleDraft(transferRequest: TransferRequestRow | null): VehicleDraft {
  return {
    key: `vehicle-${Math.random().toString(36).slice(2)}`,
    fromText: transferRequest?.from_text ?? "",
    toText: transferRequest?.to_text ?? "",
    departAt: transferRequest?.scheduled_at ? transferRequest.scheduled_at.slice(0, 16) : "",
    vehicleClass: "",
    plateNo: "",
    driverName: "",
    driverPhone: "",
    participantIds: transferRequest?.participant_ids ?? [],
    luggageNote: transferRequest?.luggage_note ?? "",
  };
}

function VehicleEditor({
  vehicles,
  onChange,
  participants,
}: {
  vehicles: VehicleDraft[];
  onChange: (next: VehicleDraft[]) => void;
  participants: ParticipantOption[];
}) {
  function update(key: string, patch: Partial<VehicleDraft>) {
    onChange(vehicles.map((v) => (v.key === key ? { ...v, ...patch } : v)));
  }
  function remove(key: string) {
    onChange(vehicles.filter((v) => v.key !== key));
  }
  function toggleParticipant(key: string, participantId: string, checked: boolean) {
    const vehicle = vehicles.find((v) => v.key === key);
    if (!vehicle) return;
    const next = checked
      ? [...vehicle.participantIds, participantId]
      : vehicle.participantIds.filter((id) => id !== participantId);
    update(key, { participantIds: next });
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">차량</p>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange([...vehicles, emptyVehicleDraft(null)])}>
          <Plus className="size-4" />
          차량 추가
        </Button>
      </div>
      {vehicles.length === 0 && <p className="text-xs text-muted-foreground">차량을 추가해주세요 (대표단이 여러 차량을 쓸 수 있음)</p>}
      {vehicles.map((v, idx) => (
        <div key={v.key} className="grid grid-cols-2 gap-2 rounded border p-2 sm:grid-cols-4">
          <div className="col-span-2 flex items-center justify-between sm:col-span-4">
            <span className="text-xs text-muted-foreground">차량 {idx + 1}</span>
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(v.key)}>
              <X className="size-3.5" />
            </Button>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">출발지</Label>
            <Input value={v.fromText} onChange={(e) => update(v.key, { fromText: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">도착지</Label>
            <Input value={v.toText} onChange={(e) => update(v.key, { toText: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">출발 시각</Label>
            <Input type="datetime-local" value={v.departAt} onChange={(e) => update(v.key, { departAt: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">차종</Label>
            <Input value={v.vehicleClass} onChange={(e) => update(v.key, { vehicleClass: e.target.value })} placeholder="세단, 밴 등" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">차량 번호</Label>
            <Input value={v.plateNo} onChange={(e) => update(v.key, { plateNo: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">기사 이름</Label>
            <Input value={v.driverName} onChange={(e) => update(v.key, { driverName: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">기사 연락처</Label>
            <Input value={v.driverPhone} onChange={(e) => update(v.key, { driverPhone: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">짐 규모</Label>
            <Input value={v.luggageNote} onChange={(e) => update(v.key, { luggageNote: e.target.value })} placeholder="캐리어 4개 등" />
          </div>
          <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-4">
            <Label className="text-xs">탑승 참가자</Label>
            <div className="flex flex-wrap gap-3">
              {participants.length === 0 && <p className="text-xs text-muted-foreground">참가자 정보가 없습니다.</p>}
              {participants.map((p) => (
                <div key={p.id} className="flex items-center gap-1.5">
                  <Checkbox
                    id={`${v.key}-${p.id}`}
                    checked={v.participantIds.includes(p.id)}
                    onCheckedChange={(checked) => toggleParticipant(v.key, p.id, checked === true)}
                  />
                  <Label htmlFor={`${v.key}-${p.id}`} className="text-xs font-normal">
                    {p.last_name} {p.first_name}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TransferConfirmForm({ item, onClose }: { item: VendorTaskRow; onClose: () => void }) {
  const transferRequest = firstOrNull(item.transfer_request);
  const existing = item.vehicle_dispatch ?? [];
  const participants = item.delegation?.participant ?? [];
  const [vehicles, setVehicles] = useState<VehicleDraft[]>(() => {
    if (existing.length > 0) return existing.map((v, i) => toVehicleDraft(v, `existing-${i}`));
    return [emptyVehicleDraft(transferRequest)];
  });

  return (
    <form action={saveVehicleDispatches} onSubmit={onClose} className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto">
      <input type="hidden" name="id" value={item.id} />
      <input type="hidden" name="vehicles" value={JSON.stringify(vehicles)} />

      {transferRequest && (
        <div className="rounded-md bg-muted/50 p-3 text-sm">
          <p className="font-medium">자동 생성된 수송 요청 ({transferRequest.direction === "INBOUND" ? "입국" : "귀국"})</p>
          <p className="text-muted-foreground">
            {transferRequest.from_text} → {transferRequest.to_text} · 희망 시각{" "}
            {transferRequest.scheduled_at ? formatDateTime(transferRequest.scheduled_at, "ko") : "미정"}
          </p>
          <p className="text-muted-foreground">탑승 인원 {transferRequest.participant_ids.length}명 (항공편 확정 기준 자동 산정, 필요시 아래에서 조정)</p>
        </div>
      )}

      <VehicleEditor vehicles={vehicles} onChange={setVehicles} participants={participants} />

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>취소</DialogClose>
        <Button type="submit">확정</Button>
      </DialogFooter>
    </form>
  );
}

function AirportConfirmForm({ item, onClose }: { item: VendorTaskRow; onClose: () => void }) {
  const airportRequest = firstOrNull(item.airport_request);
  const existing = firstOrNull(item.airport_assignment ?? null);

  return (
    <form action={saveAirportAssignment} onSubmit={onClose} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={item.id} />

      {airportRequest && (
        <div className="rounded-md bg-muted/50 p-3 text-sm">
          <p className="font-medium">PCO 지정 의전 범위</p>
          <p className="text-muted-foreground">
            {airportRequest.scope.length > 0
              ? airportRequest.scope.map((s) => AIRPORT_SCOPE_LABEL[s] ?? s).join(" · ")
              : "지정된 범위 없음"}
          </p>
          {airportRequest.note && <p className="text-muted-foreground">메모: {airportRequest.note}</p>}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="attendantName">담당 요원</Label>
        <Input id="attendantName" name="attendantName" defaultValue={existing?.attendant_name ?? ""} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="meetingPoint">만남 장소</Label>
        <Input id="meetingPoint" name="meetingPoint" defaultValue={existing?.meeting_point ?? ""} placeholder="예: 입국장 3번 게이트" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="meetingAt">만남 시각</Label>
        <Input
          id="meetingAt"
          name="meetingAt"
          type="datetime-local"
          defaultValue={existing?.meeting_at ? existing.meeting_at.slice(0, 16) : ""}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="airportNote">메모</Label>
        <Textarea id="airportNote" name="note" defaultValue={existing?.note ?? ""} />
      </div>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>취소</DialogClose>
        <Button type="submit">확정</Button>
      </DialogFooter>
    </form>
  );
}

function DietaryConfirmForm({ item, onClose }: { item: VendorTaskRow; onClose: () => void }) {
  const requirements = item.dietary_requirement ?? [];

  return (
    <form action={confirmServiceItem} onSubmit={onClose} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={item.id} />

      {requirements.length > 0 && (
        <div className="rounded-md bg-muted/50 p-3 text-sm">
          <p className="font-medium">참가자별 식이 요구</p>
          <ul className="mt-1 space-y-0.5 text-muted-foreground">
            {requirements.map((r, i) => (
              <li key={i}>
                {r.participant?.last_name} {r.participant?.first_name} — {DIETARY_CODE_LABEL[r.dietary_code] ?? r.dietary_code}
                {r.note && ` (${r.note})`}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <Label htmlFor="confirmationNote">반영 확인 메모</Label>
        <Textarea id="confirmationNote" name="confirmationNote" defaultValue={item.confirmation_note ?? ""} className="mt-1.5" />
      </div>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>취소</DialogClose>
        <Button type="submit">반영 확인</Button>
      </DialogFooter>
    </form>
  );
}

function GenericConfirmForm({ item, onClose }: { item: VendorTaskRow; onClose: () => void }) {
  return (
    <form action={confirmServiceItem} onSubmit={onClose}>
      <input type="hidden" name="id" value={item.id} />
      <div className="py-4">
        <Label htmlFor="confirmationNote">확정 내용 (편명·예약번호 등)</Label>
        <Textarea id="confirmationNote" name="confirmationNote" defaultValue={item.confirmation_note ?? ""} className="mt-1.5" />
      </div>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>취소</DialogClose>
        <Button type="submit">확정</Button>
      </DialogFooter>
    </form>
  );
}

function ConfirmDialog({ item, open, onOpenChange }: { item: VendorTaskRow; open: boolean; onOpenChange: (v: boolean) => void }) {
  const close = () => onOpenChange(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>확정 정보 입력</DialogTitle>
        </DialogHeader>
        {item.service_type === "FLIGHT" ? (
          <FlightConfirmForm item={item} onClose={close} />
        ) : item.service_type === "LODGING" ? (
          <LodgingConfirmForm item={item} onClose={close} />
        ) : item.service_type === "TRANSFER" ? (
          <TransferConfirmForm item={item} onClose={close} />
        ) : item.service_type === "AIRPORT" ? (
          <AirportConfirmForm item={item} onClose={close} />
        ) : item.service_type === "DIETARY" ? (
          <DietaryConfirmForm item={item} onClose={close} />
        ) : (
          <GenericConfirmForm item={item} onClose={close} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TaskRow({ item, readOnly }: { item: VendorTaskRow; readOnly: boolean }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <article className="rounded-xl border bg-background shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div className="min-w-0"><p className="mb-1 text-xs text-muted-foreground">{item.delegation?.event?.name}</p><h3 className="text-base font-semibold">{item.delegation?.name}</h3></div>
        <div className="flex items-center gap-2"><span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">{SERVICE_TYPE_LABEL[item.service_type]}</span><StatusBadge status={SERVICE_STATUS_BADGE[item.status]}>{SERVICE_STATUS_LABEL[item.status]}</StatusBadge></div>
      </div>
      <div className="grid items-center gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <div className="min-w-0"><p className="mb-2 text-xs font-medium text-muted-foreground">요청 여정 · 주요 내용</p><p className="break-words text-base font-semibold leading-7">{serviceSummary(item)}</p>{item.flight_request && <p className="mt-1 text-sm text-muted-foreground">{firstOrNull(item.flight_request)?.note || "추가 요청 메모 없음"}</p>}</div>
        <div className="space-y-2 text-sm"><p className="flex items-start gap-2"><CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" />{item.scheduled_at ? formatDateTime(item.scheduled_at, "ko") : "희망 일정 미입력"}</p><p className="flex items-center gap-2 text-muted-foreground"><Users className="size-4" />참가자 {item.delegation?.participant?.length ?? 0}명</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <ServiceDetailDialog item={item} />
          {!readOnly && item.status === "REQUESTED" && (
          <form action={startServiceItem}>
            <input type="hidden" name="id" value={item.id} />
            <Button type="submit" size="sm">업무 시작</Button>
          </form>
        )}
        {!readOnly && ["IN_PROGRESS", "CHANGING", "CONFIRMED", "NOTIFIED"].includes(item.status) && (
          <Button size="sm" onClick={() => setConfirmOpen(true)}>{["CONFIRMED", "NOTIFIED"].includes(item.status) ? "확정 내용 수정" : "확정 입력"}</Button>
        )}
        </div>
      </div>
      {!readOnly && <ConfirmDialog item={item} open={confirmOpen} onOpenChange={setConfirmOpen} />}
    </article>
  );
}

export function TaskList({ items, readOnly = false }: { items: VendorTaskRow[]; readOnly?: boolean }) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("ALL");
  const [refreshing, startRefresh] = useTransition();
  const router = useRouter();
  const groups = [
    { key: "ALL", label: "전체 업무", states: null },
    { key: "ACTION", label: "확인 필요", states: ["REQUESTED", "CHANGING", "CANCEL_REQ"] },
    { key: "PROGRESS", label: "처리 중", states: ["IN_PROGRESS"] },
    { key: "DONE", label: "확정 완료", states: ["CONFIRMED", "NOTIFIED"] },
  ];
  const selected = groups.find((g) => g.key === group)!;
  const priority: Record<string, number> = { CHANGING: 0, CANCEL_REQ: 1, REQUESTED: 2, IN_PROGRESS: 3, CONFIRMED: 4, NOTIFIED: 5 };
  const visible = items.filter((item) => (!selected.states || selected.states.includes(item.status)) &&
    `${item.delegation?.name} ${item.delegation?.event?.name} ${serviceSummary(item)} ${item.note} ${firstOrNull(item.flight_request)?.note ?? ""} ${(item.flight_segment ?? []).map((f) => f.flight_no).join(" ")}`.toLowerCase().includes(query.trim().toLowerCase()))
    .toSorted((a, b) => (priority[a.status] ?? 9) - (priority[b.status] ?? 9));
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
        아직 배정된 요청이 없습니다.
      </p>
    );
  }

  return <div className="space-y-5">
    {!readOnly && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{groups.map((g) => <button key={g.key} type="button" onClick={() => setGroup(g.key)} aria-pressed={group === g.key} className={`rounded-xl border bg-background p-4 text-left transition-colors hover:border-primary/50 ${group === g.key ? "border-primary ring-1 ring-primary" : ""}`}><span className="text-sm text-muted-foreground">{g.label}</span><span className="mt-2 block text-3xl font-semibold tabular-nums">{items.filter((i) => !g.states || g.states.includes(i.status)).length}</span></button>)}</div>}
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background p-4">
      <div className="relative w-full sm:max-w-md"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="대표단·노선·편명 검색" placeholder="대표단, 노선 또는 편명으로 검색" className="h-10 pl-9" /></div>
      <div className="flex items-center gap-3"><span className="text-sm text-muted-foreground">{visible.length}건</span><Button variant="outline" size="sm" disabled={refreshing} onClick={() => startRefresh(() => router.refresh())}><RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />새로고침</Button></div>
    </div>
    <div className="space-y-4">{visible.map((item) => <TaskRow key={item.id} item={item} readOnly={readOnly} />)}</div>
    {visible.length === 0 && <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">조건에 맞는 업무가 없습니다.</p>}
  </div>;
}
