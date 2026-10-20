"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDateTime } from "@/lib/date";
import {
  ADJUSTMENT_STATUS_LABEL,
  ADJUSTMENT_STATUS_BADGE,
  URGENCY_LABEL,
  URGENCY_BADGE,
  SERVICE_TYPE_LABEL_SHORT,
} from "@/lib/change-issue-constants";
import { acknowledgeAdjustmentItem, completeAdjustmentItem } from "@/server/modules/change-issue/actions";

export interface VendorAdjustmentRow {
  id: string;
  status: string;
  urgency: string;
  instruction: string;
  due_at: string | null;
  service_item: { service_type: string } | null;
  issue: { issue_no: string; delegation: { name: string; event: { name: string } | null } | null } | null;
}

function CompleteForm({ itemId, onDone }: { itemId: string; onDone: () => void }) {
  return (
    <form action={completeAdjustmentItem} onSubmit={onDone} className="mt-2 flex flex-col gap-2 rounded-md border p-3">
      <input type="hidden" name="id" value={itemId} />
      <input type="hidden" name="revalidateTo" value="/vendor" />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`vendor-note-${itemId}`}>처리 결과 메모</Label>
        <Input id={`vendor-note-${itemId}`} name="resolutionNote" placeholder="예: KE003으로 재배차 완료" required />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id={`vendor-changed-${itemId}`} name="valueChanged" defaultChecked />
        <Label htmlFor={`vendor-changed-${itemId}`} className="font-normal">확정 내용이 실제로 바뀌었음</Label>
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>취소</Button>
        <Button type="submit" size="sm">완료 처리</Button>
      </div>
    </form>
  );
}

function AdjustmentCard({ item }: { item: VendorAdjustmentRow }) {
  const [completing, setCompleting] = useState(false);
  const typeLabel = item.service_item ? SERVICE_TYPE_LABEL_SHORT[item.service_item.service_type] : null;

  return (
    <Card>
      <CardContent className="space-y-2 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <StatusBadge status={URGENCY_BADGE[item.urgency]}>{URGENCY_LABEL[item.urgency]}</StatusBadge>
            <StatusBadge status={ADJUSTMENT_STATUS_BADGE[item.status]}>{ADJUSTMENT_STATUS_LABEL[item.status]}</StatusBadge>
          </div>
          {item.due_at && <span className="text-xs text-muted-foreground">기한 {formatDateTime(item.due_at, "ko")}</span>}
        </div>
        <p className="text-sm text-muted-foreground">
          {item.issue?.delegation?.event?.name} · {item.issue?.delegation?.name} · {typeLabel} · {item.issue?.issue_no}
        </p>
        <p className="text-sm">{item.instruction}</p>

        {item.status === "ACTION_REQUIRED" && (
          <form action={acknowledgeAdjustmentItem}>
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="revalidateTo" value="/vendor" />
            <Button type="submit" size="sm" variant="outline">확인</Button>
          </form>
        )}
        {item.status === "IN_PROGRESS" && !completing && (
          <Button size="sm" onClick={() => setCompleting(true)}>완료 처리</Button>
        )}
        {completing && <CompleteForm itemId={item.id} onDone={() => setCompleting(false)} />}
      </CardContent>
    </Card>
  );
}

export function AdjustmentList({ items }: { items: VendorAdjustmentRow[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">변경으로 인한 조정 요청</h2>
      <div className="space-y-3">
        {items.map((item) => (
          <AdjustmentCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
