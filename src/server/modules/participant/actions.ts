"use server";

import { revalidatePath } from "next/cache";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/server/modules/org/get-membership";

export async function createParticipant(formData: FormData) {
  const eventId = formData.get("eventId") as string;
  const delegationId = formData.get("delegationId") as string;
  const participantType = formData.get("participantType") as string;
  const lastName = (formData.get("lastName") as string)?.trim();
  const firstName = (formData.get("firstName") as string)?.trim();
  const nationality = (formData.get("nationality") as string)?.trim();
  const honorific = (formData.get("honorific") as string)?.trim() || null;
  const title = (formData.get("title") as string)?.trim() || null;
  if (!delegationId || !participantType || !lastName || !firstName || !nationality) return;

  const membership = await getCurrentMembership();
  // PCO(관리자·담당자) 또는 그 대표단에 배정된 대리인만 (01 §2.5 매트릭스: 참가자 CRUD(범위))
  if (!membership || membership.role === "PCO_FIELD") return;

  const supabase = await createServerSupabaseClient();
  await supabase.from("participant").insert({
    tenant_id: membership.tenantId,
    delegation_id: delegationId,
    participant_type: participantType,
    last_name: lastName,
    first_name: firstName,
    nationality,
    honorific,
    title,
  });
  revalidatePath(`/console/events/${eventId}/delegations/${delegationId}`);
}
