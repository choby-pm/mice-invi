export interface CheckService {
  delegation_id: string; service_type: string; status: string;
  flight_segment?: { direction: string; arr_at: string; is_final_arrival: boolean }[];
  transfer_request?: { direction: string; scheduled_at: string | null }[] | { direction: string; scheduled_at: string | null } | null;
  room_assignment?: { participant_ids: string[]; check_in_at: string | null; check_out_at: string | null }[];
}
export function serviceChecks(services: CheckService[], delegations: { id: string; participant: { id: string }[] }[]) {
  const warnings: { delegationId: string; message: string }[] = [];
  for (const delegation of delegations) {
    const items = services.filter((s) => s.delegation_id === delegation.id && !["CANCELLED", "NOT_APPLICABLE"].includes(s.status));
    const arrival = items.flatMap((s) => s.flight_segment ?? []).find((f) => f.direction === "INBOUND" && f.is_final_arrival);
    const transfers = items.flatMap((s) => !s.transfer_request ? [] : Array.isArray(s.transfer_request) ? s.transfer_request : [s.transfer_request]);
    if (arrival && transfers.some((t) => t.direction === "INBOUND" && t.scheduled_at && Date.parse(t.scheduled_at) < Date.parse(arrival.arr_at)))
      warnings.push({ delegationId: delegation.id, message: "입국 픽업이 항공 도착보다 빠릅니다. 배차 시간을 확인하세요." });
    const rooms = items.filter((s) => ["CONFIRMED", "NOTIFIED"].includes(s.status)).flatMap((s) => s.room_assignment ?? []);
    if (rooms.length && delegation.participant.some((p) => !rooms.some((r) => r.participant_ids.includes(p.id))))
      warnings.push({ delegationId: delegation.id, message: "확정 숙박에서 객실이 배정되지 않은 참가자가 있습니다." });
    const assigned = rooms.flatMap((r) => r.participant_ids);
    if (new Set(assigned).size !== assigned.length)
      warnings.push({ delegationId: delegation.id, message: "여러 객실에 중복 배정된 참가자가 있습니다. 숙박 기간을 확인하세요." });
    if (arrival && rooms.some((r) => r.check_out_at && Date.parse(r.check_out_at) <= Date.parse(arrival.arr_at)))
      warnings.push({ delegationId: delegation.id, message: "항공 도착 전에 숙박이 종료됩니다. 숙박 기간을 확인하세요." });
  }
  return warnings;
}
