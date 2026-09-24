"use server";

import { revalidatePath } from "next/cache";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

// 조정 항목 행동 API 4개(03 §2.1) — 실제 쓰기·이슈 자동 종결 판정은 전부 SECURITY DEFINER
// 함수(migrations/0016) 안에서 처리합니다. PCO와 업체가 같은 액션을 공유합니다(권한은 함수가 검사).
export async function acknowledgeAdjustmentItem(formData: FormData) {
  const id = formData.get("id") as string;
  const revalidateTo = formData.get("revalidateTo") as string;
  if (!id) return;

  const supabase = await createServerSupabaseClient();
  await supabase.rpc("acknowledge_adjustment_item", { p_item_id: id });
  if (revalidateTo) revalidatePath(revalidateTo);
}

export async function completeAdjustmentItem(formData: FormData) {
  const id = formData.get("id") as string;
  const resolutionNote = (formData.get("resolutionNote") as string)?.trim() || null;
  const valueChanged = formData.get("valueChanged") === "on";
  const revalidateTo = formData.get("revalidateTo") as string;
  if (!id) return;

  const supabase = await createServerSupabaseClient();
  await supabase.rpc("complete_adjustment_item", {
    p_item_id: id,
    p_resolution_note: resolutionNote,
    p_value_changed: valueChanged,
  });
  if (revalidateTo) revalidatePath(revalidateTo);
}

export async function markAdjustmentNotApplicable(formData: FormData) {
  const id = formData.get("id") as string;
  const reason = (formData.get("reason") as string)?.trim() || null;
  const revalidateTo = formData.get("revalidateTo") as string;
  if (!id) return;

  const supabase = await createServerSupabaseClient();
  await supabase.rpc("mark_adjustment_not_applicable", { p_item_id: id, p_reason: reason });
  if (revalidateTo) revalidatePath(revalidateTo);
}

export async function forceCloseChangeIssue(formData: FormData) {
  const id = formData.get("id") as string;
  const reason = (formData.get("reason") as string)?.trim() || "";
  const revalidateTo = formData.get("revalidateTo") as string;
  if (!id || !reason) return;

  const supabase = await createServerSupabaseClient();
  await supabase.rpc("force_close_change_issue", { p_issue_id: id, p_reason: reason });
  if (revalidateTo) revalidatePath(revalidateTo);
}
