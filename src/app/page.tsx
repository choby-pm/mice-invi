import Link from "next/link";
import { Button } from "@/components/ui/button";
import { isDemoMode } from "@/lib/demo";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-2xl font-semibold">초청자 관리 솔루션</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        MICE 행사 해외 VIP 초청자 관리 솔루션. 역할별로 입장해 행사 운영과 초청자 서비스를 체험하세요.
      </p>
      <div className="flex gap-2">
        <Button render={<Link href="/login" />}>{isDemoMode() ? "데모 시작하기" : "로그인"}</Button>
        <Button render={<Link href="/dev/components" />} variant="outline">
          부품 견본 보기
        </Button>
      </div>
    </main>
  );
}
