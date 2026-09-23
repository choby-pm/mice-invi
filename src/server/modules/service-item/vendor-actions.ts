"use server";

import { revalidatePath } from "next/cache";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

// 업체 쪽 행동 API 2개 — 상태는 여기서만 바뀝니다(03 §2.1).
// 확정 데이터(confirmation_note)는 요청 데이터(note)와 다른 열에 저장합니다 —
// "요청 데이터/확정 데이터 분리"가 이 제품의 핵심 가치라서요.
export async function startServiceItem(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) return;

  const supabase = await createServerSupabaseClient();
  await supabase.from("service_item").update({ status: "IN_PROGRESS" }).eq("id", id).eq("status", "REQUESTED");
  revalidatePath("/vendor");
}

export async function confirmServiceItem(formData: FormData) {
  const id = formData.get("id") as string;
  const confirmationNote = (formData.get("confirmationNote") as string)?.trim() || null;
  if (!id) return;

  const supabase = await createServerSupabaseClient();
  await supabase
    .from("service_item")
    .update({ status: "CONFIRMED", confirmation_note: confirmationNote, confirmed_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/vendor");
}
