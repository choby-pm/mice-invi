"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { bootstrapTenant } from "@/server/modules/org/bootstrap-tenant";
import { isDemoMode } from "@/lib/demo";

// PCO 콘솔의 실제 로그인 (D-SY-10). 이메일 인증 메일은 아직 안 붙어 있어(D-SY-11 보류),
// 가입 시 관리자 키로 바로 확인 처리합니다 — 대신 비밀번호를 본인이 직접 정합니다.
export async function signUpPco(formData: FormData) {
  if (isDemoMode()) redirect("/login");
  const tenantName = (formData.get("tenantName") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;

  if (!tenantName || !email || !password || password.length < 8) {
    redirect(
      `/console-signup?error=${encodeURIComponent("회사명, 이메일, 8자 이상 비밀번호를 모두 입력하세요")}`,
    );
  }

  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    redirect(`/console-signup?error=${encodeURIComponent(createError?.message ?? "가입 실패")}`);
    return;
  }

  try {
    await bootstrapTenant(tenantName, created.user.id);
  } catch (e) {
    await admin.auth.admin.deleteUser(created.user.id);
    redirect(`/console-signup?error=${encodeURIComponent("테넌트 생성 실패: " + (e as Error).message)}`);
    return;
  }

  const supabase = await createServerSupabaseClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    redirect(`/console-login?error=${encodeURIComponent("가입은 됐지만 로그인에 실패했습니다. 다시 로그인해주세요")}`);
    return;
  }

  redirect("/console");
}

export async function logInPco(formData: FormData) {
  if (isDemoMode()) redirect("/login");
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/console-login?error=${encodeURIComponent("이메일 또는 비밀번호가 올바르지 않습니다")}`);
    return;
  }

  redirect("/console");
}

export async function logOutPco() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/console-login");
}
