import { Button } from "@/components/ui/button";
import { mockLogout } from "@/server/auth/mock-login";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex h-12 items-center justify-between border-b px-4">
        <span className="text-sm font-semibold">초청자 관리 솔루션 · 운영사 내부 도구</span>
        <form action={mockLogout}>
          <Button type="submit" variant="ghost" size="sm">로그아웃</Button>
        </form>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
