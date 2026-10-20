"use server";

import { revalidatePath } from "next/cache";
import { revalidateLinkedViews } from "@/server/revalidate-linked-views";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export interface ConsentItemWithStatus {
  id: string;
  category: string;
  text: { ko?: string; en?: string };
  required: boolean;
  agreed: boolean;
}

// 이 행사의 현재(게시된) 동의서와, 특정 참가자가 각 항목에 이미 동의했는지를 합쳐서 줍니다.
export async function getConsentChecklist(eventId: string, participantId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: policy } = await supabase
    .from("consent_policy")
    .select("id, version, notice_body")
    .eq("event_id", eventId)
    .eq("is_current", true)
    .maybeSingle();
  if (!policy) return null;

  const [{ data: items }, { data: records }] = await Promise.all([
    supabase.from("consent_item").select("id, category, text, required").eq("policy_id", policy.id).order("sort_order"),
    supabase.from("consent_record").select("item_id").eq("participant_id", participantId).eq("status", "VALID").eq("agreed", true).eq("policy_version", policy.version),
  ]);
  const agreedIds = new Set((records ?? []).map((r) => r.item_id));

  return {
    policy,
    items: (items ?? []).map((item) => ({ ...item, agreed: agreedIds.has(item.id) })) as ConsentItemWithStatus[],
  };
}

// 체크 해제는 철회로 저장하며 소속 검증과 저장을 DB 안에서 한 번에 처리합니다.
export async function submitConsent(formData: FormData) {
  const participantId = formData.get("participantId") as string;
  const delegationId = formData.get("delegationId") as string;
  const policyVersion = Number(formData.get("policyVersion"));
  const revalidateTo = formData.get("revalidateTo") as string;
  const itemIds = formData.getAll("itemIds") as string[];
  if (!participantId || !delegationId) return;

  const supabase = await createServerSupabaseClient();
  const result = await supabase.rpc("submit_participant_consent", { p_participant_id: participantId, p_delegation_id: delegationId, p_policy_version: policyVersion, p_item_ids: itemIds });
  if (result.error) throw new Error("동의를 저장하지 못했습니다. 현재 동의서와 참가자를 다시 확인해 주세요.");
  revalidateLinkedViews();
  if (revalidateTo) revalidatePath(revalidateTo);
}
