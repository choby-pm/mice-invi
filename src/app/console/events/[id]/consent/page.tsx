import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createPolicy } from "@/server/modules/consent/actions";
import { ConsentBoard } from "@/components/console/consent-board";
import { Button } from "@/components/ui/button";
import { BlankScreen } from "@/components/shared/blank-screen";

export default async function ConsentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: policy } = await supabase
    .from("consent_policy")
    .select("id, version, is_current, notice_body")
    .eq("event_id", eventId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!policy) {
    return (
      <div className="space-y-4">
        <BlankScreen title="아직 동의서가 없습니다" note="필수/선택/민감정보 동의 항목을 정의하고, 대리인 포털에 보여줄 안내문을 작성합니다." />
        <form action={createPolicy} className="flex justify-center">
          <input type="hidden" name="eventId" value={eventId} />
          <Button type="submit">동의서 만들기</Button>
        </form>
      </div>
    );
  }

  const { data: items } = await supabase
    .from("consent_item")
    .select("id, category, text, required")
    .eq("policy_id", policy.id)
    .order("sort_order", { ascending: true });

  return <ConsentBoard eventId={eventId} policy={policy} items={items ?? []} />;
}
