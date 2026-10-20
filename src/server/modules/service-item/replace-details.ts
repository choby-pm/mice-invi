import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// 새 내용의 검증·저장이 끝나기 전에 기존 예약/배정 정보를 지우지 않습니다.
// shortcut: 동시 편집 잠금은 없으며, 동시 편집을 지원할 때 DB 트랜잭션 함수로 전환합니다.
export async function replaceServiceDetails(client: SupabaseClient, table: "flight_segment" | "room_assignment" | "vehicle_dispatch" | "airport_assignment", serviceItemId: string, rows: Record<string, unknown>[]) {
  if (!rows.length) throw new Error("확정할 내용을 먼저 입력해 주세요.");
  const previous = await client.from(table).select("id").eq("service_item_id", serviceItemId);
  if (previous.error) throw previous.error;
  const inserted = await client.from(table).insert(rows).select();
  if (inserted.error) throw inserted.error;
  if (!inserted.data?.length) throw new Error("확정 정보를 저장하지 못했습니다.");
  const oldIds = (previous.data ?? []).map((r) => r.id);
  if (oldIds.length) {
    const removed = await client.from(table).delete().eq("service_item_id", serviceItemId).in("id", oldIds).select("id");
    if (removed.error) {
      await client.from(table).delete().eq("service_item_id", serviceItemId).in("id", inserted.data.map((r) => r.id));
      throw removed.error;
    }
    if (removed.data?.length !== oldIds.length) throw new Error("기존 배정 정보 정리를 완료하지 못했습니다. 담당자에게 확인해 주세요.");
  }
  return inserted.data;
}
