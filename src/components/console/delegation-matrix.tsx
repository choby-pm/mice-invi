import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  SERVICE_TYPES,
  SERVICE_STATUS_LABEL,
  SERVICE_STATUS_BADGE,
} from "@/lib/service-item-constants";

interface RoomAssignmentRow {
  hotel_name: string;
  room_type: string | null;
  participant_ids: string[];
}
interface VehicleDispatchRow {
  participant_ids: string[];
}
interface TransferRequestRow {
  direction: "INBOUND" | "OUTBOUND" | "PROGRAM";
  participant_ids: string[];
}

export interface MatrixServiceItem {
  id: string;
  service_type: string;
  status: string;
  room_assignment?: RoomAssignmentRow[] | null;
  vehicle_dispatch?: VehicleDispatchRow[] | null;
  transfer_request?: TransferRequestRow | TransferRequestRow[] | null;
}

interface ParticipantRow {
  id: string;
  first_name: string;
  last_name: string;
  participant_type: string;
}

const PARTICIPANT_TYPE_LABEL: Record<string, string> = { VIP: "VIP", COMPANION: "동반", STAFF: "수행" };

function firstOrNull<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export function ServiceCell({ items, participantId }: { items: MatrixServiceItem[]; participantId: string }) {
  if (items.length === 0) {
    return <span className="text-xs text-muted-foreground">-</span>;
  }

  const type = items[0].service_type;

  if (type === "TRANSFER") {
    return (
      <div className="flex flex-col gap-1">
        {items.map((item) => {
          const tr = firstOrNull(item.transfer_request);
          const inDispatch = (item.vehicle_dispatch ?? []).some((v) => v.participant_ids.includes(participantId));
          const inRequest = tr?.participant_ids?.includes(participantId) ?? false;
          if (!inDispatch && !inRequest) return null;
          return (
            <div key={item.id} className="flex items-center gap-1 text-xs">
              <span className="text-muted-foreground">{tr?.direction === "INBOUND" ? "입국" : tr?.direction === "OUTBOUND" ? "귀국" : "일정"}</span>
              <StatusBadge status={SERVICE_STATUS_BADGE[item.status]}>{SERVICE_STATUS_LABEL[item.status]}</StatusBadge>
            </div>
          );
        })}
      </div>
    );
  }

  const item = items[0];

  if (type === "LODGING" && item.status === "CONFIRMED") {
    const room = (item.room_assignment ?? []).find((r) => r.participant_ids.includes(participantId));
    if (!room) return <StatusBadge status="urgent">미배정</StatusBadge>;
    return <StatusBadge status="done">{room.room_type || room.hotel_name}</StatusBadge>;
  }

  return <StatusBadge status={SERVICE_STATUS_BADGE[item.status]}>{SERVICE_STATUS_LABEL[item.status]}</StatusBadge>;
}

// PCO-E05 대표단 360 개요의 핵심 — "참가자 × 서비스" 매트릭스 (02 §3.6, U2).
// 참가자별로 각 분야 서비스 상태를 한 화면에서 봅니다. 항공/공항 의전/식음은 지금 대표단
// 단위로만 상태를 추적해서(참가자별 세부 배정 없음) 모든 참가자에게 같은 값을 보여주고,
// 숙박·수송은 room_assignment/transfer_request·vehicle_dispatch의 참가자 목록으로 실제
// 배정 여부를 구분해서 보여줍니다.
export function DelegationMatrix({
  participants,
  serviceItems,
}: {
  participants: ParticipantRow[];
  serviceItems: MatrixServiceItem[];
}) {
  const byType: Record<string, MatrixServiceItem[]> = {};
  for (const item of serviceItems) {
    (byType[item.service_type] ??= []).push(item);
  }

  if (participants.length === 0) {
    return <p className="text-sm text-muted-foreground">참가자가 없습니다.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-40">참가자</TableHead>
            {SERVICE_TYPES.map((t) => (
              <TableHead key={t.value} className="min-w-32">{t.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {participants.map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                <span className="font-medium">{p.last_name} {p.first_name}</span>
                <span className="ml-1.5 text-xs text-muted-foreground">({PARTICIPANT_TYPE_LABEL[p.participant_type] ?? p.participant_type})</span>
              </TableCell>
              {SERVICE_TYPES.map((t) => (
                <TableCell key={t.value}>
                  <ServiceCell items={byType[t.value] ?? []} participantId={p.id} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
