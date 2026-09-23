"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { inviteDelegate } from "@/server/modules/delegation/invite-actions";

interface DelegateRow {
  id: string;
  email: string;
  status: string;
}

const STATUS_LABEL: Record<string, string> = { PENDING: "초청 발송됨", ACTIVE: "활성", REMOVED: "제거됨" };

export function DelegateList({
  eventId,
  delegationId,
  delegates,
}: {
  eventId: string;
  delegationId: string;
  delegates: DelegateRow[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">대리인 {delegates.length}명</h3>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          대리인 초청
        </Button>
      </div>
      {delegates.length === 0 ? (
        <p className="text-sm text-muted-foreground">아직 초청한 대리인이 없습니다.</p>
      ) : (
        <ul className="divide-y rounded-lg border text-sm">
          {delegates.map((d) => (
            <li key={d.id} className="flex items-center justify-between px-3 py-2">
              <span>{d.email}</span>
              <StatusBadge status={d.status === "ACTIVE" ? "done" : "wait"}>{STATUS_LABEL[d.status]}</StatusBadge>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form action={inviteDelegate} onSubmit={() => setOpen(false)}>
            <DialogHeader>
              <DialogTitle>대리인 초청</DialogTitle>
            </DialogHeader>
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="delegationId" value={delegationId} />
            <div className="flex flex-col gap-1.5 py-4">
              <Label htmlFor="delegateEmail">이메일</Label>
              <Input id="delegateEmail" name="email" type="email" required autoFocus />
            </div>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>취소</DialogClose>
              <Button type="submit">초청 보내기</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
