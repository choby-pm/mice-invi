"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

export function WorkspaceLink({ href, className, ...props }: ComponentProps<typeof Link>) {
  const pathname = usePathname();
  const active = pathname === String(href).split("?")[0];
  return <Link {...props} href={href} aria-current={active ? "page" : undefined} data-active={active || undefined} className={`${className ?? ""} data-active:bg-primary/10 data-active:font-semibold data-active:text-primary`} />;
}
