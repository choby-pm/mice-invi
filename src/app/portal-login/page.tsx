import { requestPortalOtp, verifyPortalOtp } from "@/server/modules/iam/portal-auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; email?: string; error?: string }>;
}) {
  const { step, email, error } = await searchParams;
  const isVerifyStep = step === "verify" && !!email;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10 text-base">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>대리인 로그인</CardTitle>
          <CardDescription>
            {isVerifyStep
              ? `${email}로 보낸 6자리 인증번호를 입력하세요.`
              : "PCO가 초청한 이메일을 입력하면 인증번호를 보내드립니다."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="mb-3 rounded-md bg-status-urgent-bg px-3 py-2 text-sm text-status-urgent-fg">
              {error}
            </p>
          )}
          {isVerifyStep ? (
            <div className="flex flex-col gap-3">
              <form action={verifyPortalOtp} className="flex flex-col gap-3">
                <input type="hidden" name="email" value={email} />
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="token">인증번호</Label>
                  <Input id="token" name="token" inputMode="numeric" maxLength={6} required autoFocus />
                </div>
                <Button type="submit" className="mt-2">확인</Button>
              </form>
              <form action={requestPortalOtp}>
                <input type="hidden" name="email" value={email} />
                <Button type="submit" variant="ghost" size="sm" className="w-full">
                  인증번호 다시 받기
                </Button>
              </form>
            </div>
          ) : (
            <form action={requestPortalOtp} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">이메일</Label>
                <Input id="email" name="email" type="email" required autoFocus />
              </div>
              <Button type="submit" className="mt-2">인증번호 받기</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
