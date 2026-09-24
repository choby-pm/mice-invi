"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDateTime } from "@/lib/date";
import {
  PROGRAM_TYPE_LABEL,
  PROGRAM_STATUS_LABEL,
  PROGRAM_STATUS_BADGE,
  ATTENDANCE_STATUS_LABEL,
  ATTENDANCE_STATUS_BADGE,
} from "@/lib/program-constants";
import { respondProgramAttendance } from "@/server/modules/program/actions";

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
  program_attendance: AttendanceRow[];
}

function ProgramCard({ program, revalidateTo }: { program: ProgramRow; revalidateTo: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{program.name}</CardTitle>
        <StatusBadge status={PROGRAM_STATUS_BADGE[program.status]}>{PROGRAM_STATUS_LABEL[program.status]}</StatusBadge>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {PROGRAM_TYPE_LABEL[program.program_type]} · {program.start_at ? formatDateTime(program.start_at, "ko") : "일시 미정"}
          {program.venue && ` · ${program.venue}`}
        </p>
        {program.program_attendance.length > 0 && (
          <div className="space-y-1.5">
            {program.program_attendance.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm">
                <span>{a.participant?.last_name} {a.participant?.first_name}</span>
                <div className="flex items-center gap-2">
                  <StatusBadge status={ATTENDANCE_STATUS_BADGE[a.status]}>{ATTENDANCE_STATUS_LABEL[a.status]}</StatusBadge>
                  {a.status !== "CONFIRMED" && (
                    <form action={respondProgramAttendance}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="status" value="CONFIRMED" />
                      <input type="hidden" name="revalidateTo" value={revalidateTo} />
                      <Button type="submit" size="sm" variant="outline">참석</Button>
                    </form>
                  )}
                  {a.status !== "DECLINED" && (
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

export function ProgramList({ programs, revalidateTo }: { programs: ProgramRow[]; revalidateTo: string }) {
  if (programs.length === 0) return null;
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">하위 행사</h2>
      <div className="space-y-3">
        {programs.map((p) => (
          <ProgramCard key={p.id} program={p} revalidateTo={revalidateTo} />
        ))}
      </div>
    </div>
  );
}
