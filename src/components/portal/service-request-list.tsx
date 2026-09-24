"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";
import { submitServiceRequest } from "@/server/modules/service-item/portal-actions";
import { saveFlightRequest } from "@/server/modules/service-item/flight-actions";
import { saveLodgingRequest } from "@/server/modules/service-item/lodging-actions";
import { saveDietaryRequirements } from "@/server/modules/service-item/dietary-actions";
import {
  SERVICE_TYPES,
  SERVICE_TYPE_COLUMN_LABELS,
  SERVICE_STATUS_LABEL,
  SERVICE_STATUS_BADGE,
} from "@/lib/service-item-constants";

const DIETARY_CODE_LABEL: Record<string, string> = {
  NONE: "일반",
  HALAL: "할랄",
  VEGETARIAN: "채식",
  VEGAN: "비건",
  KOSHER: "코셔",
  ALLERGY: "알레르기",
  OTHER: "기타",
};

interface FlightRequestRow {
  inbound_origin_city: string | null;
  inbound_dest_airport: string | null;
  inbound_preferred_date: string | null;
  outbound_preferred_date: string | null;
  outbound_origin_airport: string | null;
  outbound_dest_city: string | null;
  note: string | null;
}

interface LodgingRequestRow {
  check_in_preferred_date: string | null;
  check_out_preferred_date: string | null;
  room_grouping_note: string | null;
  note: string | null;
}

interface DietaryRequirementRow {
  participant_id: string;
  dietary_code: string;
  note: string | null;
}

interface ParticipantOption {
  id: string;
  first_name: string;
  last_name: string;
}

interface ServiceItemRow {
  id: string;
  service_type: string;
  status: string;
  note: string | null;
  scheduled_at: string | null;
  flight_request?: FlightRequestRow | FlightRequestRow[] | null;
  lodging_request?: LodgingRequestRow | LodgingRequestRow[] | null;
  dietary_requirement?: DietaryRequirementRow[] | null;
}

