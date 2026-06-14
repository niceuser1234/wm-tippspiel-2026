"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadAvatar } from "@/lib/avatar-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MAX_LEN = 30;

export default function WillkommenPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("Bitte wähle eine Bilddatei.");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError("Bild ist zu groß (max. 10 MB).");
      return;
    }
    setError(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();

    if (!trimmed) {
      setError("Bitte gib einen Namen ein.");
      return;
    }
    if (trimmed.length > MAX_LEN) {
      setError(`Maximal ${MAX_LEN} Zeichen erlaubt.`);
      return;
    }
    if (!file) {
      setError("Bitte lade ein Profilbild hoch.");
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Sitzung abgelaufen — bitte neu einloggen.");
      setLoading(false);
      return;
    }

    try {
      // 1. Bild verkleinern + hochladen
      let publicUrl: string;
      try {
        publicUrl = await uploadAvatar(supabase, user.id, file);
      } catch {
        setError("Bild-Upload fehlgeschlagen. Versuch's nochmal.");
        setLoading(false);
        return;
      }

      // 2. Profil aktualisieren (Name + Bild-URL)
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ display_name: trimmed, avatar_url: publicUrl })
        .eq("id", user.id);

      if (updateError) {
        setError("Konnte nicht gespeichert werden. Versuch's nochmal.");
        setLoading(false);
        return;
      }

      router.push("/tippen");
      router.refresh();
    } catch {
      setError("Etwas ist schiefgelaufen. Versuch's nochmal.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <p className="text-4xl">👋</p>
          <h1 className="display-heading text-2xl text-night">Willkommen!</h1>
          <p className="text-muted-foreground text-sm">
            Einen kurzen Moment noch — dann kann&apos;s losgehen.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Dein Profil</CardTitle>
            <CardDescription>
              Name &amp; Bild sehen alle in Rangliste und Übersicht.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Profilbild */}
              <div className="flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="relative h-24 w-24 rounded-full border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden hover:border-[#15803d] transition-colors"
                  aria-label="Profilbild auswählen"
                >
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={preview}
                      alt="Vorschau"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl">📷</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="text-sm font-medium text-[#15803d] underline underline-offset-4"
                >
                  {preview ? "Anderes Bild wählen" : "Profilbild hochladen"}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="displayName">
                  Wie sollen dich die anderen nennen?
                </Label>
                <Input
                  id="displayName"
                  type="text"
                  placeholder="z.B. Lisa, MüllersKlaus, ⚽-König"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={MAX_LEN}
                  required
                />
                <p className="text-xs text-muted-foreground text-right">
                  {name.length}/{MAX_LEN}
                </p>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button
                type="submit"
                className="w-full"
                disabled={loading || !name.trim() || !file}
              >
                {loading ? "Wird gespeichert…" : "Los geht's"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
