"use server";

import { revalidatePath } from "next/cache";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

// PCO 콘솔과 대리인 포털 양쪽에서 씁니다 — 권한 판단은 RLS(participant_insert:
// PCO 관리자·담당자 또는 is_active_proxy)에 맡기고, 여기서는 역할을 따로 가리지
// 않습니다. revalidateTo로 호출한 화면을 각자 새로고침합니다.
export async function createParticipant(formData: FormData) {
  const delegationId = formData.get("delegationId") as string;
  const revalidateTo = formData.get("revalidateTo") as string;
  const participantType = formData.get("participantType") as string;
  const lastName = (formData.get("lastName") as string)?.trim();
  const firstName = (formData.get("firstName") as string)?.trim();
  const nationality = (formData.get("nationality") as string)?.trim();
  const honorific = (formData.get("honorific") as string)?.trim() || null;
  const title = (formData.get("title") as string)?.trim() || null;
  if (!delegationId || !participantType || !lastName || !firstName || !nationality) return;

  const supabase = await createServerSupabaseClient();
  const { data: delegation } = await supabase.from("delegation").select("tenant_id").eq("id", delegationId).single();
  if (!delegation) return; // RLS로 안 보이면 여기서 걸러짐

  await supabase.from("participant").insert({
    tenant_id: delegation.tenant_id,
    delegation_id: delegationId,
    participant_type: participantType,
    last_name: lastName,
    first_name: firstName,
    nationality,
    honorific,
    title,
  });
  if (revalidateTo) revalidatePath(revalidateTo);
}
