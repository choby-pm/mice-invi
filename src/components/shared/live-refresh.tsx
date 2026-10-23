"use client";
import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { claimDemoTabRole } from "@/components/shared/demo-tab-role";

export function LiveRefresh() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible" || document.querySelector('[role="dialog"], [role="alertdialog"]') ||
        document.activeElement?.matches("input,textarea,select,[contenteditable=true]")) return;
      claimDemoTabRole();
      startTransition(() => router.refresh());
    };
    const timer = setInterval(refresh, 15000);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [router]);
  return null;
}
