"use client";

import { useState, useRef, useEffect } from "react";
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
  const errorDetail = searchParams.get("detail");

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mobile-Autoplay erzwingen: React setzt das `muted`-Property nicht zuverlässig,
  // ohne echtes Muting blockieren iOS/Android das Autoplay. Property hart setzen
  // + play() aktiv aufrufen, mit Fallback bei erster Interaktion / Sichtbarkeit.
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    v.muted = true;
    v.defaultMuted = true;
    v.setAttribute("muted", "");
    v.setAttribute("playsinline", "true");
    v.setAttribute("webkit-playsinline", "true");

    const tryPlay = () => {
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    };
    tryPlay();

    const onVisible = () => {
      if (document.visibilityState === "visible") tryPlay();
    };
    const onInteract = () => tryPlay();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("touchstart", onInteract, { once: true, passive: true });
    window.addEventListener("pointerdown", onInteract, { once: true });

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("touchstart", onInteract);
      window.removeEventListener("pointerdown", onInteract);
    };
  }, []);

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
    <div className="relative min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden">
      {/* Hintergrund-Video — nur auf der Login-Page. z-0 (nicht negativ),
          sonst verdeckt der body-Hintergrund das Video. */}
      <video
        ref={videoRef}
        className="fixed left-0 top-0 z-0 h-[100dvh] w-[100vw] object-cover"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
      >
        <source src="/flags-loop.mp4" type="video/mp4" />
      </video>

      {/* Abdunkelndes Milchglas-Overlay: über Video, unter Login-Box */}
      <div className="fixed left-0 top-0 z-0 h-[100dvh] w-[100vw] bg-black/30 backdrop-blur-[3px]" />

      <div className="relative z-10 w-full max-w-sm space-y-8">
        {/* Hero */}
        <div className="text-center space-y-2">
          <h1 className="display-heading text-5xl display-gradient">
            WM 2026
          </h1>
          <h2 className="display-heading text-2xl text-white drop-shadow-sm">
            ⚽ Tippspiel
          </h2>
          <p className="text-white/85 text-base mt-3 drop-shadow-sm">
            Tippen. Zittern. Topf gewinnen.
          </p>
        </div>

        {/* Abgelaufener Link Hinweis */}
        {expiredLink && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive text-center space-y-1">
            <p>Link abgelaufen — fordere einen neuen an.</p>
            {errorDetail && (
              <p className="text-xs opacity-70 break-all">{errorDetail}</p>
            )}
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

        <p className="text-center text-xs text-white/75 drop-shadow-sm">
          Tippspiel Haberstroh &amp; Friends
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
