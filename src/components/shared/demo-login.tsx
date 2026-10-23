import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEMO_GROUPS, DEMO_ROLES } from "@/lib/demo";
import { mockLogin } from "@/server/auth/mock-login";

export function DemoLogin({ error }: { error?: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>초청자 관리 솔루션 · 데모</CardTitle>
          <CardDescription>체험할 서비스를 고르면 새 탭에서 바로 열립니다. 로그인은 필요 없습니다.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {error && <p role="alert" className="rounded-md bg-status-urgent-bg p-3 text-sm text-status-urgent-fg">{error}</p>}
          {DEMO_GROUPS.map(({ group, title }) => (
            <section key={group} className="flex flex-col gap-2" aria-labelledby={`demo-${group}`}>
              <h2 id={`demo-${group}`} className="text-sm font-semibold text-muted-foreground">{title}</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {DEMO_ROLES.filter((option) => option.group === group).map((option) => (
                  <Button key={option.role} render={<a href={`/demo-login?role=${option.role}`} target="_blank" rel="noopener" />} nativeButton={false} variant="outline" className="h-auto w-full justify-between gap-3 py-3">
                    <span className="flex flex-col items-start gap-1 whitespace-normal text-left">
                      <span className="font-medium">{option.label}</span>
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                    </span>
                    <ExternalLink className="size-4 shrink-0 text-muted-foreground" aria-label="새 탭에서 열기" />
                  </Button>
                ))}
              </div>
            </section>
          ))}
          <form action={mockLogin}>
            <input type="hidden" name="role" value="PLATFORM_ADMIN" />
            <Button type="submit" variant="ghost" className="w-full">플랫폼 운영자 화면 보기</Button>
          </form>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>탭마다 고른 서비스가 따로 유지됩니다. 여러 탭을 열어 PCO·VIP 측·업체 화면을 오가며 비교할 수 있습니다.</p>
            <p>공용 데모 데이터입니다. 테스트한 변경 내용은 다른 체험자에게도 보입니다.</p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
