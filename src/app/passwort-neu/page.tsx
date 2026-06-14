"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function PasswortNeuPage() {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (pw.length < 8) {
      setError("Das Passwort braucht mindestens 8 Zeichen.");
      return;
    }
    if (pw !== pw2) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);

    if (updateError) {
      setError(
        "Konnte nicht gesetzt werden. Fordere den Link evtl. neu an."
      );
      return;
    }

    router.push("/tippen");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <p className="text-4xl">🔑</p>
          <h1 className="display-heading text-2xl text-night">Neues Passwort</h1>
          <p className="text-muted-foreground text-sm">
            Wähle ein neues Passwort für deinen Account.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Passwort zurücksetzen</CardTitle>
            <CardDescription>Mindestens 8 Zeichen.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pw">Neues Passwort</Label>
                <Input
                  id="pw"
                  type="password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw2">Passwort wiederholen</Label>
                <Input
                  id="pw2"
                  type="password"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button
                type="submit"
                className="w-full"
                disabled={loading || !pw || !pw2}
              >
                {loading ? "Wird gespeichert…" : "Passwort speichern"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
