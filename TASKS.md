# TASKS.md — Build-Plan WM 2026 Tippspiel

Atomare Tasks, gruppiert in Waves. Tasks innerhalb einer Wave laufen parallel (verschiedene Agenten), Waves sequenziell. Jeder Agent liest zuerst README.md + DECISIONS.md. **Agenten committen nicht** — Git-Operationen macht der Orchestrator zwischen den Waves.

Format pro Task: **ID · Wave · Agent · Depends · Deliverables · Spec · Acceptance**

---

## Wave 1 — Fundament (parallel)

### T1 — Next.js-Scaffold + Design-Fundament
- **Agent:** sonnet · **Depends:** —
- **Deliverables:** komplettes Next.js-Projekt im Root (package.json, src/, globals.css mit Design-Tokens, shadcn/ui-Komponenten, `.env.example`, `src/lib/teams.ts`, `src/types/database.ts`)
- **Spec:** create-next-app in Temp-Verzeichnis (Root ist nicht leer!), Dateien in Root mergen, nichts Bestehendes löschen. Tailwind-v4-Tokens aus DECISIONS §5. shadcn init + genau die 8 gelisteten Komponenten. `teams.ts`: alle 42 qualifizierten + plausible Teams mit Flaggen-Emoji. `database.ts`: handgeschriebene Typen für alle 5 Tabellen + leaderboard-View (DECISIONS §4).
- **Acceptance:** `npx tsc --noEmit` und `npm run build` grün. README/DECISIONS/TASKS unangetastet.

### T2 — Supabase SQL-Paket (Schema + RLS + View) + Seed-Daten
- **Agent:** sonnet · **Depends:** —
- **Deliverables:** `supabase/migrations/0001_schema.sql`, `0002_rls.sql`, `0003_leaderboard_view.sql`, `seed/matches.ts`, `seed/special-bets.ts`, `scripts/seed.ts`
- **Spec:** Schema nach README-Datenmodell + G4 (stage-CHECK inkl. r32/third_place). RLS: alle 6 README-Policies **plus** UPDATE-Policies (G2) **plus** profiles-Policies + Signup-Trigger (G3). View exakt nach DECISIONS §4 (CTEs, security_invoker, exact_count, alle drei bet_type-Fälle). Seeds nach DECISIONS §6 — echte Anstoßzeiten per WebSearch aus offiziellem FIFA-Spielplan recherchieren.
- **Acceptance:** SQL syntaktisch valide (lokal via `supabase db start` testen falls Docker verfügbar, sonst sorgfältiges Review + Begründung). Seed-Skript typcheckt. Schreibt **nur** in supabase/, seed/, scripts/.

---

## Wave 2 — Auth + Datenzugriff

### T3 — Supabase-Clients, Middleware, Auth-Flow, Onboarding
- **Agent:** sonnet · **Depends:** T1, T2
- **Deliverables:** `src/lib/supabase/{client,server,middleware}.ts`, `src/middleware.ts`, `src/app/page.tsx` (Login), `src/app/auth/confirm/route.ts`, `src/app/willkommen/page.tsx`, Root-Layout-Anpassung
- **Spec:** @supabase/ssr-Pattern nach DECISIONS §2+§3. Login-Page: ein E-Mail-Feld, Magic-Link, „Mail ist raus 📬"-Zustand. Middleware: Session-Refresh + Redirect-Matrix aus §3. Onboarding-Redirect bei leerem display_name.
- **Acceptance:** Build grün. Redirect-Matrix vollständig (4 Fälle). Kein Service-Role-Key irgendwo in src/.

---

## Wave 3 — Die drei Views (parallel)

### T4 — /tippen (Kern der App)
- **Agent:** sonnet · **Depends:** T3
- **Deliverables:** `src/app/tippen/page.tsx`, `src/components/match-tip-card.tsx`, `src/components/special-bet-card.tsx`
- **Spec:** Server Component lädt offene Spiele (`kickoff_at > now()`) + eigene Tipps + offene Sonderwetten (`lock_at > now()`) + eigene Antworten. Client-Cards: −/+-Stepper (DECISIONS §5), Upsert mit `onConflict`, Sonner-Toast, RLS-Fehler „Spiel ist gestartet" abfangen. Sonderwetten-Formulare je bet_type (team→Select, number→Input, two_teams→2 Selects als JSON-Array, round→Select, text→Select+Freitext). Countdown-Badge „schließt in 2h".
- **Acceptance:** Build grün. Bereits getippte Spiele zeigen gespeicherten Tipp (änderbar bis Anpfiff). Leere-Zustände gestaltet.

### T5 — /uebersicht (Reveal)
- **Agent:** sonnet · **Depends:** T3
- **Deliverables:** `src/app/uebersicht/page.tsx`, `src/components/match-reveal-card.tsx`, `src/lib/scoring.ts`
- **Spec:** Server Component, alle Spiele chronologisch, gruppiert nach Status (Live/beendet ↔ anstehend). Vor Anpfiff: „🔒 verdeckt" + eigener Tipp. Nach Anpfiff: Tipp-Grid aller Teilnehmer (Namen via profiles-Join). Mit Ergebnis: Punkte-Badge pro Tipp via `scoring.ts` (+4 gold / +3 / +2 grün / 0 grau). Sonderwetten-Sektion analog nach lock_at.
- **Acceptance:** Build grün. Keine Client-Logik fürs Verstecken — rendert nur, was RLS liefert (Kommentar im Code, der das festhält).

### T6 — /rangliste
- **Agent:** haiku · **Depends:** T3
- **Deliverables:** `src/app/rangliste/page.tsx`, `src/components/leaderboard-table.tsx`
- **Spec:** Server Component liest `leaderboard`-View. 🥇🥈🥉, geteilte Ränge bei Punktgleichheit (Tiebreaker exact_count, G8), eigene Zeile hervorgehoben, paid-Häkchen, Spalten Spieltipp-/Sonderwetten-/Gesamtpunkte. Mobile: Tabelle bleibt ohne Scroll lesbar (Spalten ggf. zusammenfassen).
- **Acceptance:** Build grün. Sortierung kommt aus der View, nicht aus JS.

---

## Wave 4 — Polish + Ship

### T7 — Polish-Pass
- **Agent:** sonnet · **Depends:** T4, T5, T6
- **Spec:** Konsistenz-Review aller Views gegen DECISIONS §5: Abstände, Leere-Zustände, Loading-Skeletons, Bottom-Nav-Active-States, Mobile-Viewport 375px, Flaggen überall, Metadata/Favicon/OG-Titel („WM 2026 Tippspiel ⚽").
- **Acceptance:** Build grün; Screenshot-Review durch Orchestrator.

### T8 — Deploy (orchestrator-geführt, braucht Menschen-Input)
- **Agent:** Orchestrator + Mensch · **Depends:** T7 + manuelle Schritte aus DECISIONS §7
- **Spec:** Migrationen pushen, Seed laufen lassen, Vercel-Deploy, Smoke-Test-Checkliste aus DECISIONS §7 abarbeiten.

---

## Abhängigkeitsgraph

```
T1 ─┬─► T3 ─┬─► T4 ─┐
T2 ─┘       ├─► T5 ─┼─► T7 ─► T8
            └─► T6 ─┘
```

## Blocker, die nur der Mensch lösen kann (früh erledigen!)

1. Supabase-Projekt anlegen → URL, Anon-Key, Service-Role-Key bereitstellen
2. Resend-SMTP in Supabase konfigurieren (G10 — sonst Login-Stau am 11.6.)
3. GitHub-Repo + Vercel-Projekt verbinden
