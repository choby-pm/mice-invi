"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
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
import { addConsentItem, deleteConsentItem, publishPolicy, updateNoticeBody } from "@/server/modules/consent/actions";

const CATEGORY_LABEL: Record<string, string> = {
  REQUIRED: "필수",
  OPTIONAL: "선택",
  SENSITIVE: "민감정보",
  UNIQUE_ID: "고유식별정보",
  OVERSEAS_TRANSFER: "국외 이전",
  REUSE_STORAGE: "재사용 보관",
};

interface ConsentItemRow {
  id: string;
  category: string;
  text: { ko?: string; en?: string };
  required: boolean;
}
interface PolicyData {
  id: string;
  version: number;
  is_current: boolean;
  notice_body: { ko?: string; en?: string };
}

function AddItemDialog({
  policyId,
  eventId,
  open,
  onOpenChange,
}: {
  policyId: string;
  eventId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form action={addConsentItem} onSubmit={() => onOpenChange(false)}>
          <DialogHeader>
            <DialogTitle>동의 항목 추가</DialogTitle>
          </DialogHeader>
          <input type="hidden" name="policyId" value={policyId} />
          <input type="hidden" name="eventId" value={eventId} />
          <div className="flex flex-col gap-3 py-4">
            <div className="flex flex-col gap-1.5">
              <Label>구분</Label>
              <Select name="category" defaultValue="REQUIRED" required>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="textKo">문구 (한국어)</Label>
              <Textarea id="textKo" name="textKo" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="textEn">문구 (English, 선택)</Label>
              <Textarea id="textEn" name="textEn" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="required" name="required" defaultChecked />
              <Label htmlFor="required" className="font-normal">필수 항목</Label>
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

export function ConsentBoard({
  eventId,
  policy,
  items,
}: {
  eventId: string;
  policy: PolicyData;
  items: ConsentItemRow[];
}) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">동의서</h1>
        <Badge variant={policy.is_current ? "default" : "secondary"}>
          v{policy.version} {policy.is_current ? "게시됨" : "초안"}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">공지 안내문</CardTitle>
          <CardDescription>대리인 포털 상단에 표시됩니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateNoticeBody} className="flex flex-col gap-3">
            <input type="hidden" name="policyId" value={policy.id} />
            <input type="hidden" name="eventId" value={eventId} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="noticeKo">한국어</Label>
              <Textarea id="noticeKo" name="noticeKo" defaultValue={policy.notice_body?.ko ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="noticeEn">English</Label>
              <Textarea id="noticeEn" name="noticeEn" defaultValue={policy.notice_body?.en ?? ""} />
            </div>
            <Button type="submit" variant="outline" className="self-start">안내문 저장</Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">동의 항목 {items.length}개</h2>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="size-4" />
          항목 추가
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
          아직 동의 항목이 없습니다.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{CATEGORY_LABEL[item.category]}</Badge>
                  {item.required && <span className="text-xs text-status-urgent-fg">필수</span>}
                </div>
                <p className="text-sm">{item.text?.ko}</p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
                  <X className="size-4" />
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>이 항목을 삭제할까요?</AlertDialogTitle>
                    <AlertDialogDescription>되돌릴 수 없습니다.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <form action={deleteConsentItem}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="eventId" value={eventId} />
                      <AlertDialogAction type="submit" variant="destructive">삭제</AlertDialogAction>
                    </form>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </li>
          ))}
        </ul>
      )}

      {!policy.is_current && (
        <form action={publishPolicy}>
          <input type="hidden" name="policyId" value={policy.id} />
          <input type="hidden" name="eventId" value={eventId} />
          <Button type="submit" disabled={items.length === 0}>이 버전 게시하기</Button>
        </form>
      )}

      <AddItemDialog policyId={policy.id} eventId={eventId} open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
