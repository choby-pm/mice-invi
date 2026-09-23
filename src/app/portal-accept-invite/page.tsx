"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { activateProxyMembership } from "@/server/modules/iam/activate-proxy";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// 대리인 초청 메일 링크가 여기로 옵니다. 대리인은 비밀번호가 없으므로(D-UX-03, 이메일
// 인증번호 방식) 세션이 확인되면 바로 대표단 배정을 활성화하고 포털로 들어갑니다.
export default function PortalAcceptInvitePage() {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "invalid">("checking");

  useEffect(() => {
    const supabase = createClient();
    let done = false;

    async function proceed() {
      if (done) return;
      done = true;
      await activateProxyMembership();
      router.push("/portal");
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) proceed();
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) proceed();
    });

    const timeout = setTimeout(() => {
      if (!done) setStatus("invalid");
    }, 4000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10 text-base">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>초대 확인</CardTitle>
          <CardDescription>
            {status === "checking"
              ? "확인 중입니다..."
              : "초대 링크가 만료됐거나 유효하지 않습니다. PCO 담당자에게 다시 초청을 요청하세요."}
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </main>
  );
}
