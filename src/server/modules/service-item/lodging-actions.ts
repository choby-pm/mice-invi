"use server";

import { revalidatePath } from "next/cache";
import { revalidateLinkedViews } from "@/server/revalidate-linked-views";
import { fromFormDateTime } from "@/lib/date";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/date";
import { requestStatus, requestChanged } from "@/lib/service-request-status";
import { replaceServiceDetails } from "@/server/modules/service-item/replace-details";

interface RoomAssignmentInput {
  hotelName: string;
  roomType?: string;
  participantIds: string[];
  checkInAt?: string;
  checkOutAt?: string;
  confirmationNo?: string;
  roomNo?: string;
  note?: string;
}

// 숙박 요청 저장 (대리인·PCO). flight-actions.ts의 saveFlightRequest와 같은 패턴 —
// 최초 제출·확정 후 변경을 구분하고, service_item.note/scheduled_at에 요약을 동기화합니다.
export async function saveLodgingRequest(formData: FormData) {
  const serviceItemId = formData.get("serviceItemId") as string;
  const revalidateTo = formData.get("revalidateTo") as string;
  if (!serviceItemId) return;

  const checkInPreferredDate = (formData.get("checkInPreferredDate") as string) || null;
  const checkOutPreferredDate = (formData.get("checkOutPreferredDate") as string) || null;
  const roomGroupingNote = (formData.get("roomGroupingNote") as string)?.trim() || null;
  const note = (formData.get("note") as string)?.trim() || null;

  const supabase = await createServerSupabaseClient();
  const { data: item } = await supabase.from("service_item").select("status, service_type, lodging_request(*)").eq("id", serviceItemId).single();
  if (!item) return;
  if (item.service_type !== "LODGING") throw new Error("숙박 요청 항목이 아닙니다.");
  for (const value of [checkInPreferredDate, checkOutPreferredDate]) {
    if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) throw new Error("희망 숙박 날짜를 확인해 주세요.");
  }
  if (checkInPreferredDate && checkOutPreferredDate && checkOutPreferredDate <= checkInPreferredDate) throw new Error("체크아웃은 체크인 이후여야 합니다.");
  const previous = Array.isArray(item.lodging_request) ? item.lodging_request[0] : item.lodging_request;
  const next = { check_in_preferred_date: checkInPreferredDate, check_out_preferred_date: checkOutPreferredDate, room_grouping_note: roomGroupingNote, note };
  const status = requestStatus(item.status, requestChanged(previous, next));

  const requestResult = await supabase.from("lodging_request").upsert(
    {
      service_item_id: serviceItemId,
      check_in_preferred_date: checkInPreferredDate,
      check_out_preferred_date: checkOutPreferredDate,
      room_grouping_note: roomGroupingNote,
      note,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "service_item_id" },
  );
  if (requestResult.error) throw requestResult.error;

  const summary = [
    checkInPreferredDate && `체크인 희망 ${formatDate(checkInPreferredDate, "ko")}`,
    checkOutPreferredDate && `체크아웃 희망 ${formatDate(checkOutPreferredDate, "ko")}`,
    roomGroupingNote,
    note,
  ]
    .filter(Boolean)
    .join(" · ") || null;

  const updateResult = await supabase
    .from("service_item")
    .update({
      note: summary,
      scheduled_at: checkInPreferredDate ? new Date(checkInPreferredDate).toISOString() : null,
      status,
    })
    .eq("id", serviceItemId).select("id").maybeSingle();
  if (updateResult.error || !updateResult.data) throw new Error("숙박 요청을 저장하지 못했습니다.");

  revalidateLinkedViews();
  if (revalidateTo) revalidatePath(revalidateTo);
}

// 숙박 확정 저장 (호텔/업체). 객실 단위로 참가자 여러 명을 묶어서 저장합니다(BR-07-1) —
// 한 대표단이 여러 객실을 쓸 수 있어 이번 저장으로 기존 객실 목록을 통째로 교체합니다.
export async function saveRoomAssignments(formData: FormData) {
  const serviceItemId = formData.get("id") as string;
  if (!serviceItemId) return;

  let rooms: RoomAssignmentInput[] = [];
  try {
    rooms = JSON.parse((formData.get("rooms") as string) || "[]");
  } catch {
    throw new Error("객실 입력 형식이 올바르지 않습니다.");
  }
  if (!Array.isArray(rooms) || !rooms.length || rooms.some((r) => !r || !r.hotelName?.trim() || !Array.isArray(r.participantIds))) throw new Error("호텔과 배정 참가자를 확인해 주세요.");
  for (const r of rooms) if (r.checkInAt && r.checkOutAt && fromFormDateTime(r.checkOutAt) <= fromFormDateTime(r.checkInAt)) throw new Error("체크아웃은 체크인 이후여야 합니다.");

  const supabase = await createServerSupabaseClient();

  await replaceServiceDetails(supabase, "room_assignment", serviceItemId,
      rooms.map((r) => ({
        service_item_id: serviceItemId,
        hotel_name: r.hotelName.trim(),
        room_type: r.roomType || null,
        participant_ids: r.participantIds ?? [],
        check_in_at: r.checkInAt ? fromFormDateTime(r.checkInAt) : null,
        check_out_at: r.checkOutAt ? fromFormDateTime(r.checkOutAt) : null,
        confirmation_no: r.confirmationNo || null,
        room_no: r.roomNo || null,
        note: r.note || null,
      })),
  );

  const first = rooms[0];
  const confirmationNote = rooms.length
    ? `${first.hotelName}${first.roomType ? ` · ${first.roomType}` : ""}${rooms.length > 1 ? ` 외 ${rooms.length - 1}개 객실` : ""}`
    : null;

  await supabase
    .from("service_item")
    .update({ status: "CONFIRMED", confirmation_note: confirmationNote, confirmed_at: new Date().toISOString() })
    .eq("id", serviceItemId);

  revalidateLinkedViews();
}
