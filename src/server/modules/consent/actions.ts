"use server";

import { revalidatePath } from "next/cache";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/server/modules/org/get-membership";

// 동의서는 첫 게시 전까지는 자유롭게 수정합니다. 게시 이후 수정은 새 버전으로 저장하는
// 규칙(BR-02-3)은 실제 동의 기록이 쌓이는 초청 발송 단계에서 마저 구현합니다.
export async function createPolicy(formData: FormData) {
  const eventId = formData.get("eventId") as string;
  if (!eventId) return;

  const membership = await getCurrentMembership();
  if (!membership || membership.role === "PCO_FIELD") return;

  const supabase = await createServerSupabaseClient();
  const { data: latest } = await supabase
    .from("consent_policy")
    .select("version")
    .eq("event_id", eventId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = (latest?.version ?? 0) + 1;

  await supabase.from("consent_policy").insert({ tenant_id: membership.tenantId, event_id: eventId, version: nextVersion });
  revalidatePath(`/console/events/${eventId}/consent`);
}

export async function updateNoticeBody(formData: FormData) {
  const policyId = formData.get("policyId") as string;
  const eventId = formData.get("eventId") as string;
  const ko = formData.get("noticeKo") as string;
  const en = formData.get("noticeEn") as string;
  if (!policyId) return;

  const supabase = await createServerSupabaseClient();
  await supabase.from("consent_policy").update({ notice_body: { ko, en } }).eq("id", policyId);
  revalidatePath(`/console/events/${eventId}/consent`);
}

export async function addConsentItem(formData: FormData) {
  const policyId = formData.get("policyId") as string;
  const eventId = formData.get("eventId") as string;
  const category = formData.get("category") as string;
  const textKo = formData.get("textKo") as string;
  const textEn = formData.get("textEn") as string;
  const required = formData.get("required") === "on";
  if (!policyId || !eventId || !category || !textKo) return;

  const membership = await getCurrentMembership();
  if (!membership || membership.role === "PCO_FIELD") return;

  const supabase = await createServerSupabaseClient();
  await supabase.from("consent_item").insert({
    tenant_id: membership.tenantId,
    event_id: eventId,
    policy_id: policyId,
    category,
    text: { ko: textKo, en: textEn },
    required,
  });
  revalidatePath(`/console/events/${eventId}/consent`);
}

export async function deleteConsentItem(formData: FormData) {
  const id = formData.get("id") as string;
  const eventId = formData.get("eventId") as string;
  if (!id) return;

  const supabase = await createServerSupabaseClient();
  await supabase.from("consent_item").delete().eq("id", id);
  revalidatePath(`/console/events/${eventId}/consent`);
}

export async function publishPolicy(formData: FormData) {
  const policyId = formData.get("policyId") as string;
  const eventId = formData.get("eventId") as string;
  if (!policyId) return;

  const supabase = await createServerSupabaseClient();
  // 같은 행사의 이전 현재 버전은 내리고, 이번 버전을 현재로 올림
  await supabase.from("consent_policy").update({ is_current: false }).eq("event_id", eventId).eq("is_current", true);
  await supabase.from("consent_policy").update({ is_current: true, published_at: new Date().toISOString() }).eq("id", policyId);
  revalidatePath(`/console/events/${eventId}/consent`);
}
