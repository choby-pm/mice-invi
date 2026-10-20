"use server";

import { revalidatePath } from "next/cache";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMembership } from "@/server/modules/org/get-membership";
import { getSiteUrl } from "@/lib/site-url";
import { assignDefaultServiceVendors } from "@/server/modules/service-item/assign-default-vendors";
import { revalidateLinkedViews } from "@/server/revalidate-linked-views";

export async function addEventVendor(formData: FormData) {
  const eventId = formData.get("eventId") as string;
  const vendorName = (formData.get("vendorName") as string)?.trim();
  const contactEmail = (formData.get("contactEmail") as string)?.trim();
  const serviceTypes = formData.getAll("serviceTypes") as string[];
  if (!eventId || !vendorName || serviceTypes.length === 0) return;

  const membership = await getCurrentMembership();
  if (!membership || membership.role === "PCO_FIELD") return;

  const supabase = await createServerSupabaseClient();

  // 같은 이름의 업체가 디렉터리에 이미 있으면 재사용 (BR-01-1: 업체 계정은 플랫폼에 하나)
  const { data: existing } = await supabase
    .from("vendor")
    .select("id")
    .ilike("name", vendorName)
    .limit(1)
    .maybeSingle();

  let vendorId = existing?.id;
  if (!vendorId) {
    const { data: created, error } = await supabase.from("vendor").insert({ name: vendorName }).select().single();
    if (error) return;
    vendorId = created.id;
  }

  const assignment = await supabase.from("event_vendor").insert({
    tenant_id: membership.tenantId,
    event_id: eventId,
    vendor_id: vendorId,
    service_types: serviceTypes,
  });
  if (assignment.error) throw assignment.error;
  await assignDefaultServiceVendors(supabase, eventId);
  revalidateLinkedViews();

  // 담당자 이메일을 입력했으면 그 업체의 로그인 계정으로 초청 (플랫폼에 이미 있으면 바로 배정)
  if (contactEmail) {
    const admin = createAdminClient();
    const { data: existingList } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const existingUser = existingList.users.find((u) => u.email?.toLowerCase() === contactEmail.toLowerCase());

    let userId: string;
    if (existingUser) {
      userId = existingUser.id;
    } else {
      const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(contactEmail, {
        redirectTo: `${getSiteUrl()}/vendor-accept-invite`,
      });
      if (error || !invited.user) {
        revalidatePath(`/console/events/${eventId}/vendors`);
        return;
      }
      userId = invited.user.id;
    }

    await admin.from("vendor_member").insert({ vendor_id: vendorId, user_id: userId, role: "ADMIN" }).select();
  }

  revalidatePath(`/console/events/${eventId}/vendors`);
}

export async function removeEventVendor(formData: FormData) {
  const id = formData.get("id") as string;
  const eventId = formData.get("eventId") as string;
  if (!id) return;

  const supabase = await createServerSupabaseClient();
  await supabase.from("event_vendor").delete().eq("id", id);
  revalidatePath(`/console/events/${eventId}/vendors`);
}
