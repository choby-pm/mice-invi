import Link from "next/link";
import {
  CalendarRange,
  AlertTriangle,
  Users,
  Table2,
  Building2,
  Settings,
  LogOut,
  History,
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
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

const NAV = [
  { href: "/console", label: "행사 목록", icon: CalendarRange },
  { href: "/console/issues", label: "변경 이슈", icon: AlertTriangle },
  { href: "/console/delegations", label: "대표단", icon: Users },
  { href: "/console/roster", label: "전체 명단", icon: Table2 },
  { href: "/console/vendors", label: "업체", icon: Building2 },
  { href: "/console/audit", label: "활동 기록", icon: History },
  { href: "/console/settings", label: "설정", icon: Settings },
];

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <SidebarProvider>
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
                    <SidebarMenuButton render={<Link href={item.href} />} tooltip={item.label}>
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
            {user?.email}
          </span>
          <form action={logOutPco}>
            <Button type="submit" variant="ghost" size="sm" className="w-full justify-start gap-2">
              <LogOut className="size-4" />
              <span className="group-data-[collapsible=icon]:hidden">로그아웃</span>
            </Button>
          </form>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <span className="text-sm text-muted-foreground">PCO 콘솔</span>
        </header>
        <div className="flex-1 p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
