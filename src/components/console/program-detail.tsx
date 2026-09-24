"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { formatDateTime } from "@/lib/date";
import {
  PROGRAM_TYPE_LABEL,
  ORGANIZER_TYPE_LABEL,
  VISIBILITY_LABEL,
  PROGRAM_STATUS_LABEL,
  PROGRAM_STATUS_BADGE,
  ATTENDANCE_ROLE_LABEL,
  ATTENDANCE_STATUS_LABEL,
  ATTENDANCE_STATUS_BADGE,
} from "@/lib/program-constants";
import {
  confirmProgram,
  cancelProgram,
  addProgramAttendance,
  removeProgramAttendance,
  sendProgramAdjustNote,
} from "@/server/modules/program/actions";

interface ProgramRow {
  id: string;
  name: string;
  program_type: string;
  organizer_type: string;
  organizer_delegation: { name: string } | null;
  registered_by_type: string;
  transfer_needed: boolean | null;
  late_registration: boolean;
  pco_adjust_note: string | null;
  start_at: string | null;
  end_at: string | null;
  venue: string | null;
  venue_address: string | null;
  visibility: string;
  dress_code: string | null;
  status: string;
  internal_note: string | null;
}

interface AttendanceRow {
  id: string;
  role: string;
  role_note: string | null;
  status: string;
  participant: { id: string; first_name: string; last_name: string; delegation: { name: string } | null } | null;
}

interface ParticipantOption {
  id: string;
  first_name: string;
  last_name: string;
}
interface DelegationOption {
  id: string;
  name: string;
  participant: ParticipantOption[];
}

