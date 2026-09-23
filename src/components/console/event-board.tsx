"use client";

import { useState } from "react";
import { MoreVertical, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge, type StatusBadgeStatus } from "@/components/shared/status-badge";
import { createEvent, deleteEvent, updateEvent } from "@/server/modules/event/actions";
import { formatDate } from "@/lib/date";

type EventStatus = "PREPARING" | "ACTIVE" | "CLOSED";

interface EventRow {
  id: string;
  name: string;
  status: EventStatus;
  created_at: string;
}

const STATUS_LABEL: Record<EventStatus, string> = {
  PREPARING: "준비 중",
  ACTIVE: "진행 중",
  CLOSED: "종료",
};
const STATUS_BADGE: Record<EventStatus, StatusBadgeStatus> = {
  PREPARING: "wait",
  ACTIVE: "progress",
  CLOSED: "done",
};

function EventFormDialog({
  event,
  open,
  onOpenChange,
}: {
  event?: EventRow;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form action={event ? updateEvent : createEvent} onSubmit={() => onOpenChange(false)}>
          <DialogHeader>
            <DialogTitle>{event ? "행사 수정" : "새 행사 만들기"}</DialogTitle>
          </DialogHeader>
          {event && <input type="hidden" name="id" value={event.id} />}
          <div className="flex flex-col gap-1.5 py-4">
            <Label htmlFor="name">행사 이름</Label>
            <Input id="name" name="name" defaultValue={event?.name} required autoFocus />
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>취소</DialogClose>
            <Button type="submit">{event ? "저장" : "만들기"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EventCard({ event }: { event: EventRow }) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base">{event.name}</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">{formatDate(event.created_at, "ko")} 생성</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
            <MoreVertical className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditOpen(true)}>수정</DropdownMenuItem>
            {event.status === "PREPARING" && (
              <AlertDialog>
                <AlertDialogTrigger render={<DropdownMenuItem variant="destructive" closeOnClick={false} />}>
                  삭제
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>"{event.name}"을(를) 삭제할까요?</AlertDialogTitle>
                    <AlertDialogDescription>
                      되돌릴 수 없습니다. 초청이 시작된 뒤에는 삭제 대신 행사 취소를 씁니다 (D-UI-05).
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <form action={deleteEvent}>
                      <input type="hidden" name="id" value={event.id} />
                      <AlertDialogAction type="submit" variant="destructive">삭제</AlertDialogAction>
                    </form>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>
        <StatusBadge status={STATUS_BADGE[event.status]}>{STATUS_LABEL[event.status]}</StatusBadge>
      </CardContent>
      <EventFormDialog event={event} open={editOpen} onOpenChange={setEditOpen} />
    </Card>
  );
}

export function EventBoard({ events }: { events: EventRow[] }) {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">행사 목록</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          새 행사
        </Button>
      </div>

      {events.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center">
          <p className="text-sm text-muted-foreground">아직 만든 행사가 없습니다.</p>
          <Button variant="outline" onClick={() => setCreateOpen(true)}>첫 행사 만들기</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}

      <EventFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
