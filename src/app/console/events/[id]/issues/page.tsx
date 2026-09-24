import Link from "next/link";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { IssueBoard } from "@/components/console/issue-board";
import { BlankScreen } from "@/components/shared/blank-screen";

export default async function IssuesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const { id: eventId } = await params;
  const { filter } = await searchParams;
  const showAll = filter === "all";

  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("change_issue")
    .select(
      "id, issue_no, summary, max_urgency, status, created_at, closed_at, delegation:delegation_id(name), adjustment_item(id, status, urgency, due_at, assignee_vendor:assignee_vendor_id(name))",
    )
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (!showAll) query = query.in("status", ["OPEN", "IN_PROGRESS"]);
  const { data: issues } = await query;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">변경 이슈</h1>
        <div className="flex gap-2 text-sm">
          <Link href={`/console/events/${eventId}/issues`} className={!showAll ? "font-medium" : "text-muted-foreground"}>
            미종결
          </Link>
          <Link href={`/console/events/${eventId}/issues?filter=all`} className={showAll ? "font-medium" : "text-muted-foreground"}>
            전체
          </Link>
        </div>
      </div>

      {!issues || issues.length === 0 ? (
        <BlankScreen
          title={showAll ? "이슈가 없습니다" : "모든 변경이 반영되었습니다"}
          note={
            showAll
              ? "아직 발생한 변경 이슈가 없습니다."
              : "미종결 변경 이슈가 없습니다. 항공편이 재확정되는 등 변경이 생기면 여기 나타납니다."
          }
        />
      ) : (
        <IssueBoard eventId={eventId} issues={issues as never} />
      )}
    </div>
  );
}
