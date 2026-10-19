"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/server/modules/org/get-membership";
import { SERVICE_TYPES, SUPPORT_TYPE_LABEL } from "@/lib/service-item-constants";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const settingsUrl = (eventId: string) => `/console/settings?eventId=${encodeURIComponent(eventId)}`;
function fail(eventId: string, message: string): never {
  redirect(`${settingsUrl(eventId)}&error=${encodeURIComponent(message)}`);
}

async function context(form: FormData) {
  const eventId = text(form, "eventId");
  const membership = await getCurrentMembership();
  if (!membership || membership.role === "PCO_FIELD") fail(eventId, "설정을 수정할 권한이 없습니다.");
  const supabase = await createClient();
  const { data: event, error } = await supabase.from("event").select("id")
    .eq("id", eventId).eq("tenant_id", membership.tenantId).maybeSingle();
  if (error || !event) fail(eventId, "행사를 확인할 수 없습니다.");
  return { eventId, membership, supabase };
}

function saved(eventId: string): never {
  revalidatePath("/console/settings");
  revalidatePath(`/console/events/${eventId}`);
  redirect(`${settingsUrl(eventId)}&saved=1`);
}

export async function saveProtocolLevel(form: FormData) {
  const { eventId, membership, supabase } = await context(form);
  const id = text(form, "id");
  const name = text(form, "name");
  const sortText = text(form, "sortOrder");
  const sortOrder = Number(sortText);
  if (!name || name.length > 100 || !/^\d+$/.test(sortText) || !Number.isSafeInteger(sortOrder) || sortOrder > 2147483647) fail(eventId, "등급 이름과 0 이상의 정렬 순서를 확인해 주세요.");
  const payload = { name, sort_order: sortOrder };
  const result = id
    ? await supabase.from("protocol_level").update(payload).eq("id", id).eq("event_id", eventId).eq("tenant_id", membership.tenantId).select("id").maybeSingle()
    : await supabase.from("protocol_level").insert({ ...payload, event_id: eventId, tenant_id: membership.tenantId }).select("id").single();
  if (result.error || !result.data) fail(eventId, "등급을 저장하지 못했습니다. 다시 확인해 주세요.");
  saved(eventId);
}

export async function saveSupportPolicy(form: FormData) {
  const { eventId, membership, supabase } = await context(form);
  const id = text(form, "id");
  const serviceType = text(form, "serviceType");
  const participantType = text(form, "participantType");
  const supportType = text(form, "supportType");
  const overflow = text(form, "overflowSupportType");
  const countText = text(form, "maxCount");
  const count = countText === "" ? null : Number(countText);
  const guideKo = text(form, "guideKo");
  const guideEn = text(form, "guideEn");
  if (!SERVICE_TYPES.some((s) => s.value === serviceType) || !["VIP", "COMPANION", "STAFF", "ALL"].includes(participantType)
    || !Object.hasOwn(SUPPORT_TYPE_LABEL, supportType) || (overflow && !Object.hasOwn(SUPPORT_TYPE_LABEL, overflow))
    || (count !== null && (!/^\d+$/.test(countText) || !Number.isSafeInteger(count) || count > 2147483647))
    || guideKo.length > 5000 || guideEn.length > 5000) fail(eventId, "지원 방식·인원 한도·안내문을 확인해 주세요.");
  const payload = { service_type: serviceType, participant_type: participantType, support_type: supportType,
    max_count: count, overflow_support_type: overflow || null, guide_text: { ko: guideKo, en: guideEn } };
  const result = id
    ? await supabase.from("support_policy").update(payload).eq("id", id).eq("event_id", eventId).eq("tenant_id", membership.tenantId).select("id").maybeSingle()
    : await supabase.from("support_policy").insert({ ...payload, event_id: eventId, tenant_id: membership.tenantId }).select("id").single();
  if (result.error || !result.data) fail(eventId, "지원 정책을 저장하지 못했습니다. 다시 확인해 주세요.");
  saved(eventId);
}
