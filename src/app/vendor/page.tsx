import { getVendorContext } from "@/server/auth/vendor-context";
import { TaskList } from "@/components/vendor/task-list";
import { AdjustmentList } from "@/components/vendor/adjustment-list";

export default async function VendorHomePage() {
  const { supabase, assignments, memberships, flightDemo } = await getVendorContext();
  const assignmentIds = assignments.map((a) => a.id);
  if (!assignmentIds.length) return <p>아직 배정된 행사가 없습니다.</p>;
  const [serviceResult, adjustmentResult] = await Promise.all([
    supabase
      .from("service_item")
      .select(
        "id, service_type, status, note, confirmation_note, scheduled_at, delegation:delegation_id(id, name, event:event_id(name), participant(id, first_name, last_name, participant_type)), flight_request(*), flight_segment(*), lodging_request(*), room_assignment(*), transfer_request(*), vehicle_dispatch(*), airport_request(*), airport_assignment(*), dietary_requirement(*, participant:participant_id(first_name, last_name))",
      )
      .in("event_vendor_id", assignmentIds)
      .in("status", ["REQUESTED", "IN_PROGRESS", "CONFIRMED", "CHANGING", "CANCEL_REQ"])
      .order("status"),
    supabase
      .from("adjustment_item")
      .select(
        "id, status, urgency, instruction, due_at, service_item:service_item_id(service_type), issue:issue_id(issue_no, delegation:delegation_id(name, event:event_id(name)))",
      )
      .in("assignee_vendor_id", memberships.map((m) => m.vendor.id))
      .in("status", ["ACTION_REQUIRED", "IN_PROGRESS"])
      .order("urgency"),
  ]);
  if (serviceResult.error) throw serviceResult.error;
  if (adjustmentResult.error) throw adjustmentResult.error;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">{flightDemo ? "항공 업체 · 통합 할 일" : "통합 할 일"}</h1>
      <AdjustmentList items={(adjustmentResult.data ?? []) as never} />
      <TaskList items={(serviceResult.data ?? []) as never} />
    </div>
  );
}
