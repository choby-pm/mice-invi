"use server";

import { revalidatePath } from "next/cache";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/server/modules/org/get-membership";
import { assignDefaultServiceVendors } from "@/server/modules/service-item/assign-default-vendors";
import { revalidateLinkedViews } from "@/server/revalidate-linked-views";

export async function createDelegation(formData: FormData) {
  const eventId = formData.get("eventId") as string;
  const name = (formData.get("name") as string)?.trim();
  const country = (formData.get("country") as string)?.trim();
  const organization = (formData.get("organization") as string)?.trim();
  if (!eventId || !name || !country || !organization) return;

  const membership = await getCurrentMembership();
  if (!membership || membership.role === "PCO_FIELD") return;

  const supabase = await createServerSupabaseClient();
  const created = await supabase.from("delegation").insert({
    tenant_id: membership.tenantId,
    event_id: eventId,
    name,
    country,
    organization,
    owner_user_id: membership.userId,
  });
  if (created.error) throw created.error;
  await assignDefaultServiceVendors(supabase, eventId);
  revalidateLinkedViews();
  // DB 트리거가 5개 서비스 유형에 기본 항목을 자동으로 만들어 주므로 그 화면도 갱신합니다.
  revalidatePath(`/console/events/${eventId}/delegations`);
  revalidatePath(`/console/events/${eventId}/services`);
}

export async function updateDelegation(formData: FormData) {
  const id = formData.get("id") as string;
  const eventId = formData.get("eventId") as string;
  const name = (formData.get("name") as string)?.trim();
  const country = (formData.get("country") as string)?.trim();
  const organization = (formData.get("organization") as string)?.trim();
  if (!id || !name || !country || !organization) return;

  const supabase = await createServerSupabaseClient();
  await supabase.from("delegation").update({ name, country, organization }).eq("id", id);
  revalidatePath(`/console/events/${eventId}/delegations`);
}

// 삭제는 관리자만 (RLS도 동일하게 막음 — 대표단 삭제는 무거운 행동이라 event와 같은 기준 적용)
export async function deleteDelegation(formData: FormData) {
  const id = formData.get("id") as string;
  const eventId = formData.get("eventId") as string;
  if (!id) return;

  const supabase = await createServerSupabaseClient();
  await supabase.from("delegation").delete().eq("id", id);
  revalidatePath(`/console/events/${eventId}/delegations`);
}
