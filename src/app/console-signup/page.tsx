import Link from "next/link";
import { signUpPco } from "@/server/modules/iam/auth-actions";
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

export default async function ConsoleSignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>PCO 회사 계정 만들기</CardTitle>
          <CardDescription>
            이 계정이 첫 관리자(PCO_ADMIN)가 됩니다. 직원·업체 초대는 로그인 후 콘솔에서 합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="mb-3 rounded-md bg-status-urgent-bg px-3 py-2 text-sm text-status-urgent-fg">
              {error}
            </p>
          )}
          <form action={signUpPco} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tenantName">회사(PCO)명</Label>
              <Input id="tenantName" name="tenantName" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">이메일</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">비밀번호 (8자 이상)</Label>
              <Input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" />
            </div>
            <Button type="submit" className="mt-2">계정 만들기</Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            이미 계정이 있나요?{" "}
            <Link href="/console-login" className="text-primary underline underline-offset-2">
              로그인
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
