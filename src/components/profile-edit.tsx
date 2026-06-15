"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadAvatar } from "@/lib/avatar-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const MAX_LEN = 30;

interface ProfileEditProps {
  userId: string;
  initialName: string;
}

export function ProfileEdit({ userId, initialName }: ProfileEditProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) { toast.error("Name darf nicht leer sein."); return; }
    if (trimmed.length > MAX_LEN) { toast.error(`Maximal ${MAX_LEN} Zeichen.`); return; }

    setBusy(true);
    const supabase = createClient();
    try {
      const update: { display_name: string; avatar_url?: string } = { display_name: trimmed };
      if (file) update.avatar_url = await uploadAvatar(supabase, userId, file);

      const { error } = await supabase.from("profiles").update(update).eq("id", userId);
      if (error) throw new Error();
      toast.success("Profil aktualisiert.");
      setOpen(false);
      setFile(null);
      router.refresh();
    } catch {
      toast.error("Konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="w-full rounded-2xl border border-slate-200 bg-white shadow-sm px-4 py-3 text-sm font-medium text-night hover:bg-slate-50 transition-colors">
        ✏️ Profil bearbeiten
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-4 py-4 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="edit-name">Anzeigename</Label>
        <Input id="edit-name" value={name} maxLength={MAX_LEN}
          onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Profilbild</Label>
        <input ref={fileRef} type="file" accept="image/*" className="block text-sm"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        {file && <p className="text-xs text-muted-foreground">{file.name} wird beim Speichern hochgeladen.</p>}
      </div>
      <div className="flex gap-2">
        <Button onClick={save} disabled={busy} className="flex-1">
          {busy ? "Speichern…" : "Speichern"}
        </Button>
        <Button variant="outline" onClick={() => { setOpen(false); setFile(null); setName(initialName); }} disabled={busy}>
          Abbrechen
        </Button>
      </div>
    </div>
  );
}
