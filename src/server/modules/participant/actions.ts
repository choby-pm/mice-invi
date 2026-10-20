"use server";

import { revalidatePath } from "next/cache";
import { revalidateLinkedViews } from "@/server/revalidate-linked-views";
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

  const { data: participant } = await supabase
    .from("participant")
    .insert({
      tenant_id: delegation.tenant_id,
      delegation_id: delegationId,
      participant_type: participantType,
      last_name: lastName,
      first_name: firstName,
      nationality,
      honorific,
      title,
    })
    .select("id")
    .single();
  // 첫 입력 저장 (S02: OPENED --> IN_PROGRESS)
  await supabase.from("delegation").update({ invite_status: "IN_PROGRESS" }).eq("id", delegationId).eq("invite_status", "OPENED");

  // R4 영향 엔진(IR-08) — 이미 처리중 이상인 서비스가 있으면 조정 항목이 자동 생성됩니다.
  if (participant) {
    await supabase.rpc("evaluate_participant_change_impact", {
      p_delegation_id: delegationId,
      p_participant_id: participant.id,
      p_participant_name: `${lastName} ${firstName}`,
      p_kind: "ADDED",
    });
  }

  revalidateLinkedViews();
  if (revalidateTo) revalidatePath(revalidateTo);
}

// 참가자 삭제. 삭제 전에 이름을 기억해뒀다가 영향 엔진 요약에 씁니다. 객실·배차·수송
// 배정에 남아있던 참조는 evaluate_participant_change_impact 안에서 같이 정리됩니다.
export async function deleteParticipant(formData: FormData) {
  const id = formData.get("id") as string;
  const delegationId = formData.get("delegationId") as string;
  const revalidateTo = formData.get("revalidateTo") as string;
  if (!id || !delegationId) return;

  const supabase = await createServerSupabaseClient();
  const { data: participant } = await supabase.from("participant").select("last_name, first_name").eq("id", id).eq("delegation_id", delegationId).single();
  if (!participant) return;

  const { error } = await supabase.from("participant").delete().eq("id", id);
  if (error) return;

  await supabase.rpc("evaluate_participant_change_impact", {
    p_delegation_id: delegationId,
    p_participant_id: id,
    p_participant_name: `${participant.last_name} ${participant.first_name}`,
    p_kind: "REMOVED",
  });

  revalidateLinkedViews();
  if (revalidateTo) revalidatePath(revalidateTo);
}
