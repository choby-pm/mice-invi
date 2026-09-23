"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDate, formatDateTime } from "@/lib/date";

const demoDate = new Date("2026-10-14T10:30:00Z");

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-b pb-8">
      <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}

export default function ComponentGalleryPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 p-8">
      <div>
        <h1 className="text-xl font-semibold">부품 견본 (R0-5)</h1>
        <p className="text-sm text-muted-foreground">
          테마 T1 프로토콜 네이비 토큰이 적용된 기본 shadcn 부품 + StatusBadge입니다.
        </p>
      </div>

      <Section title="Button">
        <Button>기본</Button>
        <Button variant="outline">외곽선</Button>
        <Button variant="secondary">보조</Button>
        <Button variant="ghost">고스트</Button>
        <Button variant="destructive">삭제</Button>
        <Button size="sm">작게</Button>
      </Section>

      <Section title="Badge / StatusBadge">
        <Badge>default</Badge>
        <Badge variant="secondary">secondary</Badge>
        <Badge variant="outline">outline</Badge>
        <StatusBadge status="urgent">긴급</StatusBadge>
        <StatusBadge status="urgent" strong>3건 긴급</StatusBadge>
        <StatusBadge status="action">조치 필요</StatusBadge>
        <StatusBadge status="progress">처리중</StatusBadge>
        <StatusBadge status="done">완료</StatusBadge>
        <StatusBadge status="wait">대기</StatusBadge>
        <StatusBadge status="void">무효</StatusBadge>
      </Section>

      <Section title="Card">
        <Card className="w-64">
          <CardHeader>
            <CardTitle>대표단 A</CardTitle>
            <CardDescription>20명 · 완결률 80%</CardDescription>
          </CardHeader>
          <CardContent>
            <StatusBadge status="progress">처리중</StatusBadge>
          </CardContent>
        </Card>
      </Section>

      <Section title="Table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead>상태</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>홍길동</TableCell>
              <TableCell><StatusBadge status="done">완료</StatusBadge></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Section>

      <Section title="Tabs">
        <Tabs defaultValue="a" className="w-64">
          <TabsList>
            <TabsTrigger value="a">개요</TabsTrigger>
            <TabsTrigger value="b">참가자</TabsTrigger>
          </TabsList>
          <TabsContent value="a">개요 내용</TabsContent>
          <TabsContent value="b">참가자 내용</TabsContent>
        </Tabs>
      </Section>

      <Section title="Dialog / AlertDialog / Sheet / DropdownMenu">
        <Dialog>
          <DialogTrigger render={<Button variant="outline" />}>대화상자 열기</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>새 대표단 추가</DialogTitle>
              <DialogDescription>되돌릴 수 있는 행동 예시</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button>저장</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="destructive" />}>삭제</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>정말 삭제할까요?</AlertDialogTitle>
              <AlertDialogDescription>되돌릴 수 없는 행동은 확인 창을 거칩니다 (UD-09)</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
              <AlertDialogAction>삭제</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Sheet>
          <SheetTrigger render={<Button variant="outline" />}>상세 패널 열기</SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>참가자 상세</SheetTitle>
              <SheetDescription>오른쪽 Sheet 패턴 (UD-04)</SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" />}>⋯ 메뉴</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>수정</DropdownMenuItem>
            <DropdownMenuItem>삭제</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Section>

      <Section title="Input / Label / Switch / RadioGroup / Checkbox">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">이름</Label>
          <Input id="name" placeholder="홍길동" />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="sw" />
          <Label htmlFor="sw">알림 받기</Label>
        </div>
        <RadioGroup defaultValue="a" className="flex gap-4">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="a" id="ra" />
            <Label htmlFor="ra">A안</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="b" id="rb" />
            <Label htmlFor="rb">B안</Label>
          </div>
        </RadioGroup>
        <div className="flex items-center gap-2">
          <Checkbox id="cb" />
          <Label htmlFor="cb">동의합니다</Label>
        </div>
      </Section>

      <Section title="Sonner (토스트)">
        <Button variant="outline" onClick={() => toast("변경 사항이 저장되었습니다", { action: { label: "실행 취소", onClick: () => {} } })}>
          토스트 표시
        </Button>
      </Section>

      <Section title="날짜·시간대 표기 (R0-7, 02 §1.13)">
        <div className="flex flex-col gap-1 text-sm">
          <div>ko: <code>{formatDate(demoDate, "ko")}</code></div>
          <div>en: <code>{formatDate(demoDate, "en")}</code></div>
          <div>ko + 시간대: <code>{formatDateTime(demoDate, "ko", "Asia/Seoul")}</code></div>
          <div>en + 시간대(하노이): <code>{formatDateTime(demoDate, "en", "Asia/Bangkok")}</code></div>
        </div>
      </Section>
    </main>
  );
}
