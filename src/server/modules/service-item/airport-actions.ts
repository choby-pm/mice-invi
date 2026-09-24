"use server";

import { revalidatePath } from "next/cache";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/date";

const SCOPE_LABEL: Record<string, string> = {
  GREETING: "영접 인사",
  FAST_TRACK: "패스트트랙",
  LOUNGE: "라운지",
  BAGGAGE: "수하물 대행",
};

// 공항 의전 범위 지정 (PCO 전용 — P09: 대리인이 아니라 PCO가 등급별 기본값을 참고해 정함).
export async function saveAirportRequest(formData: FormData) {
  const serviceItemId = formData.get("serviceItemId") as string;
  const revalidateTo = formData.get("revalidateTo") as string;
  const scope = formData.getAll("scope") as string[];
  const note = (formData.get("note") as string)?.trim() || null;
  if (!serviceItemId) return;

  const supabase = await createServerSupabaseClient();
  const { data: item } = await supabase.from("service_item").select("status").eq("id", serviceItemId).single();
  if (!item) return;

  await supabase.from("airport_request").upsert(
    { service_item_id: serviceItemId, scope, note, updated_at: new Date().toISOString() },
    { onConflict: "service_item_id" },
  );

  const summary = scope.map((s) => SCOPE_LABEL[s]).filter(Boolean).join(" · ") || null;

  await supabase
    .from("service_item")
    .update({ note: summary, status: item.status === "DRAFT" ? "REQUESTED" : item.status })
    .eq("id", serviceItemId);

  if (revalidateTo) revalidatePath(revalidateTo);
}

// 배정 확정 저장 (업체). 담당 요원·만남 장소·시각을 요청 데이터(scope)와 분리해서 저장합니다.
export async function saveAirportAssignment(formData: FormData) {
  const serviceItemId = formData.get("id") as string;
  const attendantName = (formData.get("attendantName") as string)?.trim() || null;
  const meetingPoint = (formData.get("meetingPoint") as string)?.trim() || null;
  const meetingAtRaw = formData.get("meetingAt") as string;
  const meetingAt = meetingAtRaw ? new Date(meetingAtRaw).toISOString() : null;
  const note = (formData.get("note") as string)?.trim() || null;
  if (!serviceItemId) return;

  const supabase = await createServerSupabaseClient();

  await supabase.from("airport_assignment").delete().eq("service_item_id", serviceItemId);
  await supabase.from("airport_assignment").insert({
    service_item_id: serviceItemId,
    attendant_name: attendantName,
    meeting_point: meetingPoint,
    meeting_at: meetingAt,
    note,
  });

  const confirmationNote = [
    attendantName && `담당 ${attendantName}`,
    meetingPoint && `${meetingPoint}`,
    meetingAt && formatDateTime(meetingAt, "ko"),
  ]
    .filter(Boolean)
    .join(" · ") || null;

  await supabase
    .from("service_item")
    .update({ status: "CONFIRMED", confirmation_note: confirmationNote, confirmed_at: new Date().toISOString() })
    .eq("id", serviceItemId);

  revalidatePath("/vendor");
}
