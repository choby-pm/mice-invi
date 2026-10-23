"use client";
import { useEffect } from "react";
import { DEMO_TAB_COOKIE } from "@/lib/demo";

const KEY = "demo-tab-role";
let adopted = false;

// 탭마다 처음 연 역할을 기억하고, 그 탭을 보거나 누르는 순간 서버에 보낼 역할 쿠키를 그 역할로 되돌립니다.
// shortcut: 탭 두 개를 동시에 조작하는 경우(자동 새로고침 포함)는 마지막으로 쿠키를 쓴 탭 기준. 데모 전용.
export function claimDemoTabRole() {
  try {
    const role = sessionStorage.getItem(KEY);
    if (role) document.cookie = `${DEMO_TAB_COOKIE}=${role}; path=/; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
  } catch {
    // 저장소를 쓸 수 없는 브라우저는 마지막으로 입장한 역할을 그대로 씁니다.
  }
}

export function DemoTabRole() {
  useEffect(() => {
    // 페이지를 새로 불러온 순간의 쿠키가 서버가 이 탭을 그린 역할입니다 (같은 탭에서 다른 데모로 이동한 경우 포함).
    if (!adopted) try {
      adopted = true;
      const role = document.cookie.split("; ").find((c) => c.startsWith(`${DEMO_TAB_COOKIE}=`))?.split("=")[1];
      if (role) sessionStorage.setItem(KEY, role);
    } catch {}
    const onVisible = () => document.visibilityState === "visible" && claimDemoTabRole();
    const events = ["focus", "pageshow"] as const;
    events.forEach((e) => window.addEventListener(e, claimDemoTabRole));
    document.addEventListener("visibilitychange", onVisible);
    document.addEventListener("pointerdown", claimDemoTabRole, true);
    document.addEventListener("keydown", claimDemoTabRole, true);
    return () => {
      events.forEach((e) => window.removeEventListener(e, claimDemoTabRole));
      document.removeEventListener("visibilitychange", onVisible);
      document.removeEventListener("pointerdown", claimDemoTabRole, true);
      document.removeEventListener("keydown", claimDemoTabRole, true);
    };
  }, []);
  return null;
}
