"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MAX_LEN = 30;

export default function WillkommenPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ display_name: trimmed })
      .eq("id", user.id);

    if (updateError) {
      setError("Konnte nicht gespeichert werden. Versuch's nochmal.");
      setLoading(false);
      return;
    }

    router.push("/tippen");
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
            <CardTitle>Dein Anzeigename</CardTitle>
            <CardDescription>
              So sehen dich die anderen in der Rangliste.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                  autoFocus
                />
                <p className="text-xs text-muted-foreground text-right">
                  {name.length}/{MAX_LEN}
                </p>
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={loading || !name.trim()}
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
