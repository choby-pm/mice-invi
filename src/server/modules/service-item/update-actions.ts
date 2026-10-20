"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidateLinkedViews } from "@/server/revalidate-linked-views";

export async function acknowledgeServiceUpdate(form: FormData) {
  const id = String(form.get("id") ?? "");
  if (!id) throw new Error("변경 항목을 확인해 주세요.");
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");
  const result = await client.from("service_update_receipt").upsert({ update_id: id, user_id: user.id }, { onConflict: "update_id,user_id", ignoreDuplicates: true });
  if (result.error) throw new Error("변경 확인을 저장하지 못했습니다.");
  revalidateLinkedViews();
}
