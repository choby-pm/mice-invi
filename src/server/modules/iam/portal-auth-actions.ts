"use server";

import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/demo";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

// 대리인 로그인은 이메일 인증번호(OTP)입니다 (D-UX-03) — 비밀번호가 없습니다.
// shouldCreateUser: false — PCO가 초청한 이메일만 로그인할 수 있고, 아무나 입력해서
// 새 계정이 만들어지지 않습니다 (BR-04-1).
export async function requestPortalOtp(formData: FormData) {
  if (isDemoMode()) redirect("/login");
  const email = (formData.get("email") as string)?.trim();
  if (!email) redirect("/portal-login?error=" + encodeURIComponent("이메일을 입력하세요"));

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (error) {
    redirect("/portal-login?error=" + encodeURIComponent("초청받은 이메일이 아니거나 오류가 발생했습니다"));
  }
  redirect(`/portal-login?step=verify&email=${encodeURIComponent(email)}`);
}

export async function verifyPortalOtp(formData: FormData) {
  if (isDemoMode()) redirect("/login");
  const email = formData.get("email") as string;
  const token = (formData.get("token") as string)?.trim();
  if (!email || !token) {
    redirect(`/portal-login?step=verify&email=${encodeURIComponent(email ?? "")}&error=${encodeURIComponent("인증번호를 입력하세요")}`);
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) {
    redirect(`/portal-login?step=verify&email=${encodeURIComponent(email)}&error=${encodeURIComponent("인증번호가 올바르지 않습니다")}`);
  }
  redirect("/portal");
}

export async function portalLogout() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/portal-login");
}
