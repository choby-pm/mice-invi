import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { StatusBadge, type StatusBadgeStatus } from "@/components/shared/status-badge";

const STATUS_LABEL: Record<string, string> = { PREPARING: "준비 중", ACTIVE: "진행 중", CLOSED: "종료" };
const STATUS_BADGE: Record<string, StatusBadgeStatus> = { PREPARING: "wait", ACTIVE: "progress", CLOSED: "done" };

const TABS = [
  { segment: "delegations", label: "대표단" },
  { segment: "issues", label: "변경 이슈" },
  { segment: "roster", label: "전체 명단" },
  { segment: "vendors", label: "업체" },
];

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: event } = await supabase.from("event").select("id, name, status").eq("id", id).single();
  if (!event) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/console" className="text-xs text-muted-foreground hover:text-foreground">
            ← 행사 목록
          </Link>
          <h1 className="text-lg font-semibold">{event.name}</h1>
        </div>
        <StatusBadge status={STATUS_BADGE[event.status]}>{STATUS_LABEL[event.status]}</StatusBadge>
      </div>
      <nav className="flex gap-1 border-b">
        {TABS.map((tab) => (
          <Link
            key={tab.segment}
            href={`/console/events/${id}/${tab.segment}`}
            className="rounded-t-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <div>{children}</div>
    </div>
  );
}
