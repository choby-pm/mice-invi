"use server";

import { revalidatePath } from "next/cache";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/server/modules/org/get-membership";

// PCO가 하위 행사를 만듭니다(P02-C 1단계) — 항상 가안(TENTATIVE)으로 시작합니다.
export async function createProgram(formData: FormData) {
  const eventId = formData.get("eventId") as string;
  const name = (formData.get("name") as string)?.trim();
  const programType = formData.get("programType") as string;
  const organizerType = formData.get("organizerType") as string;
  const organizerDelegationId = (formData.get("organizerDelegationId") as string) || null;
  const startAtRaw = formData.get("startAt") as string;
  const endAtRaw = formData.get("endAt") as string;
  const venue = (formData.get("venue") as string)?.trim() || null;
  const visibility = formData.get("visibility") as string;
  const dressCode = (formData.get("dressCode") as string)?.trim() || null;
  if (!eventId || !name || !programType || !organizerType || !visibility) return;

  const membership = await getCurrentMembership();
  if (!membership || membership.role === "PCO_FIELD") return;

  const supabase = await createServerSupabaseClient();
  await supabase.from("program").insert({
    tenant_id: membership.tenantId,
    event_id: eventId,
    name,
    program_type: programType,
    organizer_type: organizerType,
    organizer_delegation_id: organizerType === "DELEGATION" ? organizerDelegationId : null,
    start_at: startAtRaw ? new Date(startAtRaw).toISOString() : null,
    end_at: endAtRaw ? new Date(endAtRaw).toISOString() : null,
    venue,
    visibility,
    dress_code: dressCode,
  });

  revalidatePath(`/console/events/${eventId}/programs`);
}

export async function confirmProgram(formData: FormData) {
  const id = formData.get("id") as string;
  const eventId = formData.get("eventId") as string;
  if (!id) return;

  const supabase = await createServerSupabaseClient();
  await supabase.rpc("confirm_program", { p_program_id: id });
  revalidatePath(`/console/events/${eventId}/programs`);
  revalidatePath(`/console/events/${eventId}/programs/${id}`);
}

export async function cancelProgram(formData: FormData) {
  const id = formData.get("id") as string;
  const eventId = formData.get("eventId") as string;
  if (!id) return;

  const supabase = await createServerSupabaseClient();
  await supabase.rpc("cancel_program", { p_program_id: id });
  revalidatePath(`/console/events/${eventId}/programs`);
  revalidatePath(`/console/events/${eventId}/programs/${id}`);
}

// 참석 대상 지정 (PCO 전용, P02-C 2단계) — 참가자 단위로 역할을 지정합니다.
export async function addProgramAttendance(formData: FormData) {
  const programId = formData.get("programId") as string;
  const participantId = formData.get("participantId") as string;
  const role = formData.get("role") as string;
  const revalidateTo = formData.get("revalidateTo") as string;
  if (!programId || !participantId || !role) return;

  const membership = await getCurrentMembership();
  if (!membership || membership.role === "PCO_FIELD") return;

  const supabase = await createServerSupabaseClient();
  await supabase.from("program_attendance").insert({
    tenant_id: membership.tenantId,
    program_id: programId,
    participant_id: participantId,
    role,
  });

  if (revalidateTo) revalidatePath(revalidateTo);
}

export async function removeProgramAttendance(formData: FormData) {
  const id = formData.get("id") as string;
  const revalidateTo = formData.get("revalidateTo") as string;
  if (!id) return;

  const supabase = await createServerSupabaseClient();
  await supabase.from("program_attendance").delete().eq("id", id);
  if (revalidateTo) revalidatePath(revalidateTo);
}

// 대리인의 참석 회신 (자기 대표단 참가자만, S13). PCO도 대신 지정할 수 있습니다.
export async function respondProgramAttendance(formData: FormData) {
  const id = formData.get("id") as string;
  const status = formData.get("status") as string;
  const revalidateTo = formData.get("revalidateTo") as string;
  if (!id || !status) return;

  const supabase = await createServerSupabaseClient();
  await supabase.from("program_attendance").update({ status }).eq("id", id);
  if (revalidateTo) revalidatePath(revalidateTo);
}
