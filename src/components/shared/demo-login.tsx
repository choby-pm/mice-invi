import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEMO_ROLES } from "@/lib/demo";
import { demoLogin } from "@/server/auth/demo-login";
import { mockLogin } from "@/server/auth/mock-login";
import { DemoLoginButton } from "@/components/shared/demo-login-button";

export function DemoLogin({ error }: { error?: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>초청자 관리 솔루션 · 데모</CardTitle>
          <CardDescription>테스트할 역할을 선택하세요. 비밀번호와 인증번호 없이 데모 계정으로 입장합니다.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {error && <p role="alert" className="rounded-md bg-status-urgent-bg p-3 text-sm text-status-urgent-fg">{error}</p>}
          {DEMO_ROLES.map((option) => (
            <form key={option.role} action={demoLogin}>
              <input type="hidden" name="role" value={option.role} />
              <DemoLoginButton label={option.label} description={option.description} />
            </form>
          ))}
          <form action={mockLogin}>
            <input type="hidden" name="role" value="PLATFORM_ADMIN" />
            <Button type="submit" variant="ghost" className="w-full">플랫폼 운영자 화면 보기</Button>
          </form>
          <p className="text-xs text-muted-foreground">공용 데모 데이터입니다. 테스트한 변경 내용은 다른 체험자에게도 보입니다.</p>
        </CardContent>
      </Card>
    </main>
  );
}
