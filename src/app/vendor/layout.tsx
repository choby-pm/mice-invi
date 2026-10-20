import { WorkspaceLink } from "@/components/shared/workspace-link";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { vendorLogout } from "@/server/modules/iam/vendor-auth-actions";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { Plane } from "lucide-react";
import { LiveRefresh } from "@/components/shared/live-refresh";

const NAV = [
  { href: "/vendor", label: "통합 할 일" },
  { href: "/vendor/history", label: "처리 내역" },
  { href: "/vendor/account", label: "내 정보" },
];

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getClaims();

  return (
    <div className="min-h-screen bg-muted/30">
      <LiveRefresh />
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-6">
          <Link href="/vendor" className="flex items-center gap-3"><span className="rounded-xl bg-primary p-2.5 text-primary-foreground"><Plane className="size-5" /></span><span><span className="block text-base font-semibold">MICE INVI</span><span className="text-xs text-muted-foreground">파트너 업무공간</span></span></Link>
          <nav className="flex gap-2 rounded-lg bg-muted/60 p-1">
            {NAV.map((item) => (
              <WorkspaceLink key={item.href} href={item.href} className="rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-background hover:text-primary">
                {item.label}
              </WorkspaceLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-muted-foreground xl:block">{data?.claims.email}</span>
          <form action={vendorLogout}>
            <Button type="submit" variant="ghost" size="sm">로그아웃</Button>
          </form>
        </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
