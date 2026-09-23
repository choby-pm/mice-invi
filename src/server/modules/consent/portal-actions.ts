"use server";

import { revalidatePath } from "next/cache";
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
    supabase.from("consent_record").select("item_id").eq("participant_id", participantId).eq("status", "VALID"),
  ]);
  const agreedIds = new Set((records ?? []).map((r) => r.item_id));

  return {
    policy,
    items: (items ?? []).map((item) => ({ ...item, agreed: agreedIds.has(item.id) })) as ConsentItemWithStatus[],
  };
}

// BR-05-1: 동의하지 않으면 해당 항목(여권 등) 입력을 막는 로직은 다음 조각에서 화면에 반영합니다.
// 여기서는 동의 자체를 기록합니다 — 정보주체(참가자) 단위, 동의자는 로그인한 대리인.
export async function submitConsent(formData: FormData) {
  const participantId = formData.get("participantId") as string;
  const delegationId = formData.get("delegationId") as string;
  const policyVersion = Number(formData.get("policyVersion"));
  const revalidateTo = formData.get("revalidateTo") as string;
  const itemIds = formData.getAll("itemIds") as string[];
  if (!participantId || !delegationId) return;

  const supabase = await createServerSupabaseClient();
  const [{ data: delegation }, { data: { user } }] = await Promise.all([
    supabase.from("delegation").select("tenant_id").eq("id", delegationId).single(),
    supabase.auth.getUser(),
  ]);
  if (!delegation) return;

  for (const itemId of itemIds) {
    await supabase.from("consent_record").upsert(
      {
        tenant_id: delegation.tenant_id,
        delegation_id: delegationId,
        item_id: itemId,
        participant_id: participantId,
        proxy_user_id: user?.id,
        agreed: true,
        policy_version: policyVersion,
        status: "VALID",
        agreed_at: new Date().toISOString(),
      },
      { onConflict: "item_id,participant_id" },
    );
  }
  if (revalidateTo) revalidatePath(revalidateTo);
}
