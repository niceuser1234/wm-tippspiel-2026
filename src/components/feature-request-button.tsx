"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const MAX = 1000;

export function FeatureRequestButton({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("feature_requests").insert({ user_id: userId, body });
    setBusy(false);
    if (error) { toast.error("Konnte nicht gesendet werden."); return; }
    setText("");
    setOpen(false);
    toast.success("Danke, ist angekommen! 🙌");
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="w-full rounded-2xl border border-slate-200 bg-white shadow-sm px-4 py-3 text-sm font-medium text-night hover:bg-slate-50 transition-colors">
        💡 Feature vorschlagen
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-4 py-4 space-y-3">
      <p className="text-sm font-medium text-night">Was würdest du dir wünschen?</p>
      <textarea
        value={text}
        maxLength={MAX}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="z.B. Erinnerung vorm Anpfiff, dark mode…"
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:border-slate-300"
      />
      <div className="flex gap-2">
        <Button onClick={submit} disabled={busy || !text.trim()} className="flex-1">
          {busy ? "Senden…" : "Absenden"}
        </Button>
        <Button variant="outline" onClick={() => { setOpen(false); setText(""); }} disabled={busy}>
          Abbrechen
        </Button>
      </div>
    </div>
  );
}
