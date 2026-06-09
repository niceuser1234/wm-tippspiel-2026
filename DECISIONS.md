# DECISIONS.md — WM 2026 Tippspiel

Architektur-Entscheidungen. Bindend für alle Implementierungs-Tasks. Bei Konflikt mit README.md gilt dieses Dokument (Korrekturen sind markiert).

---

## 0. Gap-Auflösungen (README-Lücken, hier entschieden)

| # | Lücke | Entscheidung |
|---|---|---|
| G1 | „Server-Client bypasses RLS" (Prompt-Annahme) | **Falsch.** Server-Client mit Anon-Key + User-Session-Cookies respektiert RLS. Die App verwendet **niemals** den Service-Role-Key (nur das lokale Seed-Skript). RLS ist die einzige Sicherheitsgrenze — Server- und Client-Komponenten sind gleichermaßen sicher. |
| G2 | UPDATE-Policies fehlen im README | Explizite `FOR UPDATE`-Policies (USING + WITH CHECK) mit denselben Bedingungen wie INSERT. Tipps sind bis Anpfiff/lock_at änderbar. |
| G3 | profiles ohne RLS + kein Anlage-Mechanismus | SELECT für alle eingeloggten User (Namen in Rangliste nötig), UPDATE nur eigene Zeile und nur `display_name`. Anlage per `SECURITY DEFINER`-Trigger auf `auth.users` INSERT. |
| G4 | `stage`-Enum ohne Sechzehntelfinale | CHECK-Constraint: `'group','r32','r16','qf','sf','third_place','final'`. Wette #5 Optionen enthalten „Sechzehntelfinale". |
| G5 | Wette #3: Gleichstand bei „nächste Schätzung" | Alle gleich nahen Tipps erhalten die vollen 8 Punkte. |
| G6 | Wette #4: Speicherformat zwei Teams | `answer` = JSON-Array-String `["Frankreich","Argentinien"]`. Reihenfolge irrelevant (Set-Vergleich). `correct_answer` gleiches Format. 4 Punkte pro Treffer. |
| G7 | Wette #2 Torschützenkönig: Freitext-Chaos („Kane" vs. „Harry Kane") | Dropdown mit ~24 kuratierten Kandidaten + Freitext-Fallback. Admin normalisiert abweichende Antworten manuell im Dashboard (bei ≤20 Leuten trivial). |
| G8 | Punktgleichstand Endstand | Tiebreaker: Anzahl exakter Tipps (`exact_count`, in der View enthalten). Danach Topf-Teilung. App zeigt geteilte Ränge. |
| G9 | Blind-Bet-Leak über leaderboard-View | Hausregel: `correct_answer` der Blind Bet erst am 19.7. eintragen. (Blind Bet ist ohnehin optional/v2.) |
| G10 | Supabase Built-in-SMTP: ~2–4 Mails/Stunde | **Deploy-Blocker für 20 User.** Custom SMTP via Resend (Free Tier, 100 Mails/Tag) im Supabase Dashboard konfigurieren. Pflicht vor dem 11.6. |

---

## 1. Project Scaffold

**App Router.** Begründung: Server Components für die lese-lastigen Views (Rangliste, Übersicht) = weniger Client-JS, schnellere Mobile-Loads; @supabase/ssr-Doku und alle aktuellen Patterns zielen auf App Router; Pages Router ist Legacy.

Scaffold-Kommando (in temporärem Verzeichnis erzeugen, dann in Projekt-Root mergen — Root enthält bereits README.md etc.):

```bash
npx create-next-app@latest wm-tippspiel --typescript --tailwind --app --src-dir --import-alias "@/*" --eslint --no-turbopack
```

Tailwind v4 (kommt mit aktuellem create-next-app): Design-Tokens via `@theme` in `globals.css`, kein separates `tailwind.config.ts` nötig.

