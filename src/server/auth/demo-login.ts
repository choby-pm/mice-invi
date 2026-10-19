"use server";

import { redirect } from "next/navigation";
import { DEMO_ROLES, isDemoMode } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import { getDemoAccount } from "@/server/auth/demo-account";

export async function demoLogin(formData: FormData) {
  if (!isDemoMode()) redirect("/login");
  const option = DEMO_ROLES.find((entry) => entry.role === formData.get("role"));
  if (!option) redirect("/login?error=" + encodeURIComponent("데모 역할을 선택해 주세요."));
  let failed = false;
  try {
    const { admin, email } = await getDemoAccount(option.role);
    // Generate a server-only token for a verified demo account; no email or password is sent.
    const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (error) throw error;
    const supabase = await createClient();
    const { error: sessionError } = await supabase.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: "magiclink" });
    if (sessionError) throw sessionError;
  } catch {
    failed = true;
  }
  if (failed) redirect("/login?error=" + encodeURIComponent("데모에 연결하지 못했습니다. DB 연결과 데모 데이터 생성 상태를 확인해 주세요."));
  redirect(option.path);
}
