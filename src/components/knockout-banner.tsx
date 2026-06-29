"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

const DISMISS_KEY = "ko-bets-dismissed";

/**
 * Top-right news card: "new knockout bets are open". Dismiss is stored per
 * device in localStorage, keyed by the current round signature. When a new
 * knockout round opens the signature changes and the banner returns once.
 * Renders nothing on the server (no hydration mismatch) and when there are no
 * open knockout matches (empty signature).
 */
export function KnockoutBanner({ signature }: { signature: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!signature) {
      setShow(false);
      return;
    }
    setShow(localStorage.getItem(DISMISS_KEY) !== signature);
  }, [signature]);

  if (!show) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, signature);
    setShow(false);
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-xs">
      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
        <Link
          href="/tippen"
          onClick={dismiss}
          className="text-sm font-medium leading-snug text-night"
        >
          🏆 Neu: K.-o.-Wetten sind offen. Jetzt tippen!
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Schließen"
          className="shrink-0 text-slate-400 transition-colors hover:text-night"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
