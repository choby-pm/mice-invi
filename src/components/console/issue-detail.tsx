"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDateTime } from "@/lib/date";
import {
  ISSUE_STATUS_LABEL,
  ISSUE_STATUS_BADGE,
  ADJUSTMENT_STATUS_LABEL,
  ADJUSTMENT_STATUS_BADGE,
  URGENCY_LABEL,
  URGENCY_BADGE,
  SOURCE_LABEL,
  SERVICE_TYPE_LABEL_SHORT,
} from "@/lib/change-issue-constants";
import {
  acknowledgeAdjustmentItem,
  completeAdjustmentItem,
  markAdjustmentNotApplicable,
  forceCloseChangeIssue,
} from "@/server/modules/change-issue/actions";

interface AdjustmentItemRow {
  id: string;
  status: string;
  urgency: string;
  instruction: string;
  due_at: string | null;
  resolution_note: string | null;
  close_reason: string | null;
  kind: string;
  impact_rule_code: string | null;
  service_item: { service_type: string } | null;
  assignee_vendor: { name: string } | null;
}

interface IssueRow {
  id: string;
  issue_no: string;
  summary: string;
  status: string;
  max_urgency: string;
  source: string;
  created_at: string;
  closed_at: string | null;
  force_close_reason: string | null;
  superseded_by_id: string | null;
  delegation: { name: string } | null;
}

function CompleteForm({ itemId, revalidateTo, onDone }: { itemId: string; revalidateTo: string; onDone: () => void }) {
  return (
    <form action={completeAdjustmentItem} onSubmit={onDone} className="mt-2 flex flex-col gap-2 rounded-md border p-3">
      <input type="hidden" name="id" value={itemId} />
      <input type="hidden" name="revalidateTo" value={revalidateTo} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`note-${itemId}`}>처리 결과 메모</Label>
        <Input id={`note-${itemId}`} name="resolutionNote" placeholder="예: KE003으로 재배차 완료" />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id={`changed-${itemId}`} name="valueChanged" defaultChecked />
        <Label htmlFor={`changed-${itemId}`} className="font-normal">확정값이 실제로 바뀌었음</Label>
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>취소</Button>
        <Button type="submit" size="sm">완료 처리</Button>
      </div>
    </form>
  );
}

function NotApplicableForm({ itemId, revalidateTo, onDone }: { itemId: string; revalidateTo: string; onDone: () => void }) {
  return (
    <form action={markAdjustmentNotApplicable} onSubmit={onDone} className="mt-2 flex flex-col gap-2 rounded-md border p-3">
      <input type="hidden" name="id" value={itemId} />
      <input type="hidden" name="revalidateTo" value={revalidateTo} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`reason-${itemId}`}>해당 없음 처리 사유</Label>
        <Input id={`reason-${itemId}`} name="reason" placeholder="예: 이미 같은 차량으로 대응 가능" required />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>취소</Button>
        <Button type="submit" size="sm" variant="outline">해당 없음으로 종료</Button>
      </div>
    </form>
  );
}

