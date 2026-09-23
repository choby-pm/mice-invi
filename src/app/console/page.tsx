import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { EventBoard } from "@/components/console/event-board";

export default async function ConsoleHomePage() {
  const supabase = await createServerSupabaseClient();
  const { data: events } = await supabase
    .from("event")
    .select("id, name, status, created_at")
    .order("created_at", { ascending: false });

  return <EventBoard events={events ?? []} />;
}
