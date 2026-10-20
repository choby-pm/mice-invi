import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { ProgramDetail } from "@/components/console/program-detail";

export default async function ProgramDetailPage({
  params,
}: {
  params: Promise<{ id: string; programId: string }>;
}) {
  const { id: eventId, programId } = await params;
  const supabase = await createServerSupabaseClient();

  const [{ data: program }, { data: attendance }, { data: delegations }] = await Promise.all([
    supabase
      .from("program")
      .select("id, name, program_type, organizer_type, organizer_delegation:organizer_delegation_id(name), registered_by_type, transfer_needed, late_registration, pco_adjust_note, start_at, end_at, venue, venue_address, visibility, dress_code, status, program_internal(note)")
      .eq("id", programId)
      .single(),
    supabase
      .from("program_attendance")
      .select("id, role, role_note, status, participant:participant_id(id, first_name, last_name, delegation:delegation_id(name))")
      .eq("program_id", programId),
    supabase
      .from("delegation")
      .select("id, name, participant(id, first_name, last_name)")
      .eq("event_id", eventId)
      .order("name"),
  ]);
  if (!program) notFound();

  const revalidateTo = `/console/events/${eventId}/programs/${programId}`;

  return (
    <div className="space-y-4">
      <Link href={`/console/events/${eventId}/programs`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" />
        하위 행사 목록
      </Link>
      <ProgramDetail
        eventId={eventId}
        program={{ ...program, internal_note: (program.program_internal as unknown as { note: string } | null)?.note ?? null } as never}
        attendance={(attendance ?? []) as never}
        delegations={(delegations ?? []) as never}
        revalidateTo={revalidateTo}
      />
    </div>
  );
}
