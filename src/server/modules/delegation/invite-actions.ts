"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMembership } from "@/server/modules/org/get-membership";
import { getSiteUrl } from "@/lib/site-url";

// 대표단 초청 발송 (P04). 대리인은 비밀번호 없이 이메일 인증번호로 로그인하므로
// Supabase의 초청 메일 링크로 세션만 확인시키고, 실제 로그인은 매번 OTP로 합니다.
export async function inviteDelegate(formData: FormData) {
  const eventId = formData.get("eventId") as string;
  const delegationId = formData.get("delegationId") as string;
  const email = (formData.get("email") as string)?.trim();
  if (!eventId || !delegationId || !email) return;

  const membership = await getCurrentMembership();
  if (!membership || membership.role === "PCO_FIELD") return;

  const admin = createAdminClient();

  let userId: string;
  let initialStatus: "PENDING" | "ACTIVE";
  const { data: existingList } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = existingList.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (existing) {
    // 이미 이메일 인증을 거친 계정이라면 다시 초대 링크를 누를 필요 없이 바로 배정합니다
    // (다음에 OTP로 로그인하면 새 대표단이 보입니다).
    userId = existing.id;
    initialStatus = "ACTIVE";
  } else {
    const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${getSiteUrl()}/portal-accept-invite`,
    });
    if (error || !invited.user) return;
    userId = invited.user.id;
    initialStatus = "PENDING";
  }

  const { error: proxyError } = await admin
    .from("delegation_proxy")
    .insert({ tenant_id: membership.tenantId, delegation_id: delegationId, user_id: userId, status: initialStatus });
  if (proxyError) return; // 이미 배정된 경우 등 — 조용히 무시 (unique 제약)

  await admin
    .from("delegation")
    .update({ invite_status: initialStatus === "ACTIVE" ? "OPENED" : "SENT" })
    .eq("id", delegationId)
    .eq("invite_status", "READY");

  revalidatePath(`/console/events/${eventId}/delegations/${delegationId}`);
}
