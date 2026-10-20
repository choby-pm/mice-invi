"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDateTime, fromFormDateTime } from "@/lib/date";
import {
  PROGRAM_TYPE_LABEL,
  PROGRAM_STATUS_LABEL,
  PROGRAM_STATUS_BADGE,
  ATTENDANCE_STATUS_LABEL,
  ATTENDANCE_STATUS_BADGE,
} from "@/lib/program-constants";
import { respondProgramAttendance, registerSelfScheduledProgram } from "@/server/modules/program/actions";

interface AttendanceRow {
  id: string;
  status: string;
  participant: { id: string; first_name: string; last_name: string } | null;
}

interface ProgramRow {
  id: string;
  name: string;
  program_type: string;
  start_at: string | null;
  venue: string | null;
  status: string;
  late_registration: boolean;
  pco_adjust_note: string | null;
  program_attendance: AttendanceRow[];
}

interface ParticipantOption {
  id: string;
  first_name: string;
  last_name: string;
}

function ProgramCard({ program, revalidateTo }: { program: ProgramRow; revalidateTo: string }) {
  const isSelfScheduled = program.program_type === "SELF_SCHEDULED";
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">
          {isSelfScheduled && "🏳️ "}{program.name}
        </CardTitle>
        <StatusBadge status={PROGRAM_STATUS_BADGE[program.status]}>{PROGRAM_STATUS_LABEL[program.status]}</StatusBadge>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {PROGRAM_TYPE_LABEL[program.program_type]} · {program.start_at ? formatDateTime(program.start_at, "ko") : "일시 미정"}
          {program.venue && ` · ${program.venue}`}
        </p>
        {program.late_registration && (
          <p className="text-xs text-status-urgent-fg">🔴 늦은 등록 — 배차가 어려울 수 있습니다</p>
        )}
        {program.pco_adjust_note && (
          <p className="rounded-md bg-status-action-bg p-2 text-sm text-status-action-fg">PCO 조정 요청: {program.pco_adjust_note}</p>
        )}
        {program.program_attendance.length > 0 && (
          <div className="space-y-1.5">
            {program.program_attendance.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm">
                <span>{a.participant?.last_name} {a.participant?.first_name}</span>
                <div className="flex items-center gap-2">
                  <StatusBadge status={ATTENDANCE_STATUS_BADGE[a.status]}>{ATTENDANCE_STATUS_LABEL[a.status]}</StatusBadge>
                  {!isSelfScheduled && a.status !== "CONFIRMED" && (
                    <form action={respondProgramAttendance}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="status" value="CONFIRMED" />
                      <input type="hidden" name="revalidateTo" value={revalidateTo} />
                      <Button type="submit" size="sm" variant="outline">참석</Button>
                    </form>
                  )}
                  {!isSelfScheduled && a.status !== "DECLINED" && (
                    <form action={respondProgramAttendance}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="status" value="DECLINED" />
                      <input type="hidden" name="revalidateTo" value={revalidateTo} />
                      <Button type="submit" size="sm" variant="ghost">불참</Button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RegisterSelfScheduledDialog({
  delegationId,
  eventId,
  participants,
  revalidateTo,
  open,
  onOpenChange,
}: {
  delegationId: string;
  eventId: string;
  participants: ParticipantOption[];
  revalidateTo: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [startAt, setStartAt] = useState("");
  const [hoursUntilStart, setHoursUntilStart] = useState<number | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form action={registerSelfScheduledProgram} onSubmit={() => onOpenChange(false)}>
          <DialogHeader>
            <DialogTitle>대표단 자체 일정 등록</DialogTitle>
          </DialogHeader>
          <input type="hidden" name="delegationId" value={delegationId} />
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="revalidateTo" value={revalidateTo} />
          <div className="flex max-h-[65vh] flex-col gap-3 overflow-y-auto py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ss-name">제목</Label>
              <Input id="ss-name" name="name" placeholder="예: 대사관 교민 간담회" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ss-startAt">일시 (서울 GMT+9)</Label>
              <Input id="ss-startAt" name="startAt" type="datetime-local" required value={startAt} onChange={(e) => { const value = e.target.value; setStartAt(value); setHoursUntilStart(value ? (new Date(fromFormDateTime(value)).getTime() - Date.now()) / 3600000 : null); }} />
              {hoursUntilStart !== null && hoursUntilStart < 24 && hoursUntilStart > 0 && (
                <p className="text-xs text-status-urgent-fg">⚠️ 시작까지 24시간이 남지 않아 배차가 어려울 수 있습니다</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ss-venue">장소</Label>
              <Input id="ss-venue" name="venue" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>참석자</Label>
              {participants.length === 0 && <p className="text-xs text-muted-foreground">참가자를 먼저 추가해주세요.</p>}
              {participants.map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <Checkbox id={`ss-p-${p.id}`} name="participantIds" value={p.id} />
                  <Label htmlFor={`ss-p-${p.id}`} className="font-normal">{p.last_name} {p.first_name}</Label>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="ss-transfer" name="transferNeeded" />
              <Label htmlFor="ss-transfer" className="font-normal">차량이 필요합니다</Label>
            </div>
            <p className="text-xs text-muted-foreground">등록하면 PCO 승인 없이 곧바로 확정됩니다. 차량이 필요하면 수송 업체에 자동으로 요청이 전달됩니다.</p>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>취소</DialogClose>
            <Button type="submit">등록</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProgramList({
  delegationId,
  eventId,
  programs,
  participants,
  revalidateTo,
}: {
  delegationId: string;
  eventId: string;
  programs: ProgramRow[];
  participants: ParticipantOption[];
  revalidateTo: string;
}) {
  const [registerOpen, setRegisterOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">하위 행사</h2>
        <Button size="sm" variant="outline" onClick={() => setRegisterOpen(true)}>
          <Plus className="size-4" />
          자체 일정 등록
        </Button>
      </div>
      {programs.length === 0 ? (
        <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">아직 표시할 하위 행사가 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {programs.map((p) => (
            <ProgramCard key={p.id} program={p} revalidateTo={revalidateTo} />
          ))}
        </div>
      )}
      <RegisterSelfScheduledDialog
        delegationId={delegationId}
        eventId={eventId}
        participants={participants}
        revalidateTo={revalidateTo}
        open={registerOpen}
        onOpenChange={setRegisterOpen}
      />
    </div>
  );
}
