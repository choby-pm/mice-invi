import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users, AlertTriangle, Table2, Building2, LogOut } from "lucide-react";
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
import { StatusBadge, type StatusBadgeStatus } from "@/components/shared/status-badge";

const STATUS_LABEL: Record<string, string> = { PREPARING: "준비 중", ACTIVE: "진행 중", CLOSED: "종료" };
const STATUS_BADGE: Record<string, StatusBadgeStatus> = { PREPARING: "wait", ACTIVE: "progress", CLOSED: "done" };

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const [{ data: event }, { data: { user } }] = await Promise.all([
    supabase.from("event").select("id, name, status").eq("id", id).single(),
    supabase.auth.getUser(),
  ]);
  if (!event) notFound();

  // 이 행사 안에서만 의미 있는 메뉴 (행사를 나가면 사이드바가 (dashboard) 것으로 되돌아갑니다)
  const nav = [
    { href: `/console/events/${id}/delegations`, label: "대표단", icon: Users },
    { href: `/console/events/${id}/issues`, label: "변경 이슈", icon: AlertTriangle },
    { href: `/console/events/${id}/roster`, label: "전체 명단", icon: Table2 },
    { href: `/console/events/${id}/vendors`, label: "업체", icon: Building2 },
  ];

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="px-3 py-3">
          <Link
            href="/console"
            className="mb-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground group-data-[collapsible=icon]:justify-center"
          >
            <ArrowLeft className="size-3.5" />
            <span className="group-data-[collapsible=icon]:hidden">행사 목록</span>
          </Link>
          <span className="block truncate text-sm font-semibold group-data-[collapsible=icon]:hidden">
            {event.name}
          </span>
          <div className="mt-1 group-data-[collapsible=icon]:hidden">
            <StatusBadge status={STATUS_BADGE[event.status]}>{STATUS_LABEL[event.status]}</StatusBadge>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {nav.map((item) => (
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
          <span className="text-sm text-muted-foreground">{event.name}</span>
        </header>
        <div className="flex-1 p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