**Env-Vars:** `.env.local` (gitignored) + committetes `.env.example`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
# Nur für scripts/seed.ts, niemals in der App importieren:
SUPABASE_SERVICE_ROLE_KEY=
```

**Ordnerstruktur:**

```
/
├── README.md, DECISIONS.md, TASKS.md
├── .env.example
├── supabase/
│   └── migrations/
│       ├── 0001_schema.sql
│       ├── 0002_rls.sql
│       └── 0003_leaderboard_view.sql
├── scripts/
│   └── seed.ts                  # tsx, nutzt Service-Role-Key
├── seed/
│   ├── matches.ts               # 12 kuratierte Gruppenspiele
│   └── special-bets.ts          # 7 Sonderwetten
└── src/
    ├── middleware.ts            # Session-Refresh + Auth-Guard
    ├── app/
    │   ├── layout.tsx           # Root: Fonts, BottomNav
    │   ├── page.tsx             # Login (Magic Link)
    │   ├── auth/confirm/route.ts# OTP-Verify (Magic-Link-Callback)
    │   ├── willkommen/page.tsx  # display_name-Onboarding
    │   ├── tippen/page.tsx
    │   ├── uebersicht/page.tsx
    │   └── rangliste/page.tsx
    ├── components/
    │   ├── ui/                  # shadcn/ui
    │   ├── bottom-nav.tsx
    │   ├── match-tip-card.tsx   # Client Component (Formular)
    │   ├── special-bet-card.tsx # Client Component (Formular)
    │   ├── match-reveal-card.tsx# Server-renderbar (Übersicht)
    │   └── leaderboard-table.tsx
    ├── lib/
    │   ├── supabase/
    │   │   ├── client.ts        # Browser-Client
    │   │   ├── server.ts        # Server-Client (cookies)
    │   │   └── middleware.ts    # updateSession-Helper
    │   ├── scoring.ts           # 4/3/2/0-Logik fürs UI-Display (Anzeige pro Tipp)
    │   └── teams.ts             # Teamliste + Flaggen-Emoji-Map
    └── types/
        └── database.ts          # Handgeschriebene DB-Typen (kein supabase gen nötig)
