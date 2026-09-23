"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { startServiceItem, confirmServiceItem } from "@/server/modules/service-item/vendor-actions";
import {
  SERVICE_TYPES,
  SERVICE_STATUS_LABEL,
  SERVICE_STATUS_BADGE,
} from "@/lib/service-item-constants";
import { formatDateTime } from "@/lib/date";

export interface VendorTaskRow {
  id: string;
  service_type: string;
  status: string;
  note: string | null;
  confirmation_note: string | null;
  scheduled_at: string | null;
  delegation: { name: string; event: { name: string } | null } | null;
}

const SERVICE_TYPE_LABEL = Object.fromEntries(SERVICE_TYPES.map((t) => [t.value, t.label]));

function ConfirmDialog({ item, open, onOpenChange }: { item: VendorTaskRow; open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form action={confirmServiceItem} onSubmit={() => onOpenChange(false)}>
          <DialogHeader>
            <DialogTitle>확정 정보 입력</DialogTitle>
          </DialogHeader>
          <input type="hidden" name="id" value={item.id} />
          <div className="py-4">
            <Label htmlFor="confirmationNote">확정 내용 (편명·예약번호 등)</Label>
            <Textarea id="confirmationNote" name="confirmationNote" defaultValue={item.confirmation_note ?? ""} className="mt-1.5" />
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>취소</DialogClose>
            <Button type="submit">확정</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TaskRow({ item }: { item: VendorTaskRow }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <TableRow>
      <TableCell className="text-muted-foreground">{item.delegation?.event?.name}</TableCell>
      <TableCell>{item.delegation?.name}</TableCell>
      <TableCell>{SERVICE_TYPE_LABEL[item.service_type]}</TableCell>
      <TableCell>
        <StatusBadge status={SERVICE_STATUS_BADGE[item.status]}>{SERVICE_STATUS_LABEL[item.status]}</StatusBadge>
      </TableCell>
      <TableCell className="max-w-48 truncate text-muted-foreground">{item.note ?? "-"}</TableCell>
      <TableCell className="text-muted-foreground">
        {item.scheduled_at ? formatDateTime(item.scheduled_at, "ko") : "-"}
      </TableCell>
      <TableCell>
        {item.status === "REQUESTED" && (
          <form action={startServiceItem}>
            <input type="hidden" name="id" value={item.id} />
            <Button type="submit" size="sm" variant="outline">착수</Button>
          </form>
        )}
        {item.status === "IN_PROGRESS" && (
          <Button size="sm" onClick={() => setConfirmOpen(true)}>확정 입력</Button>
        )}
        {item.status === "CONFIRMED" && item.confirmation_note && (
          <span className="text-xs text-muted-foreground">{item.confirmation_note}</span>
        )}
      </TableCell>
      <ConfirmDialog item={item} open={confirmOpen} onOpenChange={setConfirmOpen} />
    </TableRow>
  );
}

export function TaskList({ items }: { items: VendorTaskRow[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
        아직 배정된 요청이 없습니다.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>행사</TableHead>
          <TableHead>대표단</TableHead>
          <TableHead>분야</TableHead>
          <TableHead>상태</TableHead>
          <TableHead>요청 내용</TableHead>
          <TableHead>희망 시각</TableHead>
          <TableHead className="w-32" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TaskRow key={item.id} item={item} />
        ))}
      </TableBody>
    </Table>
  );
}
