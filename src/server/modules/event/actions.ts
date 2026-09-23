"use server";

import { revalidatePath } from "next/cache";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/server/modules/org/get-membership";

// 상태 값을 직접 API로 바꾸지 않는다는 원칙(03 §2.1)은 R4 영향 엔진이 붙는 서비스 상태부터 적용됩니다.
// 행사 자체의 준비/진행/종료는 아직 그 대상이 아니라 R1에서는 직접 필드로 둡니다.
export async function createEvent(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  if (!name) return;

  const membership = await getCurrentMembership();
  if (!membership || membership.role === "PCO_FIELD") return; // RLS도 막지만 화면에서도 먼저 막음

  const supabase = await createServerSupabaseClient();
  await supabase.from("event").insert({ tenant_id: membership.tenantId, name });
  revalidatePath("/console");
}

export async function updateEvent(formData: FormData) {
  const id = formData.get("id") as string;
  const name = (formData.get("name") as string)?.trim();
  if (!id || !name) return;

  const supabase = await createServerSupabaseClient();
  await supabase.from("event").update({ name }).eq("id", id);
  revalidatePath("/console");
}

// '준비 중' 행사만 삭제 가능 (D-UI-05). 그 외 상태는 화면에서 삭제 버튼 자체를 숨깁니다.
export async function deleteEvent(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) return;

  const supabase = await createServerSupabaseClient();
  await supabase.from("event").delete().eq("id", id).eq("status", "PREPARING");
  revalidatePath("/console");
}
