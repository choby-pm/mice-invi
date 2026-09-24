"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  direction: "INBOUND" | "OUTBOUND";
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

export interface VendorTaskRow {
  id: string;
  service_type: string;
  status: string;
  note: string | null;
  confirmation_note: string | null;
  scheduled_at: string | null;
  delegation: { name: string; event: { name: string } | null; participant?: ParticipantOption[] } | null;
  flight_request?: FlightRequestRow | FlightRequestRow[] | null;
  flight_segment?: FlightSegmentRow[] | null;
  lodging_request?: LodgingRequestRow | LodgingRequestRow[] | null;
  room_assignment?: RoomAssignmentRow[] | null;
  transfer_request?: TransferRequestRow | TransferRequestRow[] | null;
  vehicle_dispatch?: VehicleDispatchRow[] | null;
}

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
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>확정 정보 입력</DialogTitle>
        </DialogHeader>
        {item.service_type === "FLIGHT" ? (
          <FlightConfirmForm item={item} onClose={close} />
        ) : item.service_type === "LODGING" ? (
          <LodgingConfirmForm item={item} onClose={close} />
        ) : item.service_type === "TRANSFER" ? (
          <TransferConfirmForm item={item} onClose={close} />
        ) : (
          <GenericConfirmForm item={item} onClose={close} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TaskRow({ item }: { item: VendorTaskRow }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <TableRow>
      <TableCell className="text-muted-foreground">{item.delegation?.event?.name}</TableCell>
      <TableCell>{item.delegation?.name}</TableCell>
      <TableCell>{SERVICE_TYPE_LABEL[item.service_type]}</TableCell>
      <TableCell>
        <StatusBadge status={SERVICE_STATUS_BADGE[item.status]}>{SERVICE_STATUS_LABEL[item.status]}</StatusBadge>
      </TableCell>
      <TableCell className="max-w-48 truncate text-muted-foreground">{item.note ?? "-"}</TableCell>
      <TableCell className="text-muted-foreground">
        {item.scheduled_at ? formatDateTime(item.scheduled_at, "ko") : "-"}
      </TableCell>
      <TableCell>
        {item.status === "REQUESTED" && (
          <form action={startServiceItem}>
            <input type="hidden" name="id" value={item.id} />
            <Button type="submit" size="sm" variant="outline">착수</Button>
          </form>
        )}
        {item.status === "IN_PROGRESS" && (
          <Button size="sm" onClick={() => setConfirmOpen(true)}>확정 입력</Button>
        )}
        {item.status === "CONFIRMED" && item.confirmation_note && (
          <span className="text-xs text-muted-foreground">{item.confirmation_note}</span>
        )}
      </TableCell>
      <ConfirmDialog item={item} open={confirmOpen} onOpenChange={setConfirmOpen} />
    </TableRow>
  );
}

export function TaskList({ items }: { items: VendorTaskRow[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
        아직 배정된 요청이 없습니다.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>행사</TableHead>
          <TableHead>대표단</TableHead>
          <TableHead>분야</TableHead>
          <TableHead>상태</TableHead>
          <TableHead>요청 내용</TableHead>
          <TableHead>희망 시각</TableHead>
          <TableHead className="w-32" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TaskRow key={item.id} item={item} />
        ))}
      </TableBody>
    </Table>
  );
}
