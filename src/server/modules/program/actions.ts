"use server";

import { revalidatePath } from "next/cache";
import { revalidateLinkedViews } from "@/server/revalidate-linked-views";
import { fromFormDateTime } from "@/lib/date";
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
    start_at: startAtRaw ? fromFormDateTime(startAtRaw) : null,
    end_at: endAtRaw ? fromFormDateTime(endAtRaw) : null,
    venue,
    visibility,
    dress_code: dressCode,
  });

  revalidateLinkedViews();
  revalidatePath(`/console/events/${eventId}/programs`);
}

export async function confirmProgram(formData: FormData) {
  const id = formData.get("id") as string;
  const eventId = formData.get("eventId") as string;
  if (!id) return;

  const supabase = await createServerSupabaseClient();
  await supabase.rpc("confirm_program", { p_program_id: id });
  revalidatePath(`/console/events/${eventId}/programs`);
  revalidateLinkedViews();
  revalidatePath(`/console/events/${eventId}/programs/${id}`);
}

export async function cancelProgram(formData: FormData) {
  const id = formData.get("id") as string;
  const eventId = formData.get("eventId") as string;
  if (!id) return;

  const supabase = await createServerSupabaseClient();
  await supabase.rpc("cancel_program", { p_program_id: id });
  revalidateLinkedViews();
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

  revalidateLinkedViews();
  if (revalidateTo) revalidatePath(revalidateTo);
}

export async function removeProgramAttendance(formData: FormData) {
  const id = formData.get("id") as string;
  const revalidateTo = formData.get("revalidateTo") as string;
  if (!id) return;

  const supabase = await createServerSupabaseClient();
  await supabase.from("program_attendance").delete().eq("id", id);
  revalidateLinkedViews();
  if (revalidateTo) revalidatePath(revalidateTo);
}

// 대리인의 참석 회신 (자기 대표단 참가자만, S13). PCO도 대신 지정할 수 있습니다.
export async function respondProgramAttendance(formData: FormData) {
  const id = formData.get("id") as string;
  const status = formData.get("status") as string;
  const revalidateTo = formData.get("revalidateTo") as string;
  if (!id || !["CONFIRMED", "DECLINED"].includes(status)) return;

  const supabase = await createServerSupabaseClient();
  const result = await supabase.from("program_attendance").update({ status }).eq("id", id).select("id").maybeSingle();
  if (result.error || !result.data) throw new Error("일정 참석 회신을 저장하지 못했습니다.");
  revalidateLinkedViews();
  if (revalidateTo) revalidatePath(revalidateTo);
}

// 대표단 자체 일정 등록 (대리인 전용, BR-02C-9~12·PX-11). PCO 검토 없이 곧바로 확정됩니다.
// 차량 지원 여부는 아직 지원 정책 화면이 없어서 "일단 항상 지원"으로 단순화했습니다
// (의뢰인 결정) — 나중에 지원 정책 화면이 생기면 이 판정만 바꾸면 됩니다.
export async function registerSelfScheduledProgram(formData: FormData) {
  const delegationId = formData.get("delegationId") as string;
  const eventId = formData.get("eventId") as string;
  const revalidateTo = formData.get("revalidateTo") as string;
  const name = (formData.get("name") as string)?.trim();
  const startAtRaw = formData.get("startAt") as string;
  const venue = (formData.get("venue") as string)?.trim() || null;
  const transferNeeded = formData.get("transferNeeded") === "on";
  const participantIds = formData.getAll("participantIds") as string[];
  if (!delegationId || !eventId || !name || !startAtRaw || participantIds.length === 0) return;

  const startAt = fromFormDateTime(startAtRaw);
  const lateRegistration = new Date(startAt).getTime() - Date.now() < 24 * 60 * 60 * 1000;

  const supabase = await createServerSupabaseClient();
  const { data: delegation } = await supabase.from("delegation").select("tenant_id, event_id").eq("id", delegationId).single();
  if (!delegation) return;
  if (delegation.event_id !== eventId) throw new Error("대표단의 행사와 일정의 행사가 일치하지 않습니다.");
  const participants = await supabase.from("participant").select("id").eq("delegation_id", delegationId).in("id", participantIds);
  if (participants.error || participants.data?.length !== new Set(participantIds).size || new Set(participantIds).size !== participantIds.length) throw new Error("해당 대표단의 참가자를 선택해 주세요.");

  const { data: program } = await supabase
    .from("program")
    .insert({
      tenant_id: delegation.tenant_id,
      event_id: eventId,
      name,
      program_type: "SELF_SCHEDULED",
      organizer_type: "DELEGATION",
      organizer_delegation_id: delegationId,
      registered_by_type: "PROXY",
      transfer_needed: transferNeeded,
      late_registration: lateRegistration,
      start_at: startAt,
      venue,
      visibility: "STAKEHOLDER",
      status: "CONFIRMED",
    })
    .select()
    .single();
  if (!program) return;

  await supabase.from("program_attendance").insert(
    participantIds.map((participantId) => ({
      tenant_id: delegation.tenant_id,
      program_id: program.id,
      participant_id: participantId,
      role: "ATTENDEE",
      status: "CONFIRMED",
    })),
  );

  if (transferNeeded) {
    await supabase.rpc("generate_self_scheduled_transfer", {
      p_program_id: program.id,
      p_participant_ids: participantIds,
    });
  }

  revalidateLinkedViews();
  if (revalidateTo) revalidatePath(revalidateTo);
}

export async function sendProgramAdjustNote(formData: FormData) {
  const id = formData.get("id") as string;
  const note = (formData.get("note") as string)?.trim();
  const eventId = formData.get("eventId") as string;
  if (!id || !note) return;

  const supabase = await createServerSupabaseClient();
  await supabase.rpc("send_program_adjust_note", { p_program_id: id, p_note: note });
  revalidatePath(`/console/events/${eventId}/programs/${id}`);
}