function firstOrNull<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function FlightRequestFields({ item, flightRequest }: { item: ServiceItemRow; flightRequest: FlightRequestRow | null }) {
  const idOf = (name: string) => `${name}-${item.id}`;
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={idOf("inboundOriginCity")}>입국 출발 도시</Label>
          <Input
            id={idOf("inboundOriginCity")}
            name="inboundOriginCity"
            defaultValue={flightRequest?.inbound_origin_city ?? ""}
            placeholder="예: 하노이"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={idOf("inboundDestAirport")}>입국 도착 공항</Label>
          <Input
            id={idOf("inboundDestAirport")}
            name="inboundDestAirport"
            defaultValue={flightRequest?.inbound_dest_airport ?? ""}
            placeholder="예: ICN"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={idOf("inboundPreferredDate")}>희망 입국일</Label>
          <Input
            id={idOf("inboundPreferredDate")}
            name="inboundPreferredDate"
            type="date"
            defaultValue={flightRequest?.inbound_preferred_date ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={idOf("outboundPreferredDate")}>희망 귀국일</Label>
          <Input
            id={idOf("outboundPreferredDate")}
            name="outboundPreferredDate"
            type="date"
            defaultValue={flightRequest?.outbound_preferred_date ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={idOf("outboundOriginAirport")}>귀국 출발 공항</Label>
          <Input
            id={idOf("outboundOriginAirport")}
            name="outboundOriginAirport"
            defaultValue={flightRequest?.outbound_origin_airport ?? ""}
            placeholder="예: ICN"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={idOf("outboundDestCity")}>귀국 도착 도시</Label>
          <Input
            id={idOf("outboundDestCity")}
            name="outboundDestCity"
            defaultValue={flightRequest?.outbound_dest_city ?? ""}
            placeholder="예: 하노이"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={idOf("note")}>요청 메모</Label>
        <Textarea
          id={idOf("note")}
          name="note"
          defaultValue={flightRequest?.note ?? ""}
          placeholder="선호 항공사, 시간대 등"
        />
      </div>
    </>
  );
}

function LodgingRequestFields({ item, lodgingRequest }: { item: ServiceItemRow; lodgingRequest: LodgingRequestRow | null }) {
  const idOf = (name: string) => `${name}-${item.id}`;
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={idOf("checkInPreferredDate")}>체크인 희망일</Label>
          <Input
            id={idOf("checkInPreferredDate")}
            name="checkInPreferredDate"
            type="date"
            defaultValue={lodgingRequest?.check_in_preferred_date ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={idOf("checkOutPreferredDate")}>체크아웃 희망일</Label>
          <Input
            id={idOf("checkOutPreferredDate")}
            name="checkOutPreferredDate"
            type="date"
            defaultValue={lodgingRequest?.check_out_preferred_date ?? ""}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={idOf("roomGroupingNote")}>객실 구성 (누가 같은 방을 쓰는지)</Label>
        <Textarea
          id={idOf("roomGroupingNote")}
          name="roomGroupingNote"
          defaultValue={lodgingRequest?.room_grouping_note ?? ""}
          placeholder="예: VIP + 배우자 동숙, 수행원 2명 별도 트윈룸"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={idOf("note")}>특이 요청</Label>
        <Textarea
          id={idOf("note")}
          name="note"
          defaultValue={lodgingRequest?.note ?? ""}
          placeholder="얼리 체크인, 금연룸 등"
        />
      </div>
    </>
  );
}

function DietaryRequestForm({
  item,
  participants,
  revalidateTo,
  submitted,
  onDone,
}: {
  item: ServiceItemRow;
  participants: ParticipantOption[];
  revalidateTo: string;
  submitted: boolean;
  onDone: () => void;
}) {
  const existing = item.dietary_requirement ?? [];
  const [entries, setEntries] = useState(() =>
    participants.map((p) => {
      const found = existing.find((e) => e.participant_id === p.id);
      return { participantId: p.id, dietaryCode: found?.dietary_code ?? "NONE", note: found?.note ?? "" };
    }),
  );

  function update(participantId: string, patch: Partial<{ dietaryCode: string; note: string }>) {
    setEntries((prev) => prev.map((e) => (e.participantId === participantId ? { ...e, ...patch } : e)));
  }

  return (
    <form action={saveDietaryRequirements} onSubmit={onDone} className="flex flex-col gap-3">
      <input type="hidden" name="serviceItemId" value={item.id} />
      <input type="hidden" name="revalidateTo" value={revalidateTo} />
      <input type="hidden" name="entries" value={JSON.stringify(entries)} />
      {participants.length === 0 ? (
        <p className="text-sm text-muted-foreground">참가자를 먼저 추가해주세요.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {participants.map((p) => {
            const entry = entries.find((e) => e.participantId === p.id)!;
            return (
              <div key={p.id} className="rounded-md border p-2">
                <p className="text-sm font-medium">{p.last_name} {p.first_name}</p>
                <div className="mt-1.5 flex flex-col gap-1.5 sm:flex-row">
                  <Select value={entry.dietaryCode} onValueChange={(v) => update(p.id, { dietaryCode: v ?? "NONE" })}>
                    <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(DIETARY_CODE_LABEL).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={entry.note}
                    onChange={(e) => update(p.id, { note: e.target.value })}
                    placeholder="예: 견과류 알레르기"
                    className="flex-1"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>취소</Button>
        <Button type="submit" size="sm">{submitted ? "저장" : "요청 제출"}</Button>
      </div>
    </form>
  );
}

function ServiceRequestCard({
  item,
  participants,
  revalidateTo,
}: {
  item: ServiceItemRow;
  participants: ParticipantOption[];
  revalidateTo: string;
}) {
  const [open, setOpen] = useState(false);
  const typeInfo = SERVICE_TYPES.find((t) => t.value === item.service_type);
  const columns = SERVICE_TYPE_COLUMN_LABELS[item.service_type];
  const submitted = item.status !== "DRAFT";
  const isFlight = item.service_type === "FLIGHT";
  const isLodging = item.service_type === "LODGING";
  // 수송은 대리인이 요청하지 않고 항공 확정 결과로 시스템이 자동 생성합니다(P08) — 그래서
  // 편집 버튼 없이 확정 결과만 보여줍니다.
  const isTransfer = item.service_type === "TRANSFER";
  const isDietary = item.service_type === "DIETARY";
  const flightRequest = firstOrNull(item.flight_request);
  const lodgingRequest = firstOrNull(item.lodging_request);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{typeInfo?.label}</CardTitle>
        <StatusBadge status={SERVICE_STATUS_BADGE[item.status]}>{SERVICE_STATUS_LABEL[item.status]}</StatusBadge>
      </CardHeader>
      <CardContent className="space-y-3">
        {isTransfer ? (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {item.note ?? "항공편이 확정되면 자동으로 생성됩니다."}
          </p>
        ) : !open ? (
          <div className="space-y-2">
            {item.note && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.note}</p>}
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
              {submitted ? "요청 내용 수정" : "요청 입력"}
            </Button>
          </div>
        ) : isFlight ? (
          <form action={saveFlightRequest} onSubmit={() => setOpen(false)} className="flex flex-col gap-3">
            <input type="hidden" name="serviceItemId" value={item.id} />
            <input type="hidden" name="revalidateTo" value={revalidateTo} />
            <FlightRequestFields item={item} flightRequest={flightRequest} />
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>취소</Button>
              <Button type="submit" size="sm">{submitted ? "저장" : "요청 제출"}</Button>
            </div>
          </form>
        ) : isLodging ? (
          <form action={saveLodgingRequest} onSubmit={() => setOpen(false)} className="flex flex-col gap-3">
            <input type="hidden" name="serviceItemId" value={item.id} />
            <input type="hidden" name="revalidateTo" value={revalidateTo} />
            <LodgingRequestFields item={item} lodgingRequest={lodgingRequest} />
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>취소</Button>
              <Button type="submit" size="sm">{submitted ? "저장" : "요청 제출"}</Button>
            </div>
          </form>
        ) : isDietary ? (
          <DietaryRequestForm
            item={item}
            participants={participants}
            revalidateTo={revalidateTo}
            submitted={submitted}
            onDone={() => setOpen(false)}
          />
        ) : (
          <form
            action={submitServiceRequest}
            onSubmit={() => setOpen(false)}
            className="flex flex-col gap-3"
          >
            <input type="hidden" name="serviceItemId" value={item.id} />
            <input type="hidden" name="revalidateTo" value={revalidateTo} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`scheduledAt-${item.id}`}>{columns.scheduled}</Label>
              <Input
                id={`scheduledAt-${item.id}`}
                name="scheduledAt"
                type="datetime-local"
                defaultValue={item.scheduled_at ? item.scheduled_at.slice(0, 16) : ""}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`note-${item.id}`}>요청 내용</Label>
              <Textarea id={`note-${item.id}`} name="note" defaultValue={item.note ?? ""} placeholder="예: 출발지, 희망 일정, 선호 사항 등" />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>취소</Button>
              <Button type="submit" size="sm">{submitted ? "저장" : "요청 제출"}</Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export function ServiceRequestList({
  items,
  participants,
  revalidateTo,
}: {
  items: ServiceItemRow[];
  participants: ParticipantOption[];
  revalidateTo: string;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">서비스 요청</h2>
      <div className="space-y-3">
        {items.map((item) => (
          <ServiceRequestCard key={item.id} item={item} participants={participants} revalidateTo={revalidateTo} />
        ))}
      </div>
    </div>
  );
}
