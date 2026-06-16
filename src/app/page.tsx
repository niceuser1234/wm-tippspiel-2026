"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Öffentlicher hCaptcha-Sitekey — darf im Client stehen. Der Secret-Key liegt nur in Supabase.
const HCAPTCHA_SITEKEY = "d7889e3a-cb08-461c-8f74-d9d0bf2623e8";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const expiredLink = searchParams.get("error") === "auth";

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const captchaRef = useRef<HCaptcha>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  // Mobile-Autoplay des Hintergrundvideos erzwingen (siehe Kommentar unten).
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
    setError(null);
    setInfo(null);

    const mail = email.trim();
    if (!mail || !password) {
      setError("Bitte E-Mail und Passwort eingeben.");
      return;
    }
    if (mode === "register" && password.length < 8) {
      setError("Das Passwort braucht mindestens 8 Zeichen.");
      return;
    }
    if (!captchaToken) {
      setError("Bitte bestätige kurz, dass du kein Bot bist.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    if (mode === "register") {
      const { data, error: authError } = await supabase.auth.signUp({
        email: mail,
        password,
        options: {
          captchaToken,
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=/tippen`,
        },
      });
      captchaRef.current?.resetCaptcha();
      setCaptchaToken(null);
      if (authError) {
        if (authError.message.toLowerCase().includes("already registered")) {
          setError("Diese E-Mail ist schon registriert — bitte einloggen.");
          setMode("login");
        } else {
          setError("Registrierung fehlgeschlagen. Versuch's nochmal.");
        }
        setLoading(false);
        return;
      }
      // E-Mail-Bestätigung aktiv: bis der Link geklickt ist, gibt es keine Session.
      if (!data.session) {
        setInfo(
          "Fast geschafft! Wir haben dir eine Bestätigungs-Mail geschickt. Klick den Link darin, dann bist du dabei."
        );
        setLoading(false);
        return;
      }
    } else {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: mail,
        password,
        options: { captchaToken },
      });
      captchaRef.current?.resetCaptcha();
      setCaptchaToken(null);
      if (authError) {
        setError("E-Mail oder Passwort ist falsch.");
        setLoading(false);
        return;
      }
    }

    router.push("/tippen");
    router.refresh();
  }

  async function handleForgot() {
    const mail = email.trim();
    if (!mail) {
      setError("Bitte gib zuerst deine E-Mail oben ein.");
      return;
    }
    if (!captchaToken) {
      setError("Bitte löse zuerst kurz das Captcha unten.");
      return;
    }
    setError(null);
    setInfo(null);
    setLoading(true);
    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(mail, {
      captchaToken,
      redirectTo: `${window.location.origin}/auth/confirm?next=/passwort-neu`,
    });
    captchaRef.current?.resetCaptcha();
    setCaptchaToken(null);
    setLoading(false);
    if (resetError) {
      setError("Reset-Mail konnte nicht gesendet werden.");
      return;
    }
    setInfo("Wir haben dir eine E-Mail zum Zurücksetzen geschickt.");
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden">
      {/* Hintergrund-Video — nur Login. z-0 (nicht negativ), sonst verdeckt der
          body-Hintergrund das Video. muted/playsinline für Mobile-Autoplay. */}
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

      <div className="fixed left-0 top-0 z-0 h-[100dvh] w-[100vw] bg-black/30 backdrop-blur-[3px]" />

      <div className="relative z-10 w-full max-w-sm space-y-8">
        {/* Hero */}
        <div className="text-center space-y-2">
          <h1 className="display-heading text-5xl display-gradient">WM 2026</h1>
          <h2 className="display-heading text-2xl text-white drop-shadow-sm">
            ⚽ Tippspiel
          </h2>
          <p className="text-white/85 text-base mt-3 drop-shadow-sm">
            Tippen. Zittern. Topf gewinnen.
          </p>
        </div>

        {expiredLink && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive text-center">
            <p>Etwas hat nicht geklappt — bitte logge dich neu ein.</p>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-center">
              {mode === "login" ? "Einloggen" : "Account erstellen"}
            </CardTitle>
            <CardDescription className="text-center">
              {mode === "login"
                ? "Mit E-Mail und Passwort anmelden."
                : "Einmal registrieren — danach bleibst du eingeloggt."}
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Passwort</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={mode === "register" ? "mind. 8 Zeichen" : "••••••••"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  minLength={8}
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
              {info && <p className="text-sm text-[#15803d] font-medium">{info}</p>}

              <div className="flex justify-center">
                <HCaptcha
                  ref={captchaRef}
                  sitekey={HCAPTCHA_SITEKEY}
                  onVerify={(token) => setCaptchaToken(token)}
                  onExpire={() => setCaptchaToken(null)}
                  onError={() => setCaptchaToken(null)}
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-primary text-primary-foreground"
                disabled={loading || !email || !password || !captchaToken}
              >
                {loading
                  ? "Einen Moment…"
                  : mode === "login"
                  ? "Einloggen"
                  : "Account erstellen"}
              </Button>
            </form>

            {/* Login ↔ Registrieren wechseln */}
            <div className="mt-4 text-center text-sm">
              {mode === "login" ? (
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setError(null);
                    setInfo(null);
                  }}
                  className="text-muted-foreground"
                >
                  Noch kein Account?{" "}
                  <span className="text-primary font-semibold underline underline-offset-4">
                    Registrieren
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError(null);
                    setInfo(null);
                  }}
                  className="text-muted-foreground"
                >
                  Schon dabei?{" "}
                  <span className="text-primary font-semibold underline underline-offset-4">
                    Einloggen
                  </span>
                </button>
              )}
            </div>

            {mode === "login" && (
              <div className="mt-2 text-center">
                <button
                  type="button"
                  onClick={handleForgot}
                  disabled={loading}
                  className="text-xs text-muted-foreground underline underline-offset-4"
                >
                  Passwort vergessen?
                </button>
              </div>
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
