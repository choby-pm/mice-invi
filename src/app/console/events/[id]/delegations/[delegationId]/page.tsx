import { notFound } from "next/navigation";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BlankScreen } from "@/components/shared/blank-screen";
import { StatusBadge } from "@/components/shared/status-badge";
import { SERVICE_TYPES, SERVICE_STATUS_LABEL, SERVICE_STATUS_BADGE } from "@/lib/service-item-constants";

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

  const [{ data: participants }, { data: serviceItems }] = await Promise.all([
    supabase
      .from("participant")
      .select("id, first_name, last_name, participant_type")
      .eq("delegation_id", delegationId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("service_item")
      .select("id, service_type, status, event_vendor:event_vendor_id(vendor:vendor_id(name))")
      .eq("delegation_id", delegationId),
  ]);

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

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">서비스 항목</CardTitle>
        </CardHeader>
        <CardContent>
          {/* "서비스 현황" 탭과 같은 service_item 데이터를 대표단 관점으로 보여줍니다 —
              어느 쪽에서 바뀌어도 같은 데이터라 항상 같은 상태가 보입니다. */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SERVICE_TYPES.map((t) => {
              const item = serviceItems?.find((si) => si.service_type === t.value);
              return (
                <div key={t.value} className="rounded-md border px-3 py-2">
                  <p className="text-xs text-muted-foreground">{t.label}</p>
                  {item ? (
                    <StatusBadge status={SERVICE_STATUS_BADGE[item.status]} className="mt-1">
                      {SERVICE_STATUS_LABEL[item.status]}
                    </StatusBadge>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">-</p>
                  )}
                </div>
              );
            })}
          </div>
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
