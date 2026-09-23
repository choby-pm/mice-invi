"use client";

import { useState, useTransition } from "react";
import { Eye, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { createParticipant } from "@/server/modules/participant/actions";
import {
  saveParticipantSensitive,
  viewParticipantSensitive,
  type ParticipantSensitiveData,
} from "@/server/modules/participant/sensitive-actions";

const PARTICIPANT_TYPE_LABEL: Record<string, string> = {
  VIP: "VIP",
  COMPANION: "동반자",
  STAFF: "수행원",
};

interface ParticipantRow {
  id: string;
  first_name: string;
  last_name: string;
  participant_type: string;
}

function AddParticipantDialog({
  eventId,
  delegationId,
  open,
  onOpenChange,
}: {
  eventId: string;
  delegationId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form action={createParticipant} onSubmit={() => onOpenChange(false)}>
          <DialogHeader>
            <DialogTitle>참가자 추가</DialogTitle>
          </DialogHeader>
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="delegationId" value={delegationId} />
          <div className="flex flex-col gap-3 py-4">
            <div className="flex flex-col gap-1.5">
              <Label>참가자 유형</Label>
              <Select name="participantType" defaultValue="STAFF" required>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="VIP">VIP</SelectItem>
                  <SelectItem value="COMPANION">동반자</SelectItem>
                  <SelectItem value="STAFF">수행원</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="lastName">여권상 성</Label>
                <Input id="lastName" name="lastName" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="firstName">여권상 이름</Label>
                <Input id="firstName" name="firstName" required />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nationality">국적</Label>
              <Input id="nationality" name="nationality" placeholder="예: VN" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="honorific">호칭 (선택)</Label>
                <Input id="honorific" name="honorific" placeholder="예: H.E." />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="title">직함 (선택)</Label>
                <Input id="title" name="title" />
              </div>
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

function SensitiveInfoSheet({
  eventId,
  delegationId,
  participant,
  open,
  onOpenChange,
}: {
  eventId: string;
  delegationId: string;
  participant: ParticipantRow;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [revealed, setRevealed] = useState<ParticipantSensitiveData | null>(null);
  const [pending, startTransition] = useTransition();

  function handleReveal() {
    startTransition(async () => {
      const data = await viewParticipantSensitive(participant.id);
      setRevealed(
        data ?? {
          passport_no: null,
          passport_country: null,
          passport_expiry: null,
          medical_note: null,
          allergy: null,
          mobility_need: null,
          religion: null,
          purge_status: null,
        },
      );
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setRevealed(null);
      }}
    >
      <SheetContent className="gap-0">
        <SheetHeader>
          <SheetTitle>
            🔒 {participant.last_name} {participant.first_name} — 민감정보
          </SheetTitle>
          <SheetDescription>여권·건강 등은 열람마다 기록이 남습니다.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {revealed === null ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                기본적으로 가려져 있습니다. 아래 버튼을 누르면 열람 기록이 남고 내용이 표시됩니다.
              </p>
              <Button onClick={handleReveal} disabled={pending}>
                <Eye className="size-4" />
                {pending ? "불러오는 중..." : "정보 보기"}
              </Button>
            </div>
          ) : (
            <form action={saveParticipantSensitive} className="flex flex-col gap-3 pt-2">
              <input type="hidden" name="participantId" value={participant.id} />
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="delegationId" value={delegationId} />
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="passportNo">여권번호</Label>
                  <Input id="passportNo" name="passportNo" defaultValue={revealed.passport_no ?? ""} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="passportCountry">발급국</Label>
                  <Input id="passportCountry" name="passportCountry" defaultValue={revealed.passport_country ?? ""} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="passportExpiry">여권 만료일</Label>
                <Input id="passportExpiry" name="passportExpiry" type="date" defaultValue={revealed.passport_expiry ?? ""} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="religion">종교</Label>
                <Input id="religion" name="religion" defaultValue={revealed.religion ?? ""} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="allergy">알레르기</Label>
                <Input id="allergy" name="allergy" defaultValue={revealed.allergy ?? ""} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mobilityNeed">이동 보조 필요</Label>
                <Input id="mobilityNeed" name="mobilityNeed" defaultValue={revealed.mobility_need ?? ""} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="medicalNote">의료 사항</Label>
                <Input id="medicalNote" name="medicalNote" defaultValue={revealed.medical_note ?? ""} />
              </div>
              <SheetFooter className="px-0">
                <Button type="submit" onClick={() => onOpenChange(false)}>저장</Button>
              </SheetFooter>
            </form>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ParticipantRowItem({
  eventId,
  delegationId,
  participant,
}: {
  eventId: string;
  delegationId: string;
  participant: ParticipantRow;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  return (
    <li className="flex items-center justify-between px-4 py-2 text-sm">
      <span>
        {participant.last_name} {participant.first_name} · {PARTICIPANT_TYPE_LABEL[participant.participant_type]}
      </span>
      <Button variant="ghost" size="sm" onClick={() => setSheetOpen(true)}>
        🔒 민감정보
      </Button>
      <SensitiveInfoSheet
        eventId={eventId}
        delegationId={delegationId}
        participant={participant}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </li>
  );
}

export function ParticipantList({
  eventId,
  delegationId,
  participants,
}: {
  eventId: string;
  delegationId: string;
  participants: ParticipantRow[];
}) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">참가자 {participants.length}명</h2>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="size-4" />
          참가자 추가
        </Button>
      </div>
      {participants.length === 0 ? (
        <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
          아직 참가자가 없습니다.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {participants.map((p) => (
            <ParticipantRowItem key={p.id} eventId={eventId} delegationId={delegationId} participant={p} />
          ))}
        </ul>
      )}
      <AddParticipantDialog eventId={eventId} delegationId={delegationId} open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
