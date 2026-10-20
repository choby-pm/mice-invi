"use server";

import { revalidatePath } from "next/cache";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidateLinkedViews } from "@/server/revalidate-linked-views";

// 조정 항목 행동 API 4개(03 §2.1) — 실제 쓰기·이슈 자동 종결 판정은 전부 SECURITY DEFINER
// 함수(migrations/0016) 안에서 처리합니다. PCO와 업체가 같은 액션을 공유합니다(권한은 함수가 검사).
export async function acknowledgeAdjustmentItem(formData: FormData) {
  const id = formData.get("id") as string;
  const revalidateTo = formData.get("revalidateTo") as string;
  if (!id) return;

  const supabase = await createServerSupabaseClient();
  const result = await supabase.rpc("acknowledge_adjustment_item", { p_item_id: id });
  if (result.error) throw new Error("조정 요청을 접수하지 못했습니다.");
  revalidateLinkedViews();
  if (revalidateTo) revalidatePath(revalidateTo);
}

export async function completeAdjustmentItem(formData: FormData) {
  const id = formData.get("id") as string;
  const resolutionNote = (formData.get("resolutionNote") as string)?.trim() || null;
  const valueChanged = formData.get("valueChanged") === "on";
  const revalidateTo = formData.get("revalidateTo") as string;
  if (!id) return;

  const supabase = await createServerSupabaseClient();
  if (!resolutionNote) throw new Error("실제로 반영한 처리 결과를 입력해 주세요.");
  const result = await supabase.rpc("complete_adjustment_item", {
    p_item_id: id,
    p_resolution_note: resolutionNote,
    p_value_changed: valueChanged,
  });
  if (result.error) throw new Error("조정 결과를 저장하지 못했습니다.");
  revalidateLinkedViews();
  if (revalidateTo) revalidatePath(revalidateTo);
}

export async function markAdjustmentNotApplicable(formData: FormData) {
  const id = formData.get("id") as string;
  const reason = (formData.get("reason") as string)?.trim() || null;
  const revalidateTo = formData.get("revalidateTo") as string;
  if (!id) return;

  const supabase = await createServerSupabaseClient();
  const result = await supabase.rpc("mark_adjustment_not_applicable", { p_item_id: id, p_reason: reason });
  if (result.error) throw new Error("지원 제외 처리를 저장하지 못했습니다.");
  revalidateLinkedViews();
  if (revalidateTo) revalidatePath(revalidateTo);
}

export async function reassignAdjustmentItem(formData: FormData) {
  const id = formData.get("id") as string;
  const vendorId = formData.get("vendorId") as string;
  const revalidateTo = formData.get("revalidateTo") as string;
  if (!id || !vendorId) return;

  const supabase = await createServerSupabaseClient();
  const result = await supabase.rpc("reassign_adjustment_item", { p_item_id: id, p_new_vendor_id: vendorId });
  if (result.error) throw new Error("조정 담당자를 변경하지 못했습니다.");
  revalidateLinkedViews();
  if (revalidateTo) revalidatePath(revalidateTo);
}

export async function forceCloseChangeIssue(formData: FormData) {
  const id = formData.get("id") as string;
  const reason = (formData.get("reason") as string)?.trim() || "";
  const revalidateTo = formData.get("revalidateTo") as string;
  if (!id || !reason) return;

  const supabase = await createServerSupabaseClient();
  const result = await supabase.rpc("force_close_change_issue", { p_issue_id: id, p_reason: reason });
  if (result.error) throw new Error("변경 이슈를 종결하지 못했습니다.");
  revalidateLinkedViews();
  if (revalidateTo) revalidatePath(revalidateTo);
}
