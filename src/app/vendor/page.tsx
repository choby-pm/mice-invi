import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { TaskList } from "@/components/vendor/task-list";

export default async function VendorHomePage() {
  const supabase = await createServerSupabaseClient();
  const { data: items } = await supabase
    .from("service_item")
    .select(
      "id, service_type, status, note, confirmation_note, scheduled_at, delegation:delegation_id(name, event:event_id(name)), flight_request(*), flight_segment(*)",
    )
    .in("status", ["REQUESTED", "IN_PROGRESS", "CONFIRMED"])
    .order("status");

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">통합 할 일 (VD-03)</h1>
      <TaskList items={(items ?? []) as never} />
    </div>
  );
}
