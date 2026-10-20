"use server";

import { revalidatePath } from "next/cache";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { bookingBasics } from "@/lib/booking-basics";
import { revalidateLinkedViews } from "@/server/revalidate-linked-views";

export interface ParticipantSensitiveData {
  passport_no: string | null;
  passport_country: string | null;
  passport_expiry: string | null;
  medical_note: string | null;
  allergy: string | null;
  mobility_need: string | null;
  religion: string | null;
  purge_status: string | null;
  birth_date?: string | null;
  gender?: string | null;
  first_name?: string;
  last_name?: string;
  nationality?: string;
}

// "열어보는 행동"으로만 호출됩니다(U6) — 호출될 때마다 DB 함수가 접근 기록을 남깁니다.
export async function viewParticipantSensitive(participantId: string): Promise<ParticipantSensitiveData | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("read_participant_sensitive", { p_participant_id: participantId });
  if (error) throw new Error("여권·민감정보를 열람할 권한을 확인해 주세요.");
  const identity = await supabase.from("participant").select("first_name,last_name,nationality,birth_date,gender").eq("id", participantId).single();
  if (identity.error) throw new Error("참가자 발권 기본정보를 조회하지 못했습니다.");
  const empty: ParticipantSensitiveData = { passport_no: null, passport_country: null, passport_expiry: null, medical_note: null, allergy: null, mobility_need: null, religion: null, purge_status: null };
  return { ...(data?.[0] ?? empty), ...identity.data } as ParticipantSensitiveData;
}

export async function saveParticipantSensitive(formData: FormData) {
  const participantId = formData.get("participantId") as string;
  const revalidateTo = formData.get("revalidateTo") as string;
  if (!participantId) return;
  const basic = bookingBasics(formData);
  const identity: Record<string, string | null> = {};
  if (formData.has("birthDate")) identity.birth_date = basic.birth_date;
  if (formData.has("gender")) identity.gender = basic.gender;
  for (const [field, column] of [["firstName", "first_name"], ["lastName", "last_name"], ["nationality", "nationality"]]) {
    if (!formData.has(field)) continue;
    const value = String(formData.get(field) ?? "").trim();
    if (!value || value.length > 120) throw new Error("여권상 영문 성명과 국적을 확인해 주세요.");
    identity[column] = value;
  }

  const supabase = await createServerSupabaseClient();
  const result = await supabase.rpc("write_participant_sensitive", {
    p_participant_id: participantId,
    p_passport_no: (formData.get("passportNo") as string) || null,
    p_passport_country: (formData.get("passportCountry") as string) || null,
    p_passport_expiry: (formData.get("passportExpiry") as string) || null,
    p_medical_note: (formData.get("medicalNote") as string) || null,
    p_allergy: (formData.get("allergy") as string) || null,
    p_mobility_need: (formData.get("mobilityNeed") as string) || null,
    p_religion: (formData.get("religion") as string) || null,
  });
  if (result.error) throw new Error("여권·민감정보를 저장하지 못했습니다.");
  if (Object.keys(identity).length) {
    const saved = await supabase.from("participant").update(identity).eq("id", participantId).select("id").maybeSingle();
    if (saved.error || !saved.data) throw new Error("여권은 저장됐지만 발권 기본정보 저장에 실패했습니다. 다시 확인해 주세요.");
  }
  revalidateLinkedViews();
  if (revalidateTo) revalidatePath(revalidateTo);
}
