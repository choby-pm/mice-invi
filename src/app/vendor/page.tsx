import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { TaskList } from "@/components/vendor/task-list";
import { AdjustmentList } from "@/components/vendor/adjustment-list";

export default async function VendorHomePage() {
  const supabase = await createServerSupabaseClient();
  const [{ data: items }, { data: adjustmentItems }] = await Promise.all([
    supabase
      .from("service_item")
      .select(
        "id, service_type, status, note, confirmation_note, scheduled_at, delegation:delegation_id(id, name, event:event_id(name), participant(id, first_name, last_name, participant_type)), flight_request(*), flight_segment(*), lodging_request(*), room_assignment(*), transfer_request(*), vehicle_dispatch(*), airport_request(*), airport_assignment(*), dietary_requirement(*, participant:participant_id(first_name, last_name))",
      )
      .in("status", ["REQUESTED", "IN_PROGRESS", "CONFIRMED"])
      .order("status"),
    supabase
      .from("adjustment_item")
      .select(
        "id, status, urgency, instruction, due_at, service_item:service_item_id(service_type), issue:issue_id(issue_no, delegation:delegation_id(name, event:event_id(name)))",
      )
      .in("status", ["ACTION_REQUIRED", "IN_PROGRESS"])
      .order("urgency"),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">통합 할 일 (VD-03)</h1>
      <AdjustmentList items={(adjustmentItems ?? []) as never} />
      <TaskList items={(items ?? []) as never} />
    </div>
  );
}