```

---

## 2. Supabase-Integrationsmuster

**Paket: `@supabase/ssr`** (auth-helpers sind deprecated).

| Kontext | Client | Verwendung |
|---|---|---|
| Server Components / Route Handlers | `createServerClient` (Anon-Key + Cookie-Store) | `/rangliste`, `/uebersicht`, Datenladen für `/tippen` |
| Client Components | `createBrowserClient` (Anon-Key) | Tipp-Formulare (Insert/Upsert), Login-Form |
| Middleware | `createServerClient` (Request/Response-Cookies) | Session-Refresh, Auth-Redirect |
| `scripts/seed.ts` (lokal) | `createClient` mit Service-Role-Key | Seeding. Einziger Ort mit Service-Role. |

**Warum dieser Split:** Beide App-Clients tragen die User-Session → RLS gilt überall identisch (siehe G1). Der Split ist eine **Performance/UX-Entscheidung**, keine Sicherheitsentscheidung: Server Components für alles Lese-lastige (kein Client-Bundle, kein Spinner auf der Rangliste), Client Components nur wo Interaktion stattfindet (Score-Stepper, Submit mit Optimistic-Toast). Die Reveal-Logik braucht **null Frontend-Code** — ein simples `select *` auf `match_tips` liefert vor Anpfiff nur die eigene Zeile, danach alle. Das Frontend rendert einfach, was kommt.

Schreibzugriffe (Tipps) laufen als `upsert` mit `onConflict: 'user_id,match_id'` direkt aus der Client Component — keine Server Actions nötig, RLS validiert (eigener User + vor Deadline). Fehlerfall „Deadline gerade verpasst" → RLS-Fehler abfangen, Toast „Spiel ist gestartet".

---

## 3. Auth-Flow

1. `/` zeigt E-Mail-Feld → `supabase.auth.signInWithOtp({ email, emailRedirectTo: <origin>/auth/confirm })`. Kein Passwort, keine Registrierung — Magic Link ist beides.
2. `/auth/confirm/route.ts`: verifiziert `token_hash` via `supabase.auth.verifyOtp()`, setzt Session-Cookies, redirect → `/tippen`.
3. `src/middleware.ts`: refresht Session bei jedem Request (`updateSession`-Pattern aus @supabase/ssr-Doku). Nicht eingeloggt + geschützte Route (`/tippen`, `/uebersicht`, `/rangliste`, `/willkommen`) → redirect `/`. Eingeloggt auf `/` → redirect `/tippen`.
4. **Onboarding:** DB-Trigger legt bei Signup `profiles`-Zeile mit `display_name = ''` an. Layout der geschützten Routen prüft: `display_name = ''` → redirect `/willkommen` (ein Feld, ein Button, Update auf eigene Zeile, weiter zu `/tippen`).
5. **Zugangskontrolle:** Magic Link erlaubt technisch jedem Login. Bei privatem Link-Sharing in der WhatsApp-Gruppe akzeptables Risiko. Härtung (optional, 5 Min): Supabase Dashboard → Auth → „Disable Sign-ups" nachdem alle ~20 Teilnehmer einmal drin sind.
6. **SMTP:** Resend als Custom-SMTP konfigurieren (G10) — sonst Login-Stau am 11.6.

---

## 4. Scoring-Implementierung

Punkte leben zu 100 % in der `leaderboard`-View (SQL). Frontend liest nur. `src/lib/scoring.ts` dupliziert die 4/3/2/0-Logik ausschließlich für die **Anzeige pro Einzeltipp** in der Übersicht (Badge „+3").

View-Struktur: CTEs statt verschachtelter Subqueries. `WITH security_invoker = true` (Supabase-Empfehlung; funktioniert, weil nur aufgelöste Spiele/Wetten aggregiert werden — deren Reveal-Bedingungen sind dann ohnehin erfüllt).

**Spieltipps** (wie README, plus `exact_count` für Tiebreaker G8):

```sql
match_pts AS (
  SELECT mt.user_id,
    SUM(CASE
      WHEN mt.home_tip = m.home_score AND mt.away_tip = m.away_score THEN 4
      WHEN (mt.home_tip - mt.away_tip) = (m.home_score - m.away_score) THEN 3
      WHEN SIGN(mt.home_tip - mt.away_tip) = SIGN(m.home_score - m.away_score) THEN 2
      ELSE 0 END) AS pts,
    COUNT(*) FILTER (WHERE mt.home_tip = m.home_score AND mt.away_tip = m.away_score) AS exact_count
  FROM match_tips mt JOIN matches m ON m.id = mt.match_id
  WHERE m.home_score IS NOT NULL AND m.away_score IS NOT NULL
  GROUP BY mt.user_id
)
```

**Sonderwetten — drei Fälle nach `bet_type`:**

a) Einfache Gleichheit (`'team'`, `'text'`, `'round'`):

```sql
simple_special_pts AS (
  SELECT sbt.user_id, SUM(sb.points_value) AS pts
  FROM special_bet_tips sbt
  JOIN special_bets sb ON sb.id = sbt.special_bet_id
  WHERE sb.correct_answer IS NOT NULL
    AND sb.bet_type IN ('team','text','round')
    AND sbt.answer = sb.correct_answer
  GROUP BY sbt.user_id
)
```

b) **Edge Case Wette #3** (`'number'`, nächste Schätzung gewinnt, Ties = volle Punkte, G5):

```sql
number_pts AS (
  SELECT sbt.user_id, SUM(sb.points_value) AS pts
  FROM special_bet_tips sbt
  JOIN special_bets sb ON sb.id = sbt.special_bet_id
  WHERE sb.bet_type = 'number' AND sb.correct_answer IS NOT NULL
    AND ABS(sbt.answer::numeric - sb.correct_answer::numeric) = (
      SELECT MIN(ABS(s2.answer::numeric - sb.correct_answer::numeric))
      FROM special_bet_tips s2
      WHERE s2.special_bet_id = sb.id
    )
  GROUP BY sbt.user_id
)
```

c) **Edge Case Wette #4** (`'two_teams'`, 4 Punkte pro richtigem Team, Set-Vergleich, G6):

```sql
two_team_pts AS (
  SELECT sbt.user_id,
    SUM((sb.points_value / 2) * (
      SELECT COUNT(*)
      FROM jsonb_array_elements_text(sbt.answer::jsonb) AS tip(team)
      WHERE tip.team IN (
        SELECT jsonb_array_elements_text(sb.correct_answer::jsonb)
      )
    )) AS pts
  FROM special_bet_tips sbt
  JOIN special_bets sb ON sb.id = sbt.special_bet_id
  WHERE sb.bet_type = 'two_teams' AND sb.correct_answer IS NOT NULL
  GROUP BY sbt.user_id
)
```

Finale View-Spalten: `id, display_name, paid, match_points, special_points, total_points, exact_count` — sortiert `total_points DESC, exact_count DESC`.

---

## 5. UI / Design-System

**Ziel:** modern, leicht verspielt, mobile-first. Jeder Screen muss auf einem Handy in der WhatsApp-In-App-Browser-Ansicht gut aussehen.

**Palette (3 Farben + Neutrals):**

| Token | Wert | Verwendung |
|---|---|---|
| `--color-pitch` | `#15803d` (Grün 700) | Primär: Buttons, aktive Nav, Akzente |
| `--color-gold` | `#f59e0b` (Amber 500) | Punkte, Platz 1, Highlights |
| `--color-night` | `#0f172a` (Slate 900) | Text, Header |
| Neutrals | Slate 50–400 | Flächen, Borders, Sekundärtext |

