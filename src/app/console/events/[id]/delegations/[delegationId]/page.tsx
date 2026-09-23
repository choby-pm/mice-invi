import { notFound } from "next/navigation";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BlankScreen } from "@/components/shared/blank-screen";

export default async function DelegationDetailPage({
  params,
}: {
  params: Promise<{ id: string; delegationId: string }>;
}) {
  const { delegationId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: delegation } = await supabase
    .from("delegation")
    .select("id, name, country, organization, invite_code")
    .eq("id", delegationId)
    .single();
  if (!delegation) notFound();

  const { data: participants } = await supabase
    .from("participant")
    .select("id, first_name, last_name, participant_type")
    .eq("delegation_id", delegationId)
    .order("sort_order", { ascending: true });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{delegation.name}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {delegation.organization} · {delegation.country}
        </CardContent>
      </Card>

      {!participants || participants.length === 0 ? (
        <BlankScreen title="참가자가 아직 없습니다" note="참가자 추가 화면은 다음 조각(🔒 민감정보 이후)에서 만듭니다." />
      ) : (
        <ul className="divide-y rounded-lg border">
          {participants.map((p) => (
            <li key={p.id} className="px-4 py-2 text-sm">
              {p.last_name} {p.first_name} · {p.participant_type}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
