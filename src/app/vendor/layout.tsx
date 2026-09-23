import Link from "next/link";
import { Button } from "@/components/ui/button";
import { mockLogout } from "@/server/auth/mock-login";

const NAV = [
  { href: "/vendor", label: "통합 할 일" },
  { href: "/vendor/history", label: "처리 내역" },
  { href: "/vendor/account", label: "내 정보" },
];

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex h-14 items-center justify-between border-b px-4">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold">초청자 관리 솔루션 · 업체 포털</span>
          <nav className="flex gap-4">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="text-sm text-muted-foreground hover:text-foreground">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <form action={mockLogout}>
          <Button type="submit" variant="ghost" size="sm">로그아웃</Button>
        </form>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
