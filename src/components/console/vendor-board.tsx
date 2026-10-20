"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { addEventVendor, removeEventVendor, setVendorSettlement } from "@/server/modules/event-vendor/actions";

const SERVICE_TYPES = [
  { value: "FLIGHT", label: "항공" },
  { value: "LODGING", label: "숙박" },
  { value: "TRANSFER", label: "수송" },
  { value: "AIRPORT", label: "공항 의전" },
  { value: "DIETARY", label: "식음" },
] as const;

interface EventVendorRow {
  id: string;
  service_types: string[];
  settled_at?: string | null;
  vendor: { id: string; name: string } | null;
}

function AddVendorDialog({ eventId, open, onOpenChange }: { eventId: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form action={addEventVendor} onSubmit={() => onOpenChange(false)}>
          <DialogHeader>
            <DialogTitle>업체 추가</DialogTitle>
          </DialogHeader>
          <input type="hidden" name="eventId" value={eventId} />
          <div className="flex flex-col gap-3 py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vendorName">업체명</Label>
              <Input id="vendorName" name="vendorName" placeholder="예: 대한항공 MICE팀" required autoFocus />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contactEmail">담당자 이메일 (선택)</Label>
              <Input id="contactEmail" name="contactEmail" type="email" placeholder="입력하면 업체 포털 로그인 초청 메일이 갑니다" />
            </div>
            <div className="flex flex-col gap-2">
              <Label>담당 분야 (여러 개 선택 가능)</Label>
              {SERVICE_TYPES.map((t) => (
                <div key={t.value} className="flex items-center gap-2">
                  <Checkbox id={`st-${t.value}`} name="serviceTypes" value={t.value} />
                  <Label htmlFor={`st-${t.value}`} className="font-normal">{t.label}</Label>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>취소</DialogClose>
            <Button type="submit">추가</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function VendorBoard({
  eventId,
  eventVendors,
  taskCountByVendor,
  readOnly = false,
}: {
  eventId: string;
  eventVendors: EventVendorRow[];
  taskCountByVendor: Record<string, number>;
  readOnly?: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">분야별 담당 업체</h2>
        {!readOnly && <Button onClick={() => setAddOpen(true)}>
          <Plus className="size-4" />
          업체 추가
        </Button>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SERVICE_TYPES.map((t) => {
          const rows = eventVendors.filter((ev) => ev.service_types.includes(t.value));
          return (
            <Card key={t.value}>
              <CardHeader>
                <CardTitle className="text-base">{t.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">미지정</p>
                ) : (
                  rows.map((ev) => (
                    <div key={ev.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">{ev.vendor?.name}</p>
                        <StatusBadge status="wait" className="mt-1">
                          배정된 항목 {taskCountByVendor[ev.id] ?? 0}건
                        </StatusBadge>
                        <p className="mt-1 text-xs text-muted-foreground">{ev.settled_at ? "정산 완료 · 업체 접근 종료" : "업체 접근 허용 중"}</p>
                        {!readOnly && <form action={setVendorSettlement} className="mt-2 space-y-2"><input type="hidden" name="id" value={ev.id}/><input type="hidden" name="settled" value={ev.settled_at ? "false" : "true"}/><Input name="note" aria-label="정산 완료 또는 접근 재개 사유" placeholder="처리 사유 (필수)" required maxLength={2000}/><Button type="submit" variant="outline" size="sm">{ev.settled_at ? "업체 접근 재개" : "정산 완료 · 접근 종료"}</Button></form>}
                      </div>
                      {!readOnly && <form action={removeEventVendor}>
                        <input type="hidden" name="id" value={ev.id} />
                        <input type="hidden" name="eventId" value={eventId} />
                        <Button type="submit" variant="ghost" size="icon-sm">
                          <X className="size-4" />
                        </Button>
                      </form>}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AddVendorDialog eventId={eventId} open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
