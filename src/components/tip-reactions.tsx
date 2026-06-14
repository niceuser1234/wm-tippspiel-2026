"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export const REACTION_EMOJIS = ["😂", "🔥", "👀", "😱", "👏"] as const;

export interface ReactionItem {
  emoji: string;
  user_id: string;
  display_name: string;
}

interface TipReactionsProps {
  matchTipId: string;
  viewerId: string;
  initial: ReactionItem[];
}

export function TipReactions({ matchTipId, viewerId, initial }: TipReactionsProps) {
  const router = useRouter();
  const [items, setItems] = useState<ReactionItem[]>(initial);
  const [busy, setBusy] = useState(false);

  async function toggle(emoji: string) {
    if (busy) return;
    setBusy(true);
    const supabase = createClient();
    const mine = items.find((r) => r.emoji === emoji && r.user_id === viewerId);

    // optimistisch
    setItems((prev) =>
      mine
        ? prev.filter((r) => !(r.emoji === emoji && r.user_id === viewerId))
        : [...prev, { emoji, user_id: viewerId, display_name: "Du" }]
    );

    const { error } = mine
      ? await supabase.from("tip_reactions").delete()
          .eq("match_tip_id", matchTipId).eq("user_id", viewerId).eq("emoji", emoji)
      : await supabase.from("tip_reactions")
          .insert({ match_tip_id: matchTipId, user_id: viewerId, emoji });

    setBusy(false);
    if (error) {
      setItems(initial); // revert
      toast.error("Hat nicht geklappt.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {REACTION_EMOJIS.map((emoji) => {
        const forEmoji = items.filter((r) => r.emoji === emoji);
        const count = forEmoji.length;
        const mine = forEmoji.some((r) => r.user_id === viewerId);
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => toggle(emoji)}
            disabled={busy}
            title={forEmoji.map((r) => r.display_name).join(", ") || "Reagieren"}
            className={[
              "text-sm rounded-full border px-2 py-0.5 transition-colors disabled:opacity-50",
              mine ? "bg-amber-50 border-amber-300" : "bg-slate-50 border-slate-200 hover:border-slate-300",
            ].join(" ")}
          >
            <span>{emoji}</span>
            {count > 0 && <span className="ml-1 text-xs tabular-nums text-muted-foreground">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
