import type { Metadata } from "next";
import { DemoTabRole } from "@/components/shared/demo-tab-role";
import { isDemoMode } from "@/lib/demo";
import { WorkspaceLink } from "@/components/shared/workspace-link";
import {
  CalendarRange,
  Settings,
  LogOut,
  History,
  UserPlus,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { logOutPco } from "@/server/modules/iam/auth-actions";
import { requirePcoMembership } from "@/server/modules/org/get-membership";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

// 행사에 속한 메뉴(대표단·변경 이슈·전체 명단·업체)는 여기 없습니다 —
// 행사를 선택하면 사이드바 자체가 events/[id]/layout.tsx의 것으로 바뀝니다.
const NAV = [
  { href: "/console", label: "행사 목록", icon: CalendarRange },
  { href: "/console/audit", label: "활동 기록", icon: History },
  { href: "/console/team", label: "팀 관리", icon: UserPlus },
  { href: "/console/settings", label: "설정", icon: Settings },
];

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  await requirePcoMembership();
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getClaims();

  return (
    <SidebarProvider>{isDemoMode() && <DemoTabRole />}
      <Sidebar collapsible="icon">
        <SidebarHeader className="px-3 py-3">
          <span className="text-sm font-semibold group-data-[collapsible=icon]:hidden">
            초청자 관리 솔루션
          </span>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton render={<WorkspaceLink href={item.href} />} tooltip={item.label}>
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="px-3 py-3">
          <span className="mb-1 truncate text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
            {data?.claims.email}
          </span>
          <form action={logOutPco}>
            <Button type="submit" variant="ghost" size="sm" className="w-full justify-start gap-2">
              <LogOut className="size-4" />
              <span className="group-data-[collapsible=icon]:hidden">로그아웃</span>
            </Button>
          </form>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0 bg-muted/40">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-background px-4 sm:px-8">
          <SidebarTrigger />
          <span className="text-sm text-muted-foreground">PCO 콘솔</span>
        </header>
        <main className="mx-auto w-full max-w-[1600px] flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

export const metadata: Metadata = { title: "PCO 콘솔" };
