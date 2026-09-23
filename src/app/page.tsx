import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-2xl font-semibold">초청자 관리 솔루션</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        MICE 행사 해외 VIP 초청자 관리 솔루션. R0 개발 준비 단계 — 화면 뼈대와 기본
        컴포넌트를 확인하는 중입니다.
      </p>
      <div className="flex gap-2">
        <Button render={<Link href="/login" />}>로그인 (임시)</Button>
        <Button render={<Link href="/dev/components" />} variant="outline">
          부품 견본 보기
        </Button>
      </div>
    </main>
  );
}
