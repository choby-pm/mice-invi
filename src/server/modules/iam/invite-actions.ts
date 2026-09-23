"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMembership } from "@/server/modules/org/get-membership";
import { getSiteUrl } from "@/lib/site-url";

const VALID_ROLES = new Set(["PCO_ADMIN", "PCO_MANAGER", "PCO_FIELD"]);

// 직원 초대 (03 §1.4 iam/org 모듈). Supabase 기본 메일 발송을 씁니다 — 브랜드 발신
// 주소(Resend, D-SY-11)는 아직 없어서 초대 메일은 Supabase 공용 주소로 나갑니다.
export async function inviteStaff(formData: FormData) {
  const email = (formData.get("email") as string)?.trim();
  const role = formData.get("role") as string;

  const membership = await getCurrentMembership();
  if (!membership || membership.role !== "PCO_ADMIN") {
    redirect("/console/team?error=" + encodeURIComponent("관리자만 초대할 수 있습니다"));
  }
  if (!email || !VALID_ROLES.has(role)) {
    redirect("/console/team?error=" + encodeURIComponent("이메일과 역할을 확인하세요"));
  }

  const admin = createAdminClient();
  const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${getSiteUrl()}/accept-invite`,
  });
  if (error || !invited.user) {
    redirect("/console/team?error=" + encodeURIComponent(error?.message ?? "초대 실패"));
    return;
  }

  const { error: memberError } = await admin
    .from("tenant_member")
    .insert({ tenant_id: membership!.tenantId, user_id: invited.user.id, role });
  if (memberError) {
    await admin.auth.admin.deleteUser(invited.user.id);
    redirect("/console/team?error=" + encodeURIComponent("팀 등록 실패: " + memberError.message));
    return;
  }

  revalidatePath("/console/team");
  redirect("/console/team?invited=" + encodeURIComponent(email));
}
