"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { submitServiceRequest } from "@/server/modules/service-item/portal-actions";
import {
  SERVICE_TYPES,
  SERVICE_TYPE_COLUMN_LABELS,
  SERVICE_STATUS_LABEL,
  SERVICE_STATUS_BADGE,
} from "@/lib/service-item-constants";

interface ServiceItemRow {
  id: string;
  service_type: string;
  status: string;
  note: string | null;
  scheduled_at: string | null;
}

function ServiceRequestCard({ item, revalidateTo }: { item: ServiceItemRow; revalidateTo: string }) {
  const [open, setOpen] = useState(false);
  const typeInfo = SERVICE_TYPES.find((t) => t.value === item.service_type);
  const columns = SERVICE_TYPE_COLUMN_LABELS[item.service_type];
  const submitted = item.status !== "DRAFT";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{typeInfo?.label}</CardTitle>
        <StatusBadge status={SERVICE_STATUS_BADGE[item.status]}>{SERVICE_STATUS_LABEL[item.status]}</StatusBadge>
      </CardHeader>
      <CardContent className="space-y-3">
        {!open ? (
          <div className="space-y-2">
            {item.note && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.note}</p>}
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
              {submitted ? "요청 내용 수정" : "요청 입력"}
            </Button>
          </div>
        ) : (
          <form
            action={submitServiceRequest}
            onSubmit={() => setOpen(false)}
            className="flex flex-col gap-3"
          >
            <input type="hidden" name="serviceItemId" value={item.id} />
            <input type="hidden" name="revalidateTo" value={revalidateTo} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`scheduledAt-${item.id}`}>{columns.scheduled}</Label>
              <Input
                id={`scheduledAt-${item.id}`}
                name="scheduledAt"
                type="datetime-local"
                defaultValue={item.scheduled_at ? item.scheduled_at.slice(0, 16) : ""}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`note-${item.id}`}>요청 내용</Label>
              <Textarea id={`note-${item.id}`} name="note" defaultValue={item.note ?? ""} placeholder="예: 출발지, 희망 일정, 선호 사항 등" />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>취소</Button>
              <Button type="submit" size="sm">{submitted ? "저장" : "요청 제출"}</Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export function ServiceRequestList({ items, revalidateTo }: { items: ServiceItemRow[]; revalidateTo: string }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">서비스 요청</h2>
      <div className="space-y-3">
        {items.map((item) => (
          <ServiceRequestCard key={item.id} item={item} revalidateTo={revalidateTo} />
        ))}
      </div>
    </div>
  );
}
