"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { BlankScreen } from "@/components/shared/blank-screen";
import { createProgram } from "@/server/modules/program/actions";
import { formatDateTime } from "@/lib/date";
import {
  PROGRAM_TYPE_LABEL,
  ORGANIZER_TYPE_LABEL,
  VISIBILITY_LABEL,
  PROGRAM_STATUS_LABEL,
  PROGRAM_STATUS_BADGE,
} from "@/lib/program-constants";

interface ProgramRow {
  id: string;
  name: string;
  program_type: string;
  organizer_type: string;
  status: string;
  visibility: string;
  start_at: string | null;
  venue: string | null;
  late_registration: boolean;
}
interface DelegationOption { id: string; name: string }

function CreateProgramDialog({
  eventId,
  delegations,
  open,
  onOpenChange,
}: {
  eventId: string;
  delegations: DelegationOption[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [organizerType, setOrganizerType] = useState("HOST");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form action={createProgram} onSubmit={() => onOpenChange(false)}>
          <DialogHeader>
            <DialogTitle>하위 행사 생성</DialogTitle>
          </DialogHeader>
          <input type="hidden" name="eventId" value={eventId} />
          <div className="flex max-h-[65vh] flex-col gap-3 overflow-y-auto py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">명칭</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>유형</Label>
                <Select name="programType" defaultValue="PLENARY" required>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PROGRAM_TYPE_LABEL)
                      .filter(([v]) => v !== "SELF_SCHEDULED")
                      .map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>주관 주체</Label>
                <Select name="organizerType" defaultValue="HOST" onValueChange={(v) => setOrganizerType(v ?? "HOST")} required>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ORGANIZER_TYPE_LABEL).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {organizerType === "DELEGATION" && (
              <div className="flex flex-col gap-1.5">
                <Label>주관 대표단</Label>
                <Select name="organizerDelegationId" required>
                  <SelectTrigger className="w-full"><SelectValue placeholder="대표단 선택" /></SelectTrigger>
                  <SelectContent>
                    {delegations.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="startAt">시작 일시 (선택, 가안 단계에서는 미정 가능)</Label>
                <Input id="startAt" name="startAt" type="datetime-local" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="endAt">종료 일시 (선택)</Label>
                <Input id="endAt" name="endAt" type="datetime-local" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="venue">장소 (선택)</Label>
              <Input id="venue" name="venue" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>공개 범위</Label>
              <Select name="visibility" defaultValue="STAKEHOLDER" required>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(VISIBILITY_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dressCode">드레스 코드 (선택)</Label>
              <Textarea id="dressCode" name="dressCode" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>취소</DialogClose>
            <Button type="submit">가안으로 생성</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProgramBoard({
  eventId,
  programs,
  delegations,
}: {
  eventId: string;
  programs: ProgramRow[];
  delegations: DelegationOption[];
}) {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">하위 행사</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          하위 행사 생성
        </Button>
      </div>

      {programs.length === 0 ? (
        <BlankScreen title="아직 등록된 하위 행사가 없습니다" note="위 '하위 행사 생성' 버튼으로 첫 하위 행사를 등록하세요." />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>명칭</TableHead>
                <TableHead>유형</TableHead>
                <TableHead>주관</TableHead>
                <TableHead>일시</TableHead>
                <TableHead>장소</TableHead>
                <TableHead>공개 범위</TableHead>
                <TableHead>상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {programs.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link href={`/console/events/${eventId}/programs/${p.id}`} className="font-medium hover:underline">
                      {p.program_type === "SELF_SCHEDULED" && "🏳️ "}{p.name}
                    </Link>
                    {p.late_registration && (
                      <StatusBadge status="urgent" className="ml-1.5">늦은 등록</StatusBadge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{PROGRAM_TYPE_LABEL[p.program_type]}</TableCell>
                  <TableCell className="text-muted-foreground">{ORGANIZER_TYPE_LABEL[p.organizer_type]}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.start_at ? formatDateTime(p.start_at, "ko") : "미정"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.venue ?? "-"}</TableCell>
                  <TableCell className="text-muted-foreground">{VISIBILITY_LABEL[p.visibility]}</TableCell>
                  <TableCell>
                    <StatusBadge status={PROGRAM_STATUS_BADGE[p.status]}>{PROGRAM_STATUS_LABEL[p.status]}</StatusBadge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateProgramDialog eventId={eventId} delegations={delegations} open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
