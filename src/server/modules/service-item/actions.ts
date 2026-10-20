"use server";

import { revalidatePath } from "next/cache";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/server/modules/org/get-membership";
import { revalidateLinkedViews } from "@/server/revalidate-linked-views";
import { fromFormDateTime } from "@/lib/date";

export async function assignServiceVendor(formData: FormData) {
  const id = String(formData.get("id") ?? ""), eventId = String(formData.get("eventId") ?? ""), vendorId = String(formData.get("eventVendorId") ?? "");
  const membership = await getCurrentMembership();
  if (!membership || membership.role === "PCO_FIELD" || !id || !eventId || !vendorId) throw new Error("담당 업체를 지정할 권한과 항목을 확인해 주세요.");
  const supabase = await createServerSupabaseClient();
  const item = await supabase.from("service_item").select("id, service_type").eq("id", id).eq("event_id", eventId).eq("tenant_id", membership.tenantId).single();
  const vendor = await supabase.from("event_vendor").select("id, service_types, delegation_scope").eq("id", vendorId).eq("event_id", eventId).eq("tenant_id", membership.tenantId).single();
  if (item.error || vendor.error || !vendor.data?.service_types.includes(item.data?.service_type) || vendor.data?.delegation_scope !== "ALL") throw new Error("이 항목을 담당할 수 있는 전체 대표단 담당 업체를 선택해 주세요.");
  const result = await supabase.from("service_item").update({ event_vendor_id: vendorId }).eq("id", id).eq("event_id", eventId).select("id").maybeSingle();
  if (result.error || !result.data) throw new Error("담당 업체를 저장하지 못했습니다.");
  revalidateLinkedViews();
}

// 상태는 여기서 직접 건드리지 않습니다 (03 §2.1) — 새 항목은 항상 DRAFT/REQUESTED로
// 시작하고, 이후 상태 전이(착수·확정·취소 등)는 업체 포털이 생기는 R3에서
// 별도 행동 API로 붙입니다.
export async function createServiceItem(formData: FormData) {
  const eventId = formData.get("eventId") as string;
  const delegationId = formData.get("delegationId") as string;
  const serviceType = formData.get("serviceType") as string;
  const eventVendorId = (formData.get("eventVendorId") as string) || null;
  const supportType = (formData.get("supportType") as string) || null;
  const scheduledAtRaw = formData.get("scheduledAt") as string;
  const scheduledAt = scheduledAtRaw ? fromFormDateTime(scheduledAtRaw) : null;
  if (!eventId || !delegationId || !serviceType) return;

  const membership = await getCurrentMembership();
  if (!membership || membership.role === "PCO_FIELD") return;

  const supabase = await createServerSupabaseClient();
  await supabase.from("service_item").insert({
    tenant_id: membership.tenantId,
    event_id: eventId,
    delegation_id: delegationId,
    service_type: serviceType,
    event_vendor_id: eventVendorId,
    support_type: supportType,
    scheduled_at: scheduledAt,
    status: eventVendorId ? "REQUESTED" : "DRAFT",
  });
  // 대표단 상세 화면도 같은 service_item을 보여주므로 같이 최신화합니다 (한 데이터, 두 화면).
  revalidatePath(`/console/events/${eventId}/services`);
  revalidatePath(`/console/events/${eventId}/delegations/${delegationId}`);
}

// DRAFT 상태일 때만 지울 수 있습니다 — 실제로 업체에 넘어간 뒤의 "취소"는
// 삭제가 아니라 상태 전이로 다뤄야 하므로(R3에서 구현) 여기서 막습니다.
export async function deleteServiceItem(formData: FormData) {
  const id = formData.get("id") as string;
  const eventId = formData.get("eventId") as string;
  const delegationId = formData.get("delegationId") as string | null;
  if (!id) return;

  const supabase = await createServerSupabaseClient();
  await supabase.from("service_item").delete().eq("id", id).eq("status", "DRAFT");
  revalidatePath(`/console/events/${eventId}/services`);
  if (delegationId) revalidatePath(`/console/events/${eventId}/delegations/${delegationId}`);
}
