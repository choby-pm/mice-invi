import Link from "next/link";
import { getMessages } from "@/i18n/get-messages";
import { setLocale } from "@/server/i18n/set-locale";
import { Button } from "@/components/ui/button";
import { portalLogout } from "@/server/modules/iam/portal-auth-actions";
import { LiveRefresh } from "@/components/shared/live-refresh";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { locale, messages } = await getMessages();
  const nav = [
    { href: "/portal", label: messages.nav.checklist },
    { href: "/portal/flight", label: messages.nav.flight },
    { href: "/portal/schedule", label: messages.nav.schedule },
    { href: "/portal/messages", label: messages.nav.messages },
  ];

  return (
    // 대리인 포털은 본문 16px (아이폰 자동 확대 방지, 07 §4). 모바일 우선 레이아웃.
    <div className="min-h-screen flex flex-col text-base">
      <LiveRefresh />
      <header className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-base font-semibold">{messages.common.brand}</span>
        <div className="flex items-center gap-2">
          <form action={setLocale}>
            <input type="hidden" name="locale" value="ko" />
            <input type="hidden" name="next" value="/portal" />
            <button
              type="submit"
              className={`text-sm ${locale === "ko" ? "font-semibold text-primary" : "text-muted-foreground"}`}
            >
              {messages.common.language_ko}
            </button>
          </form>
          <span className="text-muted-foreground">/</span>
          <form action={setLocale}>
            <input type="hidden" name="locale" value="en" />
            <input type="hidden" name="next" value="/portal" />
            <button
              type="submit"
              className={`text-sm ${locale === "en" ? "font-semibold text-primary" : "text-muted-foreground"}`}
            >
              {messages.common.language_en}
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 px-4 py-6">{children}</main>
      <nav className="grid grid-cols-4 gap-1 border-t px-2 py-2">
        {nav.map((item) => (
          <Link key={item.href} href={item.href} className="rounded-md px-2 py-2 text-center text-sm text-muted-foreground hover:bg-muted">
            {item.label}
          </Link>
        ))}
      </nav>
      <form action={portalLogout} className="border-t px-4 py-2">
        <Button type="submit" variant="ghost" size="sm" className="w-full">
          {messages.common.logout}
        </Button>
      </form>
    </div>
  );
}
