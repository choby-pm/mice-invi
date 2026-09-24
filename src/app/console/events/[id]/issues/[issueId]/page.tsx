import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { IssueDetail } from "@/components/console/issue-detail";

export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ id: string; issueId: string }>;
}) {
  const { id: eventId, issueId } = await params;
  const supabase = await createServerSupabaseClient();

  const [{ data: issue }, { data: items }, { data: eventVendors }] = await Promise.all([
    supabase
      .from("change_issue")
      .select("id, issue_no, summary, status, max_urgency, before, after, source, created_at, closed_at, force_close_reason, superseded_by_id, delegation:delegation_id(name)")
      .eq("id", issueId)
      .single(),
    supabase
      .from("adjustment_item")
      .select(
        "id, status, urgency, instruction, due_at, resolution_note, close_reason, kind, impact_rule_code, service_item:service_item_id(service_type), assignee_vendor:assignee_vendor_id(id, name)",
      )
      .eq("issue_id", issueId)
      .order("depth", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase.from("event_vendor").select("service_types, vendor:vendor_id(id, name)").eq("event_id", eventId),
  ]);
  if (!issue) notFound();

  const revalidateTo = `/console/events/${eventId}/issues/${issueId}`;

  return (
    <div className="space-y-4">
      <Link href={`/console/events/${eventId}/issues`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" />
        변경 이슈 목록
      </Link>
      <IssueDetail
        issue={issue as never}
        items={(items ?? []) as never}
        eventVendors={(eventVendors ?? []) as never}
        revalidateTo={revalidateTo}
      />
    </div>
  );
}
