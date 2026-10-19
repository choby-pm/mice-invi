import Link from "next/link";
import { DemoLogin } from "@/components/shared/demo-login";
import { isDemoMode } from "@/lib/demo";
import { mockLogin } from "@/server/auth/mock-login";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const MOCK_ROLE_OPTIONS = [
  { role: "PLATFORM_ADMIN", label: "플랫폼 운영자", desc: "내부 도구" },
] as const;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  if (isDemoMode()) return <DemoLogin error={error} />;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>초청자 관리 솔루션</CardTitle>
          <CardDescription>역할을 골라 들어가세요.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button render={<Link href="/console-login" />} variant="outline" className="w-full justify-start h-auto py-3">
            <div className="flex flex-col items-start">
              <span className="font-medium">PCO 담당자</span>
              <span className="text-xs text-muted-foreground">행사 운영 콘솔 (실제 로그인)</span>
            </div>
          </Button>
          <Button render={<Link href="/portal-login" />} variant="outline" className="w-full justify-start h-auto py-3">
            <div className="flex flex-col items-start">
              <span className="font-medium">대리인</span>
              <span className="text-xs text-muted-foreground">초청자 포털 (실제 로그인, 이메일 인증번호)</span>
            </div>
          </Button>
          <Button render={<Link href="/vendor-login" />} variant="outline" className="w-full justify-start h-auto py-3">
            <div className="flex flex-col items-start">
              <span className="font-medium">협력 업체</span>
              <span className="text-xs text-muted-foreground">업체 포털 (실제 로그인)</span>
            </div>
          </Button>
          {MOCK_ROLE_OPTIONS.map((opt) => (
            <form key={opt.role} action={mockLogin}>
              <input type="hidden" name="role" value={opt.role} />
              {next && <input type="hidden" name="next" value={next} />}
              <Button type="submit" variant="outline" className="w-full justify-start h-auto py-3">
                <div className="flex flex-col items-start">
                  <span className="font-medium">{opt.label}</span>
                  <span className="text-xs text-muted-foreground">{opt.desc} (임시 로그인)</span>
                </div>
              </Button>
            </form>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
