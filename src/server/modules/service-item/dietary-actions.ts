"use server";

import { revalidatePath } from "next/cache";
import { revalidateLinkedViews } from "@/server/revalidate-linked-views";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { requestStatus } from "@/lib/service-request-status";

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
    throw new Error("식이 요청 형식이 올바르지 않습니다.");
  }
  if (!Array.isArray(entries) || entries.length === 0 || entries.some((e) => !e || typeof e.participantId !== "string" || !Object.hasOwn(DIETARY_LABEL, e.dietaryCode) || (e.note != null && typeof e.note !== "string"))
    || new Set(entries.map((e) => e.participantId)).size !== entries.length) throw new Error("참가자와 식이 요청을 확인해 주세요.");

  const supabase = await createServerSupabaseClient();
  const { data: item } = await supabase.from("service_item").select("status, service_type, delegation_id, dietary_requirement(id, participant_id, dietary_code, note)").eq("id", serviceItemId).single();
  if (!item) return;
  if (item.service_type !== "DIETARY") throw new Error("식이 요청 항목이 아닙니다.");
  const participants = await supabase.from("participant").select("id").eq("delegation_id", item.delegation_id).in("id", entries.map((e) => e.participantId));
  if (participants.error || participants.data?.length !== entries.length) throw new Error("대표단 참가자를 확인해 주세요.");
  const rows = entries.map((e) => ({ service_item_id: serviceItemId, participant_id: e.participantId, dietary_code: e.dietaryCode, note: e.note?.trim() || null }));
  const previous = item.dietary_requirement ?? [];
  const changed = previous.length !== rows.length || rows.some((r) => !previous.some((p) => p.participant_id === r.participant_id && p.dietary_code === r.dietary_code && p.note === r.note));
  const status = requestStatus(item.status, changed);

  const write = await supabase.from("dietary_requirement").upsert(rows, { onConflict: "service_item_id,participant_id" });
  if (write.error) throw write.error;
  const stale = previous.filter((p) => !rows.some((r) => r.participant_id === p.participant_id)).map((p) => p.id);
  if (stale.length) {
    const removed = await supabase.from("dietary_requirement").delete().eq("service_item_id", serviceItemId).in("id", stale);
    if (removed.error) throw removed.error;
  }

  const counts: Record<string, number> = {};
  for (const e of entries) {
    if (e.dietaryCode && e.dietaryCode !== "NONE") counts[e.dietaryCode] = (counts[e.dietaryCode] ?? 0) + 1;
  }
  const summary =
    Object.entries(counts)
      .map(([code, n]) => `${DIETARY_LABEL[code] ?? code} ${n}명`)
      .join(" · ") || "특이사항 없음";

  const update = await supabase
    .from("service_item")
    .update({ note: summary, status })
    .eq("id", serviceItemId).select("id").maybeSingle();
  if (update.error || !update.data) throw new Error("식이 요청을 저장하지 못했습니다.");

  revalidateLinkedViews();
  if (revalidateTo) revalidatePath(revalidateTo);
}
