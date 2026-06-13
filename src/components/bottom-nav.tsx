"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/tippen", label: "Tippen", emoji: "⚽" },
  { href: "/uebersicht", label: "Übersicht", emoji: "📋" },
  { href: "/rangliste", label: "Rangliste", emoji: "🏆" },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="wm-bottomnav">
      {TABS.map(({ href, label, emoji }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "wm-bottomnav__item",
              active && "wm-bottomnav__item--active"
            )}
          >
            <span className="wm-bottomnav__emoji" aria-hidden="true">{emoji}</span>
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
