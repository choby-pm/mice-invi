import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDateTime } from "@/lib/date";
import {
  ISSUE_STATUS_LABEL,
  ISSUE_STATUS_BADGE,
  URGENCY_LABEL,
  URGENCY_BADGE,
} from "@/lib/change-issue-constants";

interface AdjustmentItemRow {
  id: string;
  status: string;
  urgency: string;
  due_at: string | null;
  assignee_vendor: { name: string } | null;
}

interface IssueRow {
  id: string;
  issue_no: string;
  summary: string;
  max_urgency: string;
  status: string;
  created_at: string;
  closed_at: string | null;
  delegation: { name: string } | null;
  adjustment_item: AdjustmentItemRow[];
}

const OPEN_ITEM_STATUSES = ["WAITING", "ACTION_REQUIRED", "IN_PROGRESS"];

function progressOf(items: AdjustmentItemRow[]) {
  const total = items.length;
  const done = items.filter((i) => !OPEN_ITEM_STATUSES.includes(i.status)).length;
  return `${done}/${total}`;
}

// "막힌 곳" — 가장 오래 대기 중인 미완료 항목의 담당 (02 §3.4 PCO-E02)
function blockedBy(items: AdjustmentItemRow[]) {
  const open = items.filter((i) => OPEN_ITEM_STATUSES.includes(i.status));
  if (open.length === 0) return "-";
  const oldest = open[0];
  return oldest.assignee_vendor?.name ?? "PCO 판단";
}

export function IssueBoard({ eventId, issues }: { eventId: string; issues: IssueRow[] }) {
  const sorted = [...issues].sort((a, b) => {
    const rank: Record<string, number> = { URGENT: 0, CAUTION: 1, NORMAL: 2 };
    return (rank[a.max_urgency] ?? 3) - (rank[b.max_urgency] ?? 3);
  });

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>긴급도</TableHead>
            <TableHead>이슈</TableHead>
            <TableHead>대표단</TableHead>
            <TableHead>변경 내용</TableHead>
            <TableHead>진행</TableHead>
            <TableHead>막힌 곳</TableHead>
            <TableHead>상태</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((issue) => (
            <TableRow key={issue.id}>
              <TableCell>
                <StatusBadge status={URGENCY_BADGE[issue.max_urgency]}>{URGENCY_LABEL[issue.max_urgency]}</StatusBadge>
              </TableCell>
              <TableCell>
                <Link href={`/console/events/${eventId}/issues/${issue.id}`} className="font-medium hover:underline">
                  {issue.issue_no}
                </Link>
              </TableCell>
              <TableCell>{issue.delegation?.name}</TableCell>
              <TableCell className="max-w-56 truncate text-muted-foreground">{issue.summary}</TableCell>
              <TableCell className="text-muted-foreground">{progressOf(issue.adjustment_item)}</TableCell>
              <TableCell className="text-muted-foreground">{blockedBy(issue.adjustment_item)}</TableCell>
              <TableCell>
                <StatusBadge status={ISSUE_STATUS_BADGE[issue.status]}>{ISSUE_STATUS_LABEL[issue.status]}</StatusBadge>
                {issue.status === "CLOSED" && issue.closed_at && (
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    {formatDateTime(issue.closed_at, "ko")}
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
