"use server";

import { revalidatePath } from "next/cache";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export interface ParticipantSensitiveData {
  passport_no: string | null;
  passport_country: string | null;
  passport_expiry: string | null;
  medical_note: string | null;
  allergy: string | null;
  mobility_need: string | null;
  religion: string | null;
  purge_status: string | null;
}

// "열어보는 행동"으로만 호출됩니다(U6) — 호출될 때마다 DB 함수가 접근 기록을 남깁니다.
export async function viewParticipantSensitive(participantId: string): Promise<ParticipantSensitiveData | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("read_participant_sensitive", { p_participant_id: participantId });
  if (error || !data || data.length === 0) return null;
  return data[0] as ParticipantSensitiveData;
}

export async function saveParticipantSensitive(formData: FormData) {
  const participantId = formData.get("participantId") as string;
  const eventId = formData.get("eventId") as string;
  const delegationId = formData.get("delegationId") as string;
  if (!participantId) return;

  const supabase = await createServerSupabaseClient();
  await supabase.rpc("write_participant_sensitive", {
    p_participant_id: participantId,
    p_passport_no: (formData.get("passportNo") as string) || null,
    p_passport_country: (formData.get("passportCountry") as string) || null,
    p_passport_expiry: (formData.get("passportExpiry") as string) || null,
    p_medical_note: (formData.get("medicalNote") as string) || null,
    p_allergy: (formData.get("allergy") as string) || null,
    p_mobility_need: (formData.get("mobilityNeed") as string) || null,
    p_religion: (formData.get("religion") as string) || null,
  });
  revalidatePath(`/console/events/${eventId}/delegations/${delegationId}`);
}
