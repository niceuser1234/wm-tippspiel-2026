"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Suspense } from "react";

function LoginForm() {
  const searchParams = useSearchParams();
  const expiredLink = searchParams.get("error") === "auth";

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });

    if (authError) {
      setError("Etwas hat nicht geklappt. Versuch's nochmal.");
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Hero */}
        <div className="text-center space-y-2">
          <h1 className="display-heading text-4xl text-primary">
            ⚽ WM 2026
          </h1>
          <h2 className="display-heading text-2xl text-night">
            Tippspiel
          </h2>
          <p className="text-muted-foreground text-base mt-3">
            Tippen. Zittern. Topf gewinnen.
          </p>
        </div>

        {/* Abgelaufener Link Hinweis */}
        {expiredLink && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive text-center">
            Link abgelaufen — fordere einen neuen an.
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-center">Einloggen</CardTitle>
            <CardDescription className="text-center">
              Wir schicken dir einen Magic Link per E-Mail.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="text-center space-y-2 py-4">
                <p className="text-2xl">📬</p>
                <p className="font-semibold text-foreground">Check dein Postfach!</p>
                <p className="text-sm text-muted-foreground">
                  Wir haben dir einen Link an <strong>{email}</strong> geschickt.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-Mail-Adresse</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="deine@email.de"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    autoFocus
                  />
                </div>

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}

                <Button
                  type="submit"
                  className="w-full bg-primary text-primary-foreground"
                  disabled={loading || !email}
                >
                  {loading ? "Wird gesendet…" : "Magic Link senden"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Privates Tippspiel · ~20 Teilnehmer · kein echtes Wetten
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
