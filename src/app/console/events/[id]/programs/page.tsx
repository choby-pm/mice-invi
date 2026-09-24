import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { ProgramBoard } from "@/components/console/program-board";

export default async function ProgramsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  const supabase = await createServerSupabaseClient();

  const [{ data: programs }, { data: delegations }] = await Promise.all([
    supabase
      .from("program")
      .select("id, name, program_type, organizer_type, status, visibility, start_at, venue, late_registration")
      .eq("event_id", eventId)
      .order("start_at", { ascending: true, nullsFirst: false }),
    supabase.from("delegation").select("id, name").eq("event_id", eventId).order("name"),
  ]);

  return <ProgramBoard eventId={eventId} programs={programs ?? []} delegations={delegations ?? []} />;
}
