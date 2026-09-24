"use server";

import { revalidatePath } from "next/cache";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/date";

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
// DRAFT일 때만 REQUESTED로 전이하고, service_item.note/scheduled_at에 요약을 동기화합니다.
export async function saveLodgingRequest(formData: FormData) {
  const serviceItemId = formData.get("serviceItemId") as string;
  const revalidateTo = formData.get("revalidateTo") as string;
  if (!serviceItemId) return;

  const checkInPreferredDate = (formData.get("checkInPreferredDate") as string) || null;
  const checkOutPreferredDate = (formData.get("checkOutPreferredDate") as string) || null;
  const roomGroupingNote = (formData.get("roomGroupingNote") as string)?.trim() || null;
  const note = (formData.get("note") as string)?.trim() || null;

  const supabase = await createServerSupabaseClient();
  const { data: item } = await supabase.from("service_item").select("status").eq("id", serviceItemId).single();
  if (!item) return;

  await supabase.from("lodging_request").upsert(
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

  const summary = [
    checkInPreferredDate && `체크인 희망 ${formatDate(checkInPreferredDate, "ko")}`,
    checkOutPreferredDate && `체크아웃 희망 ${formatDate(checkOutPreferredDate, "ko")}`,
    roomGroupingNote,
  ]
    .filter(Boolean)
    .join(" · ") || null;

  await supabase
    .from("service_item")
    .update({
      note: summary,
      scheduled_at: checkInPreferredDate ? new Date(checkInPreferredDate).toISOString() : null,
      status: item.status === "DRAFT" ? "REQUESTED" : item.status,
    })
    .eq("id", serviceItemId);

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
    rooms = [];
  }
  rooms = rooms.filter((r) => r.hotelName?.trim());

  const supabase = await createServerSupabaseClient();

  await supabase.from("room_assignment").delete().eq("service_item_id", serviceItemId);

  if (rooms.length > 0) {
    await supabase.from("room_assignment").insert(
      rooms.map((r) => ({
        service_item_id: serviceItemId,
        hotel_name: r.hotelName.trim(),
        room_type: r.roomType || null,
        participant_ids: r.participantIds ?? [],
        check_in_at: r.checkInAt ? new Date(r.checkInAt).toISOString() : null,
        check_out_at: r.checkOutAt ? new Date(r.checkOutAt).toISOString() : null,
        confirmation_no: r.confirmationNo || null,
        room_no: r.roomNo || null,
        note: r.note || null,
      })),
    );
  }

  const first = rooms[0];
  const confirmationNote = rooms.length
    ? `${first.hotelName}${first.roomType ? ` · ${first.roomType}` : ""}${rooms.length > 1 ? ` 외 ${rooms.length - 1}개 객실` : ""}`
    : null;

  await supabase
    .from("service_item")
    .update({ status: "CONFIRMED", confirmation_note: confirmationNote, confirmed_at: new Date().toISOString() })
    .eq("id", serviceItemId);

  revalidatePath("/vendor");
}
