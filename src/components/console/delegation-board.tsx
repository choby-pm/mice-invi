"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreVertical, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { createDelegation, deleteDelegation, updateDelegation } from "@/server/modules/delegation/actions";
import { BlankScreen } from "@/components/shared/blank-screen";

interface DelegationRow {
  id: string;
  name: string;
  country: string;
  organization: string;
  invite_status: string;
  completeness: number;
}

const INVITE_STATUS_LABEL: Record<string, string> = {
  READY: "초청 준비",
  SENT: "발송됨",
  BOUNCED: "발송 실패",
  OPENED: "열람",
  IN_PROGRESS: "입력 중",
  SUBMITTED: "제출 완료",
  CONFIRMED: "확정",
  DECLINED: "불참",
  WITHDRAWN: "초청 철회",
};
const INVITE_STATUS_BADGE: Record<string, StatusBadgeStatus> = {
  READY: "wait",
  SENT: "wait",
  BOUNCED: "urgent",
  OPENED: "wait",
  IN_PROGRESS: "progress",
  SUBMITTED: "action",
  CONFIRMED: "done",
  DECLINED: "void",
  WITHDRAWN: "void",
};

function DelegationFormDialog({
  eventId,
  delegation,
  open,
  onOpenChange,
}: {
  eventId: string;
  delegation?: DelegationRow;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form action={delegation ? updateDelegation : createDelegation} onSubmit={() => onOpenChange(false)}>
          <DialogHeader>
            <DialogTitle>{delegation ? "대표단 수정" : "새 대표단 등록"}</DialogTitle>
          </DialogHeader>
          <input type="hidden" name="eventId" value={eventId} />
          {delegation && <input type="hidden" name="id" value={delegation.id} />}
          <div className="flex flex-col gap-3 py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">대표단명</Label>
              <Input id="name" name="name" defaultValue={delegation?.name} placeholder="예: 베트남 산업통상부 장관 대표단" required autoFocus />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="country">국가</Label>
              <Input id="country" name="country" defaultValue={delegation?.country} placeholder="예: VN" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="organization">소속 기관</Label>
              <Input id="organization" name="organization" defaultValue={delegation?.organization} required />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>취소</DialogClose>
            <Button type="submit">{delegation ? "저장" : "등록"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DelegationRowActions({ eventId, delegation }: { eventId: string; delegation: DelegationRow }) {
  const [editOpen, setEditOpen] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <MoreVertical className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>수정</DropdownMenuItem>
          <AlertDialog>
            <AlertDialogTrigger render={<DropdownMenuItem variant="destructive" closeOnClick={false} />}>
              삭제
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>"{delegation.name}"을(를) 삭제할까요?</AlertDialogTitle>
                <AlertDialogDescription>되돌릴 수 없습니다. 참가자 정보도 함께 삭제됩니다.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <form action={deleteDelegation}>
                  <input type="hidden" name="id" value={delegation.id} />
                  <input type="hidden" name="eventId" value={eventId} />
                  <AlertDialogAction type="submit" variant="destructive">삭제</AlertDialogAction>
                </form>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DropdownMenuContent>
      </DropdownMenu>
      <DelegationFormDialog eventId={eventId} delegation={delegation} open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
}

export function DelegationBoard({ eventId, delegations }: { eventId: string; delegations: DelegationRow[] }) {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">대표단 {delegations.length}개</h2>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          새 대표단
        </Button>
      </div>

      {delegations.length === 0 ? (
        <BlankScreen title="아직 등록된 대표단이 없습니다" note="위 '새 대표단' 버튼으로 첫 대표단을 등록하세요." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>대표단명</TableHead>
              <TableHead>국가</TableHead>
              <TableHead>소속 기관</TableHead>
              <TableHead>초청 상태</TableHead>
              <TableHead>완결률</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {delegations.map((d) => (
              <TableRow key={d.id}>
                <TableCell>
                  <Link href={`/console/events/${eventId}/delegations/${d.id}`} className="font-medium hover:underline">
                    {d.name}
                  </Link>
                </TableCell>
                <TableCell>{d.country}</TableCell>
                <TableCell>{d.organization}</TableCell>
                <TableCell>
                  <StatusBadge status={INVITE_STATUS_BADGE[d.invite_status]}>
                    {INVITE_STATUS_LABEL[d.invite_status]}
                  </StatusBadge>
                </TableCell>
                <TableCell className="text-muted-foreground">{d.completeness}%</TableCell>
                <TableCell>
                  <DelegationRowActions eventId={eventId} delegation={d} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <DelegationFormDialog eventId={eventId} open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
