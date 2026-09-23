"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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

// Supabase 초대 메일 링크가 여기로 옵니다. 링크의 임시 토큰으로 세션이 자동 생성되고,
// 사용자가 처음으로 실제 비밀번호를 정합니다.
export default function AcceptInvitePage() {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "ready" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) setStatus("ready");
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setStatus("ready");
    });

    const timeout = setTimeout(() => {
      setStatus((s) => (s === "checking" ? "invalid" : s));
    }, 4000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다");
      return;
    }
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/console");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>초대 수락</CardTitle>
          <CardDescription>비밀번호를 정하면 바로 콘솔로 들어갑니다.</CardDescription>
        </CardHeader>
        <CardContent>
          {status === "checking" && <p className="text-sm text-muted-foreground">확인 중...</p>}
          {status === "invalid" && (
            <p className="text-sm text-status-urgent-fg">
              초대 링크가 만료됐거나 유효하지 않습니다. PCO 관리자에게 다시 초대를 요청하세요.
            </p>
          )}
          {status === "ready" && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              {error && (
                <p className="rounded-md bg-status-urgent-bg px-3 py-2 text-sm text-status-urgent-fg">
                  {error}
                </p>
              )}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">비밀번호 (8자 이상)</Label>
                <Input
                  id="password"
                  type="password"
                  minLength={8}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" disabled={submitting} className="mt-1">
                {submitting ? "처리 중..." : "완료"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
