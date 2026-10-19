import { getVendorContext } from "@/server/auth/vendor-context";
import { TaskList } from "@/components/vendor/task-list";
import { AdjustmentList } from "@/components/vendor/adjustment-list";
import { SERVICE_DETAILS_SELECT } from "@/lib/service-detail-query";

export default async function VendorHomePage() {
  const { supabase, assignments, memberships, flightDemo } = await getVendorContext();
  const assignmentIds = assignments.map((a) => a.id);
  if (!assignmentIds.length) return <p>아직 배정된 행사가 없습니다.</p>;
  const [serviceResult, adjustmentResult] = await Promise.all([
    supabase
      .from("service_item")
      .select(SERVICE_DETAILS_SELECT)
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
    <div className="space-y-6">
      <div className="space-y-2"><p className="text-xs font-semibold uppercase tracking-widest text-primary">PARTNER WORKSPACE</p><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{flightDemo ? "항공 업무" : "통합 할 일"}</h1><p className="text-sm leading-6 text-muted-foreground">고객 요청부터 예약·확정까지, 대표단별 업무를 한눈에 확인하세요. 상세 보기에서 입력된 전체 내용을 확인할 수 있습니다.</p></div>
      <AdjustmentList items={(adjustmentResult.data ?? []) as never} />
      <TaskList items={(serviceResult.data ?? []) as never} />
    </div>
  );
}
