"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/avatar";
import { toast } from "sonner";

export interface CommentItem {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  display_name: string;
  avatar_url: string | null;
}

const MAX = 200;

interface TipCommentsProps {
  matchTipId: string;
  viewerId: string;
  initial: CommentItem[];
}

export function TipComments({ matchTipId, viewerId, initial }: TipCommentsProps) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("tip_comments")
      .insert({ match_tip_id: matchTipId, author_id: viewerId, body });
    setBusy(false);
    if (error) { toast.error("Kommentar konnte nicht gespeichert werden."); return; }
    setText("");
    router.refresh();
  }

  async function remove(id: string) {
    if (busy) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("tip_comments").delete().eq("id", id);
    setBusy(false);
    if (error) { toast.error("Löschen fehlgeschlagen."); return; }
    router.refresh();
  }

  return (
    <div className="mt-2 space-y-2">
      {initial.map((c) => (
        <div key={c.id} className="flex items-start gap-2 text-sm">
          <Avatar name={c.display_name} url={c.avatar_url} size={22} />
          <div className="flex-1">
            <span className="font-medium text-night">{c.author_id === viewerId ? "Du" : c.display_name}</span>{" "}
            <span className="text-slate-600">{c.body}</span>
          </div>
          {c.author_id === viewerId && (
            <button type="button" onClick={() => remove(c.id)} disabled={busy}
              className="text-xs text-muted-foreground hover:text-destructive" title="Löschen">✕</button>
          )}
        </div>
      ))}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={text}
          maxLength={MAX}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder="Kommentieren…"
          className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm focus:outline-none focus:border-slate-300"
        />
        <button type="button" onClick={submit} disabled={busy || !text.trim()}
          className="text-sm font-medium text-[#15803d] disabled:opacity-40">Senden</button>
      </div>
    </div>
  );
}
