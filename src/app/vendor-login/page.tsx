import { logInVendor } from "@/server/modules/iam/vendor-auth-actions";
import { DemoLogin } from "@/components/shared/demo-login";
import { isDemoMode } from "@/lib/demo";
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

export default async function VendorLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  if (isDemoMode()) return <DemoLogin error={error} />;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>업체 로그인</CardTitle>
          <CardDescription>PCO가 초청한 이메일과 비밀번호로 로그인하세요.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="mb-3 rounded-md bg-status-urgent-bg px-3 py-2 text-sm text-status-urgent-fg">
              {error}
            </p>
          )}
          <form action={logInVendor} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">이메일</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">비밀번호</Label>
              <Input id="password" name="password" type="password" required autoComplete="current-password" />
            </div>
            <Button type="submit" className="mt-2">로그인</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
