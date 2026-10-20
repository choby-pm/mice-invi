import { notFound } from "next/navigation";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ParticipantList } from "@/components/console/participant-list";
import { ConsentChecklist } from "@/components/portal/consent-checklist";
import { RsvpBanner } from "@/components/portal/rsvp-banner";
import { ServiceRequestList } from "@/components/portal/service-request-list";
import { ProgramList } from "@/components/portal/program-list";
import { getConsentChecklist } from "@/server/modules/consent/portal-actions";
import { BlankScreen } from "@/components/shared/blank-screen";
import { SERVICE_DETAILS_SELECT } from "@/lib/service-detail-query";
import { getMessages } from "@/i18n/get-messages";
import { ServiceUpdates } from "@/components/shared/service-updates";

export default async function PortalDelegationPage({
  params,
}: {
  params: Promise<{ delegationId: string }>;
}) {
  const { delegationId } = await params;
  const { locale } = await getMessages();
  const supabase = await createServerSupabaseClient();
  const { data: delegation } = await supabase
    .from("delegation")
    .select("id, name, organization, event_id, rsvp")
    .eq("id", delegationId)
    .single();
  if (!delegation) notFound();

  const revalidateTo = `/portal/delegation/${delegationId}`;

  const [{ data: participants }, { data: serviceItems }, { data: programs }] = await Promise.all([
    supabase
      .from("participant")
      .select("id, first_name, last_name, participant_type")
      .eq("delegation_id", delegationId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("service_item")
      .select(SERVICE_DETAILS_SELECT)
      .eq("delegation_id", delegationId)
      .order("service_type"),
    supabase
      .from("program")
      .select("id, name, program_type, start_at, venue, status, late_registration, pco_adjust_note, program_attendance(id, status, participant:participant_id(id, first_name, last_name))")
      .eq("event_id", delegation.event_id)
      .order("start_at", { ascending: true, nullsFirst: false }),
  ]);

  const declined = delegation.rsvp === "DECLINED";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">{delegation.name}</h1>
        <p className="text-sm text-muted-foreground">{delegation.organization}</p>
      </div>

      <RsvpBanner delegationId={delegationId} rsvp={delegation.rsvp} revalidateTo={revalidateTo} />
      <ServiceUpdates audience="portal" delegationId={delegationId} locale={locale} />

      {!declined && (
        <>
          <ParticipantList delegationId={delegationId} revalidateTo={revalidateTo} participants={participants ?? []} />

          {participants && participants.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">참가자별 동의 확인</h2>
              {await Promise.all(
                participants.map(async (p) => {
                  const checklist = await getConsentChecklist(delegation.event_id, p.id);
                  return (
                    <Card key={p.id}>
                      <CardHeader>
                        <CardTitle className="text-sm">
                          {p.last_name} {p.first_name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {!checklist ? (
                          <p className="text-sm text-muted-foreground">아직 게시된 동의서가 없습니다.</p>
                        ) : (
                          <ConsentChecklist
                            delegationId={delegationId}
                            participantId={p.id}
                            policyVersion={checklist.policy.version}
                            noticeKo={checklist.policy.notice_body?.ko}
                            items={checklist.items}
                            revalidateTo={revalidateTo}
                          />
                        )}
                      </CardContent>
                    </Card>
                  );
                }),
              )}
            </div>
          )}

          {(!participants || participants.length === 0) && (
            <BlankScreen title="아직 참가자가 없습니다" note="위에서 참가자를 먼저 추가하면 동의 확인이 여기에 나타납니다." />
          )}

          {serviceItems && serviceItems.length > 0 && (
            <section id="flight" className="scroll-mt-4">
              <ServiceRequestList items={serviceItems as never} participants={participants ?? []} revalidateTo={revalidateTo} />
            </section>
          )}

          <section id="schedule" className="scroll-mt-4">
            <ProgramList
              delegationId={delegationId}
              eventId={delegation.event_id}
              programs={(programs ?? []) as never}
              participants={participants ?? []}
              revalidateTo={revalidateTo}
            />
          </section>
        </>
      )}
    </div>
  );
}
