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

export interface VendorTaskRow {
  id: string;
  service_type: string;
  status: string;
  note: string | null;
  confirmation_note: string | null;
  scheduled_at: string | null;
  delegation: { name: string; event: { name: string } | null } | null;
  flight_request?: FlightRequestRow | FlightRequestRow[] | null;
  flight_segment?: FlightSegmentRow[] | null;
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
