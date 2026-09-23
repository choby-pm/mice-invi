import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { DelegationBoard } from "@/components/console/delegation-board";

export default async function DelegationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: delegations } = await supabase
    .from("delegation")
    .select("id, name, country, organization, invite_status, completeness")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  return <DelegationBoard eventId={eventId} delegations={delegations ?? []} />;
}
