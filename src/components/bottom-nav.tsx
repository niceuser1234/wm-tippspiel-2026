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
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t bg-card/95 backdrop-blur-sm">
      <ul className="flex h-16 items-stretch">
        {TABS.map(({ href, label, emoji }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <li key={href} className="flex flex-1">
              <Link
                href={href}
                className={cn(
                  "relative flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="text-xl leading-none">{emoji}</span>
                <span>{label}</span>
                {active && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-10 rounded-t-full bg-primary" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
