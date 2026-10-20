import { notFound } from "next/navigation";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ParticipantList } from "@/components/console/participant-list";
import { DelegateList } from "@/components/console/delegate-list";
import { DelegationMatrix } from "@/components/console/delegation-matrix";

export default async function DelegationDetailPage({
  params,
}: {
  params: Promise<{ id: string; delegationId: string }>;
}) {
  const { id: eventId, delegationId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: delegation } = await supabase
    .from("delegation")
    .select("id, name, country, organization, invite_code, delegation_internal(note)")
    .eq("id", delegationId)
    .single();
  if (!delegation) notFound();

  const [{ data: participants }, { data: serviceItems }, { data: proxies }] = await Promise.all([
    supabase
      .from("participant")
      .select("id, first_name, last_name, participant_type")
      .eq("delegation_id", delegationId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("service_item")
      .select("id, service_type, status, room_assignment(*), vehicle_dispatch(*), transfer_request(*)")
      .eq("delegation_id", delegationId),
    supabase
      .from("delegation_proxy")
      .select("id, user_id, status")
      .eq("delegation_id", delegationId)
      .order("created_at", { ascending: true }),
  ]);

  const admin = createAdminClient();
  const delegates = await Promise.all(
    (proxies ?? []).map(async (p) => {
      const { data } = await admin.auth.admin.getUserById(p.user_id);
      return { id: p.id, status: p.status, email: data.user?.email ?? "(알 수 없음)" };
    }),
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{delegation.name}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {delegation.organization} · {delegation.country}
          {(delegation.delegation_internal as unknown as { note: string } | null)?.note && <p className="mt-3 whitespace-pre-wrap">PCO 내부 메모 · {(delegation.delegation_internal as unknown as { note: string }).note}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">참가자별 서비스 현황</CardTitle>
        </CardHeader>
        <CardContent>
          {/* "서비스 현황" 탭과 같은 service_item 데이터를 참가자 관점으로 보여줍니다(U2, 02 §3.6) —
              어느 쪽에서 바뀌어도 같은 데이터라 항상 같은 상태가 보입니다. */}
          <DelegationMatrix
            participants={participants ?? []}
            serviceItems={(serviceItems ?? []) as never}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">대리인</CardTitle>
        </CardHeader>
        <CardContent>
          <DelegateList eventId={eventId} delegationId={delegationId} delegates={delegates} />
        </CardContent>
      </Card>

      <ParticipantList
        delegationId={delegationId}
        revalidateTo={`/console/events/${eventId}/delegations/${delegationId}`}
        participants={participants ?? []}
      />
    </div>
  );
}
