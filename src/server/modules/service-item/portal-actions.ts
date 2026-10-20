"use server";

import { revalidatePath } from "next/cache";
import { revalidateLinkedViews } from "@/server/revalidate-linked-views";
import { fromFormDateTime } from "@/lib/date";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { requestStatus } from "@/lib/service-request-status";

// 서비스 요청 제출 (P05 7단계). 상태를 화면에서 직접 바꾸지 않는다는 원칙(03 §2.1)에
// 맞춰, "요청 제출"이라는 명확한 행동 하나만 노출합니다 — DRAFT일 때만 REQUESTED로
// 넘어가고, 이미 REQUESTED 이후 단계면 내용(note)만 갱신합니다(재요청은 변경 이슈로
// 관리하는 게 맞지만 그 흐름은 R4).
export async function submitServiceRequest(formData: FormData) {
  const serviceItemId = formData.get("serviceItemId") as string;
  const revalidateTo = formData.get("revalidateTo") as string;
  const note = (formData.get("note") as string)?.trim() || null;
  const scheduledAtRaw = formData.get("scheduledAt") as string;
  const scheduledAt = scheduledAtRaw ? fromFormDateTime(scheduledAtRaw) : null;
  if (!serviceItemId) return;

  const supabase = await createServerSupabaseClient();
  const { data: item } = await supabase.from("service_item").select("status, service_type, note, scheduled_at").eq("id", serviceItemId).single();
  if (!item) return;
  if (["TRANSFER", "AIRPORT"].includes(item.service_type)) throw new Error("이 서비스는 담당자가 요청을 관리합니다.");

  const result = await supabase
    .from("service_item")
    .update({
      note,
      scheduled_at: scheduledAt,
      status: requestStatus(item.status, item.note !== note || item.scheduled_at !== scheduledAt),
    })
    .eq("id", serviceItemId).select("id").maybeSingle();
  if (result.error || !result.data) throw new Error("요청을 저장하지 못했습니다. 담당 범위와 현재 상태를 확인해 주세요.");

  revalidateLinkedViews();
  if (revalidateTo) revalidatePath(revalidateTo);
}
