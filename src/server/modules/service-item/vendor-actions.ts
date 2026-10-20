"use server";

import { revalidateLinkedViews } from "@/server/revalidate-linked-views";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

// 업체 쪽 행동 API 2개 — 상태는 여기서만 바뀝니다(03 §2.1).
// 확정 데이터(confirmation_note)는 요청 데이터(note)와 다른 열에 저장합니다 —
// "요청 데이터/확정 데이터 분리"가 이 제품의 핵심 가치라서요.
export async function startServiceItem(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) return;

  const supabase = await createServerSupabaseClient();
  const result = await supabase.from("service_item").update({ status: "IN_PROGRESS" }).eq("id", id).eq("status", "REQUESTED").select("id").maybeSingle();
  if (result.error || !result.data) throw new Error("업무를 시작하지 못했습니다. 담당 권한과 현재 상태를 확인해 주세요.");
  revalidateLinkedViews();
}

export async function confirmServiceItem(formData: FormData) {
  const id = formData.get("id") as string;
  const confirmationNote = (formData.get("confirmationNote") as string)?.trim() || null;
  if (!id) return;

  const supabase = await createServerSupabaseClient();
  const result = await supabase
    .from("service_item")
    .update({ status: "CONFIRMED", confirmation_note: confirmationNote, confirmed_at: new Date().toISOString() })
    .eq("id", id).in("status", ["REQUESTED", "IN_PROGRESS", "CHANGING", "CONFIRMED", "NOTIFIED"]).select("id").maybeSingle();
  if (result.error || !result.data) throw new Error("확정 정보를 저장하지 못했습니다. 담당 권한과 현재 상태를 확인해 주세요.");
  revalidateLinkedViews();
}

export async function confirmServiceCancellation(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("confirmationNote") ?? "").trim();
  if (!id || !note || note.length > 2000) throw new Error("취소 결과와 발생 비용을 입력해 주세요.");
  const client = await createServerSupabaseClient();
  const result = await client.from("service_item").update({ status: "CANCELLED", confirmation_note: note, confirmed_at: new Date().toISOString() }).eq("id", id).eq("status", "CANCEL_REQ").select("id").maybeSingle();
  if (result.error || !result.data) throw new Error("취소를 완료하지 못했습니다. 담당 권한과 현재 상태를 확인해 주세요.");
  revalidateLinkedViews();
}
