import { SERVICE_STATUS_LABEL } from "@/lib/service-item-constants";

const fields: Record<string, string> = {
  inbound_origin_city: "입국 출발 도시 / Origin", inbound_dest_airport: "입국 도착 공항 / Arrival airport",
  inbound_preferred_date: "입국 희망일 / Arrival date", outbound_preferred_date: "귀국 희망일 / Departure date",
  outbound_origin_airport: "귀국 출발 공항 / Departure airport", outbound_dest_city: "귀국 도착 도시 / Destination",
  check_in_preferred_date: "체크인 희망일 / Check-in", check_out_preferred_date: "체크아웃 희망일 / Check-out",
  room_grouping_note: "객실 구성 / Room grouping", note: "요청 메모 / Request note",
  scope: "의전 범위 / Assistance scope", participant_ids: "대상 인원 / Participants",
};
export function updateChanges(before: string | null, after: string | null, kind: string) {
  if (kind === "STATUS") return [{ label: "상태 / Status", before: before ? SERVICE_STATUS_LABEL[before] ?? before : "—", after: after ? SERVICE_STATUS_LABEL[after] ?? after : "—" }];
  try {
    const previous = before ? JSON.parse(before) : {}, next = after ? JSON.parse(after) : {};
    if (!next || typeof next !== "object" || Array.isArray(next)) throw new Error();
    return Object.keys(next).filter((key) => JSON.stringify(previous?.[key]) !== JSON.stringify(next[key])).map((key) => ({
      label: fields[key] ?? key,
      before: display(previous?.[key], key), after: display(next[key], key),
    }));
  } catch { return [{ label: "내용 / Details", before: before || "—", after: after || "—" }]; }
}
function display(value: unknown, key: string): string {
  if (value == null || value === "") return "—";
  if (Array.isArray(value)) return key === "participant_ids" ? `${value.length}명 / people` : value.join(" · ");
  return String(value);
}
export function needsAttention(item: { status: string; event_vendor_id: string | null }) {
  return !["CANCELLED", "NOT_APPLICABLE"].includes(item.status) &&
    (!item.event_vendor_id || ["REQUESTED", "CHANGING", "CANCEL_REQ"].includes(item.status));
}
