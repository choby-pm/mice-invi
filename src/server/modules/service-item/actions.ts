"use server";

import { revalidatePath } from "next/cache";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/server/modules/org/get-membership";

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
  const scheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw).toISOString() : null;
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
  revalidatePath(`/console/events/${eventId}/services`);
}

// DRAFT 상태일 때만 지울 수 있습니다 — 실제로 업체에 넘어간 뒤의 "취소"는
// 삭제가 아니라 상태 전이로 다뤄야 하므로(R3에서 구현) 여기서 막습니다.
export async function deleteServiceItem(formData: FormData) {
  const id = formData.get("id") as string;
  const eventId = formData.get("eventId") as string;
  if (!id) return;

  const supabase = await createServerSupabaseClient();
  await supabase.from("service_item").delete().eq("id", id).eq("status", "DRAFT");
  revalidatePath(`/console/events/${eventId}/services`);
}
