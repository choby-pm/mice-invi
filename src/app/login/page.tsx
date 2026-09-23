import { mockLogin } from "@/server/auth/mock-login";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const ROLE_OPTIONS = [
  { role: "PCO_MANAGER", label: "PCO 담당자", desc: "행사 운영 콘솔" },
  { role: "VENDOR_STAFF", label: "협력 업체", desc: "업체 포털" },
  { role: "PROXY", label: "대리인", desc: "초청자 포털 (비서·수행원)" },
  { role: "PLATFORM_ADMIN", label: "플랫폼 운영자", desc: "내부 도구" },
] as const;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>초청자 관리 솔루션</CardTitle>
          <CardDescription>
            R0 개발 준비 단계 임시 로그인입니다. 실제 로그인(이메일 인증번호·비밀번호)은
            R1에서 붙입니다. 역할을 골라 들어가세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {ROLE_OPTIONS.map((opt) => (
            <form key={opt.role} action={mockLogin}>
              <input type="hidden" name="role" value={opt.role} />
              {next && <input type="hidden" name="next" value={next} />}
              <Button type="submit" variant="outline" className="w-full justify-start h-auto py-3">
                <div className="flex flex-col items-start">
                  <span className="font-medium">{opt.label}</span>
                  <span className="text-xs text-muted-foreground">{opt.desc}</span>
                </div>
              </Button>
            </form>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
