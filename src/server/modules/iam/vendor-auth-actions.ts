"use server";

import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/demo";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

// 업체는 PCO 콘솔처럼 이메일+비밀번호로 로그인합니다(계정 하나로 여러 PCO 프로젝트를
// 오가며 씀 — BR-01-1). 대리인과 달리 반복 방문이 잦아 매번 인증번호를 받기보다
// 비밀번호가 더 자연스럽다고 판단했습니다.
export async function logInVendor(formData: FormData) {
  if (isDemoMode()) redirect("/login");
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect("/vendor-login?error=" + encodeURIComponent("이메일 또는 비밀번호가 올바르지 않습니다"));
  }
  redirect("/vendor");
}

export async function vendorLogout() {
  // 데모 세션은 모든 체험자가 공유하므로 끊지 않고 데모 첫 화면으로만 돌아갑니다.
  if (isDemoMode()) redirect("/login");
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/vendor-login");
}
