"use server";

import { revalidatePath } from "next/cache";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

// 참석 여부 회신 (P05 2단계). 불참이면 S02 상태도 같이 "불참"으로 넘어갑니다
// (OPENED --> DECLINED). RLS(delegation_update: PCO 또는 is_active_proxy)가
// 누가 바꿀 수 있는지 판단합니다.
export async function updateRsvp(formData: FormData) {
  const delegationId = formData.get("delegationId") as string;
  const rsvp = formData.get("rsvp") as string; // ATTENDING | DECLINED
  const revalidateTo = formData.get("revalidateTo") as string;
  if (!delegationId || !rsvp) return;

  const supabase = await createServerSupabaseClient();
  const update: Record<string, string> = { rsvp };
  if (rsvp === "DECLINED") update.invite_status = "DECLINED";
  await supabase.from("delegation").update(update).eq("id", delegationId);
  if (revalidateTo) revalidatePath(revalidateTo);
}