**Typografie:** `Geist Sans` (kommt mit create-next-app) für alles + `font-black italic` Display-Stil für Headlines/Punktzahlen — Stadion-Anzeigetafel-Feeling ohne zweite Font-Last. Tabellenzahlen mit `tabular-nums`.

**shadcn/ui: ja**, genau diese Komponenten: `button`, `card`, `input`, `label`, `badge`, `select`, `sonner` (Toasts), `skeleton`. Nicht mehr — kein Dialog, keine Tabs (Bottom-Nav übernimmt Navigation).

**Layout-Patterns:**
- Sticky **Bottom-Nav** (3 Tabs: Tippen ⚽ / Übersicht 📋 / Rangliste 🏆), nur auf geschützten Routen.
- Tipp-Eingabe: große −/+ Stepper-Buttons pro Team (Daumen-tauglich), kein nacktes Number-Input.
- Teams immer mit Flaggen-Emoji (`lib/teams.ts`-Map) — gratis Verspieltheit, keine Asset-Pipeline.
- Rangliste: Platz 1–3 mit 🥇🥈🥉, eigene Zeile hervorgehoben (`bg-amber-50`), `paid`-Häkchen als kleines Icon.
- Übersicht: Karten pro Spiel; vor Anpfiff „🔒 Tipps noch verdeckt", danach Tipp-Grid aller Teilnehmer mit Punkte-Badges (+4 gold, +3/+2 grün, 0 grau).

---

## 6. Seed-Daten-Strategie

TypeScript statt SQL (versionierbar, re-runnable): `seed/matches.ts` und `seed/special-bets.ts` exportieren typisierte Arrays, `scripts/seed.ts` upsertet sie via supabase-js + Service-Role-Key (läuft lokal: `npx tsx scripts/seed.ts`). Idempotent über deterministische Schlüssel (matches: `home_team + away_team + kickoff_at`; special_bets: `title`).

- **12 Gruppenspiele:** 3× Deutschland (Gruppe E: Curaçao, Elfenbeinküste, Ecuador) + 9 Topspiele der Favoriten. Kickoff-Zeiten als `timestamptz` UTC — **der Seed-Agent recherchiert die echten Anstoßzeiten aus dem offiziellen FIFA-Spielplan** (WebSearch); bei Unsicherheit konservativ-plausible Zeit + `// TODO verify`-Kommentar.
- **7 Sonderwetten** exakt nach README-Tabelle, alle `lock_at = '2026-06-11T16:00:00Z'` (vor dem Eröffnungsspiel). `options`-jsonb: Teamlisten für #1/#6/#7 (#7 nur Gruppe E), ~24 Spieler für #2, Runden für #5 (inkl. „Sechzehntelfinale", G4), Finalisten-Teamliste für #4, `null` für #3.
- **K.o.-Spiele:** keine Stubs. Ab 28.6. echte Zeilen im Supabase Dashboard anlegen (README-Entscheidung).

---

## 7. Deployment

- **Vercel:** Projekt aus GitHub-Repo, Framework-Preset Next.js, keine Sonderconfig. Env-Vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Service-Role-Key **nicht** auf Vercel — wird nur lokal fürs Seeding gebraucht).
- **Migrationen:** SQL-Dateien in `supabase/migrations/`, angewendet via `supabase link --project-ref <ref>` + `supabase db push`. Fallback ohne CLI: Dateien in den Dashboard-SQL-Editor pasten (Reihenfolge 0001→0003).
- **Build-Checks vor jedem Deploy:** `npx tsc --noEmit && npm run lint && npm run build` — grün oder kein Push.
- **Manuelle Schritte (nur der Mensch kann das):**
  1. Supabase-Projekt anlegen → URL + Anon-Key + Service-Role-Key liefern
  2. Resend-Account + Custom-SMTP in Supabase eintragen (G10)
  3. GitHub-Repo anlegen + Vercel verbinden
  4. Supabase Auth: Site URL + Redirect URL auf Vercel-Domain setzen
- **Smoke-Test nach Deploy:** Login per Magic Link → display_name setzen → Tipp abgeben → Tipp ändern → Rangliste lädt → mit zweitem Account prüfen, dass fremder Tipp vor Anpfiff unsichtbar ist.
