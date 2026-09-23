"use server";

import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// 대리인이 초청 메일 링크를 눌러 세션이 생긴 직후 호출됩니다.
// "PX->>SYS: 링크 클릭 ... SYS->>PCO: 대표단 상태 '열람'으로 변경" (P04) 을 구현합니다.
// delegation_proxy/delegation 갱신은 대리인 본인 권한 밖이라 관리자 키로 처리합니다
// (본인 세션으로 auth.uid()를 이미 확인했으므로 정당한 대행입니다).
export async function activateProxyMembership() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const admin = createAdminClient();
  const { data: pending } = await admin
    .from("delegation_proxy")
    .select("id, delegation_id")
    .eq("user_id", user.id)
    .eq("status", "PENDING");

  for (const row of pending ?? []) {
    await admin.from("delegation_proxy").update({ status: "ACTIVE" }).eq("id", row.id);
    await admin
      .from("delegation")
      .update({ invite_status: "OPENED" })
      .eq("id", row.delegation_id)
      .eq("invite_status", "SENT");
  }
}