function AdjustmentRow({ item, revalidateTo }: { item: AdjustmentItemRow; revalidateTo: string }) {
  const [openForm, setOpenForm] = useState<"complete" | "na" | null>(null);
  const typeLabel = item.service_item ? SERVICE_TYPE_LABEL_SHORT[item.service_item.service_type] : null;

  return (
    <div className="rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusBadge status={URGENCY_BADGE[item.urgency]}>{URGENCY_LABEL[item.urgency]}</StatusBadge>
          <StatusBadge status={ADJUSTMENT_STATUS_BADGE[item.status]}>{ADJUSTMENT_STATUS_LABEL[item.status]}</StatusBadge>
          {typeLabel && <span className="text-sm font-medium">{typeLabel}</span>}
          {item.assignee_vendor?.name && <span className="text-sm text-muted-foreground">· {item.assignee_vendor.name}</span>}
        </div>
        {item.due_at && <span className="text-xs text-muted-foreground">기한 {formatDateTime(item.due_at, "ko")}</span>}
      </div>
      <p className="mt-1.5 text-sm">{item.instruction}</p>
      {item.resolution_note && <p className="mt-1 text-xs text-muted-foreground">처리 결과: {item.resolution_note}</p>}
      {item.close_reason && <p className="mt-1 text-xs text-muted-foreground">해당 없음 사유: {item.close_reason}</p>}

      {item.status === "ACTION_REQUIRED" && (
        <form action={acknowledgeAdjustmentItem} className="mt-2 flex gap-2">
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="revalidateTo" value={revalidateTo} />
          <Button type="submit" size="sm" variant="outline">확인</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpenForm("na")}>해당 없음</Button>
        </form>
      )}
      {item.status === "IN_PROGRESS" && (
        <div className="mt-2 flex gap-2">
          <Button size="sm" onClick={() => setOpenForm("complete")}>완료 처리</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpenForm("na")}>해당 없음</Button>
        </div>
      )}
      {openForm === "complete" && <CompleteForm itemId={item.id} revalidateTo={revalidateTo} onDone={() => setOpenForm(null)} />}
      {openForm === "na" && <NotApplicableForm itemId={item.id} revalidateTo={revalidateTo} onDone={() => setOpenForm(null)} />}
    </div>
  );
}

function ForceCloseForm({ issueId, revalidateTo, onDone }: { issueId: string; revalidateTo: string; onDone: () => void }) {
  return (
    <form action={forceCloseChangeIssue} onSubmit={onDone} className="mt-2 flex flex-col gap-2 rounded-md border p-3">
      <input type="hidden" name="id" value={issueId} />
      <input type="hidden" name="revalidateTo" value={revalidateTo} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="force-close-reason">강제 종결 사유</Label>
        <Input id="force-close-reason" name="reason" required />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>취소</Button>
        <Button type="submit" size="sm" variant="outline">강제 종결</Button>
      </div>
    </form>
  );
}

export function IssueDetail({
  issue,
  items,
  revalidateTo,
}: {
  issue: IssueRow;
  items: AdjustmentItemRow[];
  revalidateTo: string;
}) {
  const [forceCloseOpen, setForceCloseOpen] = useState(false);
  const canForceClose = issue.status === "OPEN" || issue.status === "IN_PROGRESS";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">{issue.issue_no} · {issue.delegation?.name}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              출처: {SOURCE_LABEL[issue.source]} · {formatDateTime(issue.created_at, "ko")}
            </p>
          </div>
          <StatusBadge status={ISSUE_STATUS_BADGE[issue.status]}>{ISSUE_STATUS_LABEL[issue.status]}</StatusBadge>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm">{issue.summary}</p>
          {issue.status === "SUPERSEDED" && issue.superseded_by_id && (
            <p className="text-xs text-muted-foreground">이 이슈는 재변경으로 대체되었습니다.</p>
          )}
          {issue.status === "FORCE_CLOSED" && issue.force_close_reason && (
            <p className="text-xs text-muted-foreground">강제 종결 사유: {issue.force_close_reason}</p>
          )}
          {issue.status === "CLOSED" && issue.closed_at && (
            <p className="text-xs text-muted-foreground">종결: {formatDateTime(issue.closed_at, "ko")}</p>
          )}
          {canForceClose && (
            <div>
              <Button size="sm" variant="ghost" onClick={() => setForceCloseOpen((v) => !v)}>강제 종결</Button>
              {forceCloseOpen && <ForceCloseForm issueId={issue.id} revalidateTo={revalidateTo} onDone={() => setForceCloseOpen(false)} />}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">조정 항목 ({items.length})</h2>
        {items.map((item) => (
          <AdjustmentRow key={item.id} item={item} revalidateTo={revalidateTo} />
        ))}
      </div>
    </div>
  );
}