function AddAttendanceDialog({
  programId,
  delegations,
  existingParticipantIds,
  revalidateTo,
  open,
  onOpenChange,
}: {
  programId: string;
  delegations: DelegationOption[];
  existingParticipantIds: Set<string>;
  revalidateTo: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const options = delegations.flatMap((d) =>
    d.participant.filter((p) => !existingParticipantIds.has(p.id)).map((p) => ({ ...p, delegationName: d.name })),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form action={addProgramAttendance} onSubmit={() => onOpenChange(false)}>
          <DialogHeader>
            <DialogTitle>참석 대상 추가</DialogTitle>
          </DialogHeader>
          <input type="hidden" name="programId" value={programId} />
          <input type="hidden" name="revalidateTo" value={revalidateTo} />
          <div className="flex flex-col gap-3 py-4">
            <div className="flex flex-col gap-1.5">
              <Label>참가자</Label>
              <Select name="participantId" required>
                <SelectTrigger className="w-full"><SelectValue placeholder="참가자 선택" /></SelectTrigger>
                <SelectContent>
                  {options.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.delegationName} · {p.last_name} {p.first_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>역할</Label>
              <Select name="role" defaultValue="ATTENDEE" required>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ATTENDANCE_ROLE_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

function AdjustNoteForm({
  programId,
  eventId,
  onDone,
}: {
  programId: string;
  eventId: string;
  onDone: () => void;
}) {
  return (
    <form action={sendProgramAdjustNote} onSubmit={onDone} className="mt-2 flex flex-col gap-2 rounded-md border p-3">
      <input type="hidden" name="id" value={programId} />
      <input type="hidden" name="eventId" value={eventId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="adjust-note">조정 요청 내용</Label>
        <Textarea id="adjust-note" name="note" placeholder="예: 이 시간에 본회의 일정이 있습니다. 확인 부탁드립니다." required />
      </div>
      <p className="text-xs text-muted-foreground">자체 일정은 직접 수정할 수 없어 대리인에게 메시지로만 전달됩니다.</p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>취소</Button>
        <Button type="submit" size="sm">보내기</Button>
      </div>
    </form>
  );
}

export function ProgramDetail({
  eventId,
  program,
  attendance,
  delegations,
  revalidateTo,
}: {
  eventId: string;
  program: ProgramRow;
  attendance: AttendanceRow[];
  delegations: DelegationOption[];
  revalidateTo: string;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const existingIds = new Set(attendance.map((a) => a.participant?.id).filter((id): id is string => Boolean(id)));
  const isSelfScheduled = program.program_type === "SELF_SCHEDULED";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">{program.name}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {PROGRAM_TYPE_LABEL[program.program_type]} · {ORGANIZER_TYPE_LABEL[program.organizer_type]}
              {program.organizer_delegation && ` (${program.organizer_delegation.name})`} · {VISIBILITY_LABEL[program.visibility]}
            </p>
          </div>
          <StatusBadge status={PROGRAM_STATUS_BADGE[program.status]}>{PROGRAM_STATUS_LABEL[program.status]}</StatusBadge>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            일시: {program.start_at ? formatDateTime(program.start_at, "ko") : "미정"}
            {program.end_at && ` ~ ${formatDateTime(program.end_at, "ko")}`}
          </p>
          {program.venue && <p className="text-muted-foreground">장소: {program.venue}</p>}
          {program.dress_code && <p className="text-muted-foreground">드레스 코드: {program.dress_code}</p>}
          {program.registered_by_type === "PROXY" && (
            <p className="text-xs text-muted-foreground">
              🏳️ 대표단 자체 일정 — 대리인이 직접 등록{program.transfer_needed && " · 차량 요청됨"}
            </p>
          )}
          {program.late_registration && (
            <p className="text-status-urgent-fg">🔴 늦은 등록 — 일정 시작 24시간 이내에 등록됨</p>
          )}
          {program.pco_adjust_note && (
            <p className="rounded-md bg-status-action-bg p-2 text-status-action-fg">PCO 조정 요청: {program.pco_adjust_note}</p>
          )}

          <div className="flex gap-2 pt-2">
            {program.status === "TENTATIVE" && (
              <form action={confirmProgram}>
                <input type="hidden" name="id" value={program.id} />
                <input type="hidden" name="eventId" value={eventId} />
                <Button type="submit" size="sm">확정</Button>
              </form>
            )}
            {(program.status === "TENTATIVE" || program.status === "CONFIRMED") && (
              <form action={cancelProgram}>
                <input type="hidden" name="id" value={program.id} />
                <input type="hidden" name="eventId" value={eventId} />
                <Button type="submit" size="sm" variant="outline">취소</Button>
              </form>
            )}
            {isSelfScheduled && program.status === "CONFIRMED" && (
              <Button size="sm" variant="outline" onClick={() => setAdjustOpen((v) => !v)}>조정 요청 보내기</Button>
            )}
          </div>
          {adjustOpen && <AdjustNoteForm programId={program.id} eventId={eventId} onDone={() => setAdjustOpen(false)} />}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">참석 대상 ({attendance.length}명)</h2>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" />
            참석 대상 추가
          </Button>
        </div>
        {attendance.length === 0 ? (
          <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">아직 지정된 참석 대상이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>참가자</TableHead>
                  <TableHead>대표단</TableHead>
                  <TableHead>역할</TableHead>
                  <TableHead>참석 상태</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendance.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.participant?.last_name} {a.participant?.first_name}</TableCell>
                    <TableCell className="text-muted-foreground">{a.participant?.delegation?.name}</TableCell>
                    <TableCell className="text-muted-foreground">{ATTENDANCE_ROLE_LABEL[a.role]}</TableCell>
                    <TableCell>
                      <StatusBadge status={ATTENDANCE_STATUS_BADGE[a.status]}>{ATTENDANCE_STATUS_LABEL[a.status]}</StatusBadge>
                    </TableCell>
                    <TableCell>
                      <form action={removeProgramAttendance}>
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="revalidateTo" value={revalidateTo} />
                        <Button type="submit" variant="ghost" size="icon-sm">
                          <X className="size-4" />
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <AddAttendanceDialog
        programId={program.id}
        delegations={delegations}
        existingParticipantIds={existingIds}
        revalidateTo={revalidateTo}
        open={addOpen}
        onOpenChange={setAddOpen}
      />
    </div>
  );
}
