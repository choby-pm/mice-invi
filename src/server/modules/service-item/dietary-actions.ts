"use server";

import { revalidatePath } from "next/cache";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

const DIETARY_LABEL: Record<string, string> = {
  NONE: "일반",
  HALAL: "할랄",
  VEGETARIAN: "채식",
  VEGAN: "비건",
  KOSHER: "코셔",
  ALLERGY: "알레르기",
  OTHER: "기타",
};

interface DietaryEntry {
  participantId: string;
  dietaryCode: string;
  note?: string;
}

// 식이 요구 저장 (대리인·PCO, P10). 참가자별로 한 행씩 저장합니다 — 확정 쪽(케이터링 업체의
// "반영 확인")은 구조화된 필드가 따로 없어서 기존 행동 API(confirmServiceItem)를 그대로 씁니다.
export async function saveDietaryRequirements(formData: FormData) {
  const serviceItemId = formData.get("serviceItemId") as string;
  const revalidateTo = formData.get("revalidateTo") as string;
  if (!serviceItemId) return;

  let entries: DietaryEntry[] = [];
  try {
    entries = JSON.parse((formData.get("entries") as string) || "[]");
  } catch {
    entries = [];
  }
  entries = entries.filter((e) => e.participantId);

  const supabase = await createServerSupabaseClient();
  const { data: item } = await supabase.from("service_item").select("status").eq("id", serviceItemId).single();
  if (!item) return;

  await supabase.from("dietary_requirement").delete().eq("service_item_id", serviceItemId);
  if (entries.length > 0) {
    await supabase.from("dietary_requirement").insert(
      entries.map((e) => ({
        service_item_id: serviceItemId,
        participant_id: e.participantId,
        dietary_code: e.dietaryCode || "NONE",
        note: e.note?.trim() || null,
      })),
    );
  }

  const counts: Record<string, number> = {};
  for (const e of entries) {
    if (e.dietaryCode && e.dietaryCode !== "NONE") counts[e.dietaryCode] = (counts[e.dietaryCode] ?? 0) + 1;
  }
  const summary =
    Object.entries(counts)
      .map(([code, n]) => `${DIETARY_LABEL[code] ?? code} ${n}명`)
      .join(" · ") || "특이사항 없음";

  await supabase
    .from("service_item")
    .update({ note: summary, status: item.status === "DRAFT" ? "REQUESTED" : item.status })
    .eq("id", serviceItemId);

  if (revalidateTo) revalidatePath(revalidateTo);
}
