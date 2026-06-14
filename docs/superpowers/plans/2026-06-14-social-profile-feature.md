# Soziales Profil-Feature — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Spieler-Profile als soziales Herzstück: Profil-Seiten mit Avatar/Rang/Stats/Tipps, Emoji-Reaktionen + Kommentare auf Tipps (nach Anpfiff), editierbares Eigenprofil, Feature-Request-Button.

**Architecture:** Next.js 15 App Router. Server Components fetchen Daten (RLS reveal-gated), Client Components erledigen Mutationen direkt über den Supabase-Browser-Client + `router.refresh()` (Muster wie `willkommen`). Zwei neue Tabellen (`tip_reactions`, `tip_comments`) + `feature_requests`, alle reveal-gated per RLS. Kein Realtime in v1.

**Tech Stack:** Next.js 15.5, React 19, Supabase (@supabase/ssr), Tailwind v4, sonner (Toasts).

**Testing-Ansatz (bewusste Abweichung von TDD):** Das Projekt hat keinen Test-Runner. Per YAGNI wird keiner eingeführt. Verifikation pro Task: `npm run build` (TS-Typecheck), `npm run lint`, SQL-Checks für RLS-Gates, manuelle Checks im `npm run dev`-Server. Spalten/Signaturen sind über Tasks hinweg konsistent gehalten.

**Konventionen (aus Codebase):**
- Server-Client: `import { createClient } from "@/lib/supabase/server"` → `const supabase = await createClient()`.
- Browser-Client: `import { createClient } from "@/lib/supabase/client"` → `const supabase = createClient()`.
- Next 15: dynamische Route-Params sind `Promise` → `const { id } = await params`.
- Karten-Stil: `rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden`.
- Headings: `display-heading text-2xl text-night`. Punkte-Badges: `POINTS_COLORS` aus `scoring.ts`.
- AGENTS.md: vor Next-spezifischem Code ggf. `node_modules/next/dist/docs/` prüfen (im aktuellen Install nicht vorhanden → an vorhandenen Patterns orientieren).

---

## Datei-Struktur

**Neu:**
- `supabase/migrations/0008_social.sql` — Tabellen + RLS + Grants
- `src/lib/rank.ts` — Rang-Berechnung (aus leaderboard-table extrahiert)
- `src/lib/avatar-upload.ts` — Resize + Upload (aus willkommen extrahiert)
- `src/components/profile-view.tsx` — async Server-Component: lädt + rendert ein Profil
- `src/components/profile-header.tsx` — Avatar groß, Name, Rang, Stats (presentational)
- `src/components/profile-tip-list.tsx` — Tipp-Liste mit Punkten + Interaktion (Server)
- `src/components/tip-reactions.tsx` — Emoji-Toggle (Client)
- `src/components/tip-comments.tsx` — Kommentare lesen/schreiben/löschen (Client)
- `src/components/profile-edit.tsx` — Name + Avatar bearbeiten (Client)
- `src/components/feature-request-button.tsx` — inline Formular + Insert (Client)
- `src/app/(authed)/spieler/[id]/page.tsx` — fremdes Profil
- `src/app/(authed)/profil/page.tsx` — eigenes Profil + Edit + FR

**Geändert:**
- `src/types/database.ts` — 3 neue Tabellen-Typen
- `src/lib/scoring.ts` — `closestDistance` + `pointsForTip`
- `src/components/match-reveal-card.tsx` — nutzt `closestDistance`
- `src/components/leaderboard-table.tsx` — nutzt `withRanks`, Namen verlinkt
- `src/components/bottom-nav.tsx` — 5. Tab "Profil"

---

## Task 1: DB-Migration + Typen

**Files:**
- Create: `supabase/migrations/0008_social.sql`
- Modify: `src/types/database.ts`

- [ ] **Step 1: Migration schreiben**

`supabase/migrations/0008_social.sql`:

```sql
-- =============================================================================
-- 0008_social.sql — Reaktionen, Kommentare, Feature-Requests
-- Reveal-Gate spiegelt match_tips-Policy: Interaktion erst nach Anpfiff.
-- =============================================================================

CREATE TABLE IF NOT EXISTS tip_reactions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  match_tip_id uuid        NOT NULL REFERENCES match_tips ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES profiles   ON DELETE CASCADE,
  emoji        text        NOT NULL CHECK (emoji IN ('😂','🔥','👀','😱','👏')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_tip_id, user_id, emoji)
);
CREATE INDEX IF NOT EXISTS tip_reactions_match_tip_id_idx ON tip_reactions (match_tip_id);

CREATE TABLE IF NOT EXISTS tip_comments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  match_tip_id uuid        NOT NULL REFERENCES match_tips ON DELETE CASCADE,
  author_id    uuid        NOT NULL REFERENCES profiles   ON DELETE CASCADE,
  body         text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 200),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tip_comments_match_tip_id_idx ON tip_comments (match_tip_id);

CREATE TABLE IF NOT EXISTS feature_requests (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES profiles ON DELETE CASCADE,
  body       text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tip_reactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tip_comments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_requests ENABLE ROW LEVEL SECURITY;

-- Explizite Grants (defensiv; Supabase-Default-Privileges decken public-Tabellen i.d.R. ab)
GRANT SELECT, INSERT, DELETE ON tip_reactions    TO authenticated;
GRANT SELECT, INSERT, DELETE ON tip_comments     TO authenticated;
GRANT SELECT, INSERT          ON feature_requests TO authenticated;

-- ---- tip_reactions: sichtbar/erstellbar nur nach Anpfiff des zugehörigen Spiels ----
CREATE POLICY "tip_reactions_select_reveal"
  ON tip_reactions FOR SELECT TO authenticated
  USING (
    now() >= (SELECT m.kickoff_at FROM matches m
              JOIN match_tips mt ON mt.match_id = m.id
              WHERE mt.id = match_tip_id)
  );

CREATE POLICY "tip_reactions_insert_own_after_kickoff"
  ON tip_reactions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND now() >= (SELECT m.kickoff_at FROM matches m
                  JOIN match_tips mt ON mt.match_id = m.id
                  WHERE mt.id = match_tip_id)
  );

CREATE POLICY "tip_reactions_delete_own"
  ON tip_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ---- tip_comments: analog, author_id ----
CREATE POLICY "tip_comments_select_reveal"
  ON tip_comments FOR SELECT TO authenticated
  USING (
    now() >= (SELECT m.kickoff_at FROM matches m
              JOIN match_tips mt ON mt.match_id = m.id
              WHERE mt.id = match_tip_id)
  );

CREATE POLICY "tip_comments_insert_own_after_kickoff"
  ON tip_comments FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND now() >= (SELECT m.kickoff_at FROM matches m
                  JOIN match_tips mt ON mt.match_id = m.id
                  WHERE mt.id = match_tip_id)
  );

CREATE POLICY "tip_comments_delete_own"
  ON tip_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid());

-- ---- feature_requests: eigene anlegen/lesen; Admin liest alle ----
CREATE POLICY "feature_requests_insert_own"
  ON feature_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "feature_requests_select_own_or_admin"
  ON feature_requests FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (SELECT is_admin FROM profiles WHERE id = auth.uid())
  );
```

- [ ] **Step 2: Migration anwenden**

Über die im Projekt übliche Methode anwenden (Supabase SQL-Editor einfügen + ausführen, oder `supabase db push` falls CLI verbunden). Auf die Live/Dev-DB, die `.env.local` referenziert.

- [ ] **Step 3: RLS verifizieren (SQL)**

Im Supabase SQL-Editor prüfen, dass die Tabellen + Policies existieren:

Run:
```sql
SELECT tablename FROM pg_tables WHERE tablename IN ('tip_reactions','tip_comments','feature_requests');
SELECT polname, tablename FROM pg_policies WHERE tablename IN ('tip_reactions','tip_comments','feature_requests') ORDER BY tablename;
```
Expected: 3 Tabellen, 8 Policies (3 + 3 + 2).

- [ ] **Step 4: Typen ergänzen**

In `src/types/database.ts` innerhalb von `Database["public"]["Tables"]` (nach `special_bet_tips`, vor dem schließenden `};` der Tables) ergänzen:

```ts
      tip_reactions: {
        Row:    { id: string; match_tip_id: string; user_id: string; emoji: string; created_at: string };
        Insert: { id?: string; match_tip_id: string; user_id: string; emoji: string; created_at?: string };
        Update: { id?: string; match_tip_id?: string; user_id?: string; emoji?: string; created_at?: string };
        Relationships: [];
      };
      tip_comments: {
        Row:    { id: string; match_tip_id: string; author_id: string; body: string; created_at: string };
        Insert: { id?: string; match_tip_id: string; author_id: string; body: string; created_at?: string };
        Update: { id?: string; match_tip_id?: string; author_id?: string; body?: string; created_at?: string };
        Relationships: [];
      };
      feature_requests: {
        Row:    { id: string; user_id: string; body: string; created_at: string };
        Insert: { id?: string; user_id: string; body: string; created_at?: string };
        Update: { id?: string; user_id?: string; body?: string; created_at?: string };
        Relationships: [];
      };
```

Außerdem oben bei den Convenience-Types ergänzen:

```ts
export interface TipReaction { id: string; match_tip_id: string; user_id: string; emoji: string; created_at: string }
export interface TipComment  { id: string; match_tip_id: string; author_id: string; body: string; created_at: string }
```

- [ ] **Step 5: Build + Commit**

Run: `npm run build`
Expected: erfolgreich (keine Typfehler).

```bash
git add supabase/migrations/0008_social.sql src/types/database.ts
git commit -m "feat(db): social tables (reactions, comments, feature_requests) + RLS"
```

---

## Task 2: `lib/rank.ts` extrahieren

**Files:**
- Create: `src/lib/rank.ts`
- Modify: `src/components/leaderboard-table.tsx`

- [ ] **Step 1: `lib/rank.ts` schreiben**

`src/lib/rank.ts`:

```ts
import type { LeaderboardRow } from "@/types/database";

export interface RankedRow extends LeaderboardRow {
  rank: number;
}

/**
 * Ränge mit Gleichstand-Handling: gleiche total_points UND exact_count → geteilter Rang
 * (z.B. zwei Platz 2 → nächster ist Platz 4).
 * Erwartet `rows` bereits sortiert (leaderboard-View: total_points DESC, exact_count DESC).
 */
export function withRanks(rows: LeaderboardRow[]): RankedRow[] {
  const out: RankedRow[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    let rank = i + 1;
    if (i > 0) {
      const prev = rows[i - 1];
      if (prev.total_points === row.total_points && prev.exact_count === row.exact_count) {
        rank = out[i - 1].rank;
      }
    }
    out.push({ ...row, rank });
  }
  return out;
}
```

- [ ] **Step 2: leaderboard-table refaktorieren**

In `src/components/leaderboard-table.tsx` den Import ergänzen und die Inline-Rang-Schleife (die lokale `interface RowWithRank` + die `for`-Schleife, die `rowsWithRanks` aufbaut) ersetzen durch den Helper.

Import oben ergänzen:
```ts
import { withRanks } from "@/lib/rank";
```

Block ersetzen — alt (entfernen):
```ts
  interface RowWithRank extends LeaderboardRow {
    rank: number;
  }
  const rowsWithRanks: RowWithRank[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    let rank = i + 1;
    if (i > 0) {
      const prev = rows[i - 1];
      if (
        prev.total_points === row.total_points &&
        prev.exact_count === row.exact_count
      ) {
        rank = rowsWithRanks[i - 1].rank;
      }
    }
    rowsWithRanks.push({ ...row, rank });
  }
```
neu (einfügen):
```ts
  const rowsWithRanks = withRanks(rows);
```

(Der `import type { LeaderboardRow }` bleibt, falls anderweitig genutzt; sonst entfernen, wenn lint ungenutzten Import meldet.)

- [ ] **Step 3: Build + Lint**

Run: `npm run build && npm run lint`
Expected: erfolgreich.

- [ ] **Step 4: Manuell prüfen**

`npm run dev`, `/rangliste` öffnen: Reihenfolge, Medaillen und geteilte Ränge identisch wie vorher.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rank.ts src/components/leaderboard-table.tsx
git commit -m "refactor: extract withRanks into lib/rank"
```

---

## Task 3: `lib/avatar-upload.ts` extrahieren

**Files:**
- Create: `src/lib/avatar-upload.ts`
- Modify: `src/app/willkommen/page.tsx`

- [ ] **Step 1: `lib/avatar-upload.ts` schreiben**

`src/lib/avatar-upload.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export const AVATAR_SIZE = 256; // Zielkantenlänge des quadratischen Avatars

/** Bild laden, mittig quadratisch zuschneiden, auf AVATAR_SIZE skalieren → WebP-Blob. */
export async function resizeToSquareWebp(file: File): Promise<Blob> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden"));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Bild konnte nicht geladen werden"));
    i.src = dataUrl;
  });

  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas nicht verfügbar");
  ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Konvertierung fehlgeschlagen"))),
      "image/webp",
      0.85
    );
  });
}

/** Verkleinert + lädt das Bild in den avatars-Bucket, gibt die public URL zurück. */
export async function uploadAvatar(
  supabase: SupabaseClient<Database>,
  userId: string,
  file: File
): Promise<string> {
  const blob = await resizeToSquareWebp(file);
  const path = `${userId}/${Date.now()}.webp`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, blob, { contentType: "image/webp", upsert: true });
  if (error) throw new Error("Bild-Upload fehlgeschlagen");

  const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
  return publicUrl;
}
```

- [ ] **Step 2: willkommen refaktorieren**

In `src/app/willkommen/page.tsx`:
1. Die lokale Funktion `resizeToSquareWebp` (Zeilen ~15-48) und die lokale Konstante `AVATAR_SIZE` entfernen.
2. Import ergänzen: `import { uploadAvatar } from "@/lib/avatar-upload";`
3. Im `handleSubmit` den Upload-Block (resize → storage.upload → getPublicUrl) ersetzen durch:

alt:
```ts
      const blob = await resizeToSquareWebp(file);
      const path = `${user.id}/${Date.now()}.webp`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { contentType: "image/webp", upsert: true });

      if (uploadError) {
        setError("Bild-Upload fehlgeschlagen. Versuch's nochmal.");
        setLoading(false);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);
```
neu:
```ts
      let publicUrl: string;
      try {
        publicUrl = await uploadAvatar(supabase, user.id, file);
      } catch {
        setError("Bild-Upload fehlgeschlagen. Versuch's nochmal.");
        setLoading(false);
        return;
      }
```

- [ ] **Step 3: Build + Lint**

Run: `npm run build && npm run lint`
Expected: erfolgreich.

- [ ] **Step 4: Manuell prüfen**

Mit einem frischen Test-Account das Onboarding durchlaufen: Bild hochladen → landet in Storage, Avatar erscheint in Rangliste/Übersicht.

- [ ] **Step 5: Commit**

```bash
git add src/lib/avatar-upload.ts "src/app/willkommen/page.tsx"
git commit -m "refactor: extract avatar upload into lib/avatar-upload"
```

---

## Task 4: scoring.ts `closestDistance` + `pointsForTip`

**Files:**
- Modify: `src/lib/scoring.ts`
- Modify: `src/components/match-reveal-card.tsx`

- [ ] **Step 1: Helper in scoring.ts ergänzen**

Am Ende von `src/lib/scoring.ts` (vor `POINTS_COLORS` oder danach — egal) ergänzen:

```ts
/** Kleinste Tor-Distanz unter den NICHT-exakten Tipps eines Spiels.
 *  Infinity, wenn es keine nicht-exakten Tipps gibt. */
export function closestDistance(
  tips: { home_tip: number; away_tip: number }[],
  result: { home_score: number; away_score: number }
): number {
  let min = Infinity;
  for (const t of tips) {
    if (!isExactTip(t, result)) min = Math.min(min, tipDistance(t, result));
  }
  return min;
}

/** Punkte eines einzelnen Tipps, gegeben ALLE Tipps des Spiels (für "am nächsten dran"). */
export function pointsForTip(
  tip: { home_tip: number; away_tip: number },
  result: { home_score: number; away_score: number },
  allTipsForMatch: { home_tip: number; away_tip: number }[]
): MatchPoints {
  const isClosest =
    !isExactTip(tip, result) &&
    tipDistance(tip, result) === closestDistance(allTipsForMatch, result);
  return calcMatchPoints(tip, result, isClosest);
}
```

- [ ] **Step 2: match-reveal-card auf `closestDistance` umstellen**

In `src/components/match-reveal-card.tsx`:
1. Import erweitern: `import { calcMatchPoints, POINTS_COLORS, tipDistance, isExactTip, closestDistance } from "@/lib/scoring";`
2. Die Inline-`minDist`-Schleife ersetzen.

alt:
```ts
          let minDist = Infinity;
          if (result) {
            for (const t of tips) {
              if (!isExactTip(t, result)) {
                minDist = Math.min(minDist, tipDistance(t, result));
              }
            }
          }
```
neu:
```ts
          const minDist = result ? closestDistance(tips, result) : Infinity;
```

(Die `isClosest`/`pts`-Berechnung darunter bleibt unverändert — sie nutzt weiterhin `tipDistance`/`isExactTip`/`minDist`/`calcMatchPoints`.)

- [ ] **Step 3: Build + Lint**

Run: `npm run build && npm run lint`
Expected: erfolgreich. (Falls lint `tipDistance`/`isExactTip` als ungenutzt meldet — sie werden weiter im JSX-Block genutzt, also bleiben sie.)

- [ ] **Step 4: Manuell prüfen**

`/uebersicht`: Bei einem abgeschlossenen Spiel sind die Punkte-Badges (7/5/3/0) identisch wie vorher.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring.ts src/components/match-reveal-card.tsx
git commit -m "refactor: extract closestDistance/pointsForTip into scoring"
```

---

## Task 5: ProfileView + ProfileHeader + Routen (read-only)

**Files:**
- Create: `src/components/profile-header.tsx`
- Create: `src/components/profile-view.tsx`
- Create: `src/app/(authed)/spieler/[id]/page.tsx`
- Create: `src/app/(authed)/profil/page.tsx`

- [ ] **Step 1: ProfileHeader (presentational) schreiben**

`src/components/profile-header.tsx`:

```tsx
import { Avatar } from "@/components/avatar";

interface ProfileHeaderProps {
  displayName: string;
  avatarUrl: string | null;
  paid: boolean;
  rank: number | null;
  totalPoints: number;
  matchPoints: number;
  specialPoints: number;
  exactCount: number;
  hitRatePct: number | null; // null = noch keine gewerteten Tipps
}

function medal(rank: number | null): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return rank ? `#${rank}` : "—";
}

export function ProfileHeader({
  displayName, avatarUrl, paid, rank,
  totalPoints, matchPoints, specialPoints, exactCount, hitRatePct,
}: ProfileHeaderProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 pt-6 pb-4 flex flex-col items-center text-center gap-2">
        <Avatar name={displayName} url={avatarUrl} size={112} />
        <div className="flex items-center gap-2">
          <h1 className="display-heading text-2xl text-night">{displayName}</h1>
          {paid && <span title="Zahler" className="text-lg">💰</span>}
        </div>
        <p className="text-sm font-semibold text-amber-600">
          {medal(rank)} · {totalPoints} Punkte
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-slate-100 divide-x divide-slate-100">
        <Stat label="Spieltipps" value={matchPoints} />
        <Stat label="Sonderwetten" value={specialPoints} />
        <Stat label="Volltreffer" value={`${exactCount} ⭐`} />
        <Stat label="Trefferquote" value={hitRatePct === null ? "—" : `${hitRatePct}%`} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="px-3 py-3 text-center">
      <div className="text-lg font-black text-night tabular-nums">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}
```

- [ ] **Step 2: ProfileView (data-fetch, Server) schreiben — vorerst nur Header + einfache Tipp-Liste**

`src/components/profile-view.tsx`:

```tsx
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { withRanks } from "@/lib/rank";
import { pointsForTip } from "@/lib/scoring";
import { ProfileHeader } from "@/components/profile-header";
import { ProfileTipList, type ProfileTipItem } from "@/components/profile-tip-list";
import type { Match } from "@/types/database";

interface TipRow {
  id: string;
  user_id: string;
  match_id: string;
  home_tip: number;
  away_tip: number;
}

interface ProfileViewProps {
  targetId: string;
  viewerId: string;
}

export async function ProfileView({ targetId, viewerId }: ProfileViewProps) {
  const supabase = await createClient();

  // Profil
  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", targetId).single();
  if (!profile) notFound();

  // Rang + Punkte aus leaderboard-View
  const { data: lbRows } = await supabase.from("leaderboard").select("*");
  const ranked = withRanks(lbRows ?? []);
  const me = ranked.find((r) => r.id === targetId) ?? null;

  // Spiele (für Ergebnis/Teams/kickoff)
  const { data: matchesRaw } = await supabase.from("matches").select("*");
  const matches: Match[] = matchesRaw ?? [];
  const matchById = new Map(matches.map((m) => [m.id, m]));

  // ALLE sichtbaren Tipps (RLS: fremde nur nach Anpfiff) — für "closest" pro Spiel
  const { data: allTipsRaw } = await supabase
    .from("match_tips").select("id, user_id, match_id, home_tip, away_tip");
  const allTips: TipRow[] = (allTipsRaw as TipRow[] | null) ?? [];

  // Tipps des Ziel-Users
  const targetTips = allTips.filter((t) => t.user_id === targetId);

  // Tipps pro Spiel (für closest)
  const tipsByMatch = new Map<string, TipRow[]>();
  for (const t of allTips) {
    const arr = tipsByMatch.get(t.match_id) ?? [];
    arr.push(t);
    tipsByMatch.set(t.match_id, arr);
  }

  // Trefferquote: gewertete Spiele (mit Ergebnis), die der User getippt hat
  let scored = 0;
  let scoredHits = 0;

  // Tipp-Items aufbereiten (nach kickoff sortiert, neueste zuerst)
  const now = new Date();
  const items: ProfileTipItem[] = targetTips
    .map((t) => {
      const m = matchById.get(t.match_id);
      if (!m) return null;
      const hasResult = m.home_score !== null && m.away_score !== null;
      const hasStarted = new Date(m.kickoff_at) <= now;
      let points: number | null = null;
      if (hasResult) {
        const result = { home_score: m.home_score!, away_score: m.away_score! };
        points = pointsForTip(t, result, tipsByMatch.get(t.match_id) ?? [t]);
        scored += 1;
        if (points > 0) scoredHits += 1;
      }
      return {
        matchTipId: t.id,
        homeTeam: m.home_team,
        awayTeam: m.away_team,
        kickoffAt: m.kickoff_at,
        homeScore: m.home_score,
        awayScore: m.away_score,
        homeTip: t.home_tip,
        awayTip: t.away_tip,
        points,
        hasStarted,
      } as ProfileTipItem;
    })
    .filter((x): x is ProfileTipItem => x !== null)
    .sort((a, b) => new Date(b.kickoffAt).getTime() - new Date(a.kickoffAt).getTime());

  const hitRatePct = scored === 0 ? null : Math.round((scoredHits / scored) * 100);

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
      <ProfileHeader
        displayName={profile.display_name || "Anonym"}
        avatarUrl={profile.avatar_url}
        paid={profile.paid}
        rank={me?.rank ?? null}
        totalPoints={me?.total_points ?? 0}
        matchPoints={me?.match_points ?? 0}
        specialPoints={me?.special_points ?? 0}
        exactCount={me?.exact_count ?? 0}
        hitRatePct={hitRatePct}
      />
      <ProfileTipList items={items} viewerId={viewerId} reactions={[]} comments={[]} />
    </div>
  );
}
```

- [ ] **Step 3: Minimaler ProfileTipList-Stub (wird in Task 7/8 erweitert)**

`src/components/profile-tip-list.tsx` (erste Version ohne Interaktion):

```tsx
import { TeamLabel } from "@/components/team-label";
import { POINTS_COLORS, type MatchPoints } from "@/lib/scoring";
import type { TipReaction, TipComment } from "@/types/database";

export interface ProfileTipItem {
  matchTipId: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
  homeScore: number | null;
  awayScore: number | null;
  homeTip: number;
  awayTip: number;
  points: number | null;
  hasStarted: boolean;
}

interface ProfileTipListProps {
  items: ProfileTipItem[];
  viewerId: string;
  reactions: (TipReaction & { display_name: string })[];
  comments: (TipComment & { display_name: string; avatar_url: string | null })[];
}

export function ProfileTipList({ items }: ProfileTipListProps) {
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-sm py-6 text-center">
        Noch keine sichtbaren Tipps.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Tipps</h2>
      {items.map((it) => (
        <div key={it.matchTipId} className="rounded-2xl border border-slate-200 bg-white shadow-sm px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <TeamLabel team={it.homeTeam} className="font-medium text-night flex-1 truncate" />
            <span className="font-bold tabular-nums text-night">{it.homeTip} : {it.awayTip}</span>
            <TeamLabel team={it.awayTeam} className="font-medium text-night flex-1 truncate text-right justify-end" />
            {it.points !== null && (
              <span className={POINTS_COLORS[it.points as MatchPoints]}>
                {it.points > 0 ? `+${it.points}` : "0"}
              </span>
            )}
          </div>
          {it.homeScore !== null && it.awayScore !== null && (
            <p className="text-xs text-muted-foreground mt-1">
              Ergebnis: {it.homeScore} : {it.awayScore}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
```

> Hinweis: `reactions`/`comments`-Props existieren bereits in der Signatur (für Task 7/8), werden hier noch nicht gerendert.

- [ ] **Step 4: Route `/spieler/[id]`**

`src/app/(authed)/spieler/[id]/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileView } from "@/components/profile-view";

export default async function SpielerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  return <ProfileView targetId={id} viewerId={user.id} />;
}
```

- [ ] **Step 5: Route `/profil`** (vorerst nur eigenes Profil anzeigen)

`src/app/(authed)/profil/page.tsx`:

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileView } from "@/components/profile-view";

export const metadata: Metadata = { title: "Profil | WM 2026 Tippspiel" };

export default async function ProfilPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  return <ProfileView targetId={user.id} viewerId={user.id} />;
}
```

- [ ] **Step 6: Build + Lint**

Run: `npm run build && npm run lint`
Expected: erfolgreich.

- [ ] **Step 7: Manuell prüfen**

`npm run dev`: `/profil` zeigt eigenen Avatar groß, Rang, Stats, Tipp-Liste. `/spieler/<andere-id>` zeigt fremdes Profil; vor Anpfiff sind dort keine Tipps sichtbar (nur nach Anpfiff). Trefferquote ist `—`, wenn keine gewerteten Tipps.

- [ ] **Step 8: Commit**

```bash
git add src/components/profile-header.tsx src/components/profile-view.tsx src/components/profile-tip-list.tsx "src/app/(authed)/spieler/[id]/page.tsx" "src/app/(authed)/profil/page.tsx"
git commit -m "feat: read-only player profile pages (/spieler/[id], /profil)"
```

---

## Task 6: Navigation — klickbare Namen + 5. Tab

**Files:**
- Modify: `src/components/bottom-nav.tsx`
- Modify: `src/components/leaderboard-table.tsx`

- [ ] **Step 1: 5. Tab "Profil" hinzufügen**

In `src/components/bottom-nav.tsx` das `TABS`-Array erweitern (Profil vor Regeln):

```ts
const TABS = [
  { href: "/tippen", label: "Tippen", emoji: "⚽" },
  { href: "/uebersicht", label: "Übersicht", emoji: "📋" },
  { href: "/rangliste", label: "Rangliste", emoji: "🏆" },
  { href: "/profil", label: "Profil", emoji: "👤" },
  { href: "/regeln", label: "Regeln", emoji: "📖" },
] as const;
```

- [ ] **Step 2: Namen in der Rangliste verlinken**

In `src/components/leaderboard-table.tsx` den Import ergänzen:
```ts
import Link from "next/link";
```
Die Namen-Zelle (Avatar + display_name) in einen Link auf `/spieler/[id]` wickeln. Ersetze den Inhalt der Name-`<td>`:

alt:
```tsx
                <td>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={displayName} url={row.avatar_url} size={32} />
                    <span className="font-medium text-night">{displayName}</span>
                    {row.paid && (
                      <span title="Zahler" className="text-lg">💰</span>
                    )}
                  </div>
                </td>
```
neu:
```tsx
                <td>
                  {row.id ? (
                    <Link href={`/spieler/${row.id}`} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
                      <Avatar name={displayName} url={row.avatar_url} size={32} />
                      <span className="font-medium text-night underline-offset-2 hover:underline">{displayName}</span>
                      {row.paid && <span title="Zahler" className="text-lg">💰</span>}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-2.5">
                      <Avatar name={displayName} url={row.avatar_url} size={32} />
                      <span className="font-medium text-night">{displayName}</span>
                      {row.paid && <span title="Zahler" className="text-lg">💰</span>}
                    </div>
                  )}
                </td>
```

- [ ] **Step 3: Build + Lint**

Run: `npm run build && npm run lint`
Expected: erfolgreich.

- [ ] **Step 4: Manuell prüfen**

5 Tabs sichtbar und nutzbar auf 375px Breite (DevTools Mobile). Klick auf einen Namen in der Rangliste öffnet das Profil. Falls 5 Tabs zu eng wirken: in einem Folge-Commit Regeln in die Profil-Seite verschieben (Entscheidung hier, da Layout jetzt sichtbar).

- [ ] **Step 5: Commit**

```bash
git add src/components/bottom-nav.tsx src/components/leaderboard-table.tsx
git commit -m "feat: profil tab + clickable leaderboard names"
```

---

## Task 7: Reaktionen (tip-reactions Client)

**Files:**
- Create: `src/components/tip-reactions.tsx`
- Modify: `src/components/profile-view.tsx` (Reaktionen laden + übergeben)
- Modify: `src/components/profile-tip-list.tsx` (Reaktionen rendern)

- [ ] **Step 1: tip-reactions.tsx (Client) schreiben**

`src/components/tip-reactions.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export const REACTION_EMOJIS = ["😂", "🔥", "👀", "😱", "👏"] as const;

export interface ReactionItem {
  emoji: string;
  user_id: string;
  display_name: string;
}

interface TipReactionsProps {
  matchTipId: string;
  viewerId: string;
  initial: ReactionItem[];
}

export function TipReactions({ matchTipId, viewerId, initial }: TipReactionsProps) {
  const router = useRouter();
  const [items, setItems] = useState<ReactionItem[]>(initial);
  const [busy, setBusy] = useState(false);

  async function toggle(emoji: string) {
    if (busy) return;
    setBusy(true);
    const supabase = createClient();
    const mine = items.find((r) => r.emoji === emoji && r.user_id === viewerId);

    // optimistisch
    setItems((prev) =>
      mine
        ? prev.filter((r) => !(r.emoji === emoji && r.user_id === viewerId))
        : [...prev, { emoji, user_id: viewerId, display_name: "Du" }]
    );

    const { error } = mine
      ? await supabase.from("tip_reactions").delete()
          .eq("match_tip_id", matchTipId).eq("user_id", viewerId).eq("emoji", emoji)
      : await supabase.from("tip_reactions")
          .insert({ match_tip_id: matchTipId, user_id: viewerId, emoji });

    setBusy(false);
    if (error) {
      setItems(initial); // revert
      toast.error("Hat nicht geklappt.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {REACTION_EMOJIS.map((emoji) => {
        const forEmoji = items.filter((r) => r.emoji === emoji);
        const count = forEmoji.length;
        const mine = forEmoji.some((r) => r.user_id === viewerId);
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => toggle(emoji)}
            disabled={busy}
            title={forEmoji.map((r) => r.display_name).join(", ") || "Reagieren"}
            className={[
              "text-sm rounded-full border px-2 py-0.5 transition-colors disabled:opacity-50",
              mine ? "bg-amber-50 border-amber-300" : "bg-slate-50 border-slate-200 hover:border-slate-300",
            ].join(" ")}
          >
            <span>{emoji}</span>
            {count > 0 && <span className="ml-1 text-xs tabular-nums text-muted-foreground">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Reaktionen in ProfileView laden**

In `src/components/profile-view.tsx` nach dem Aufbau von `targetTips` die Tip-IDs sammeln und Reaktionen laden, dann an `ProfileTipList` übergeben. Ergänze vor dem `return`:

```ts
  // Reaktionen für die sichtbaren Tipps des Ziel-Users
  const targetTipIds = targetTips.map((t) => t.id);
  const reactionsRaw = targetTipIds.length
    ? (await supabase
        .from("tip_reactions")
        .select("*, profiles(display_name)")
        .in("match_tip_id", targetTipIds)).data
    : [];
  const reactions = (reactionsRaw ?? []).map((r: {
    id: string; match_tip_id: string; user_id: string; emoji: string; created_at: string;
    profiles: { display_name: string } | null;
  }) => ({
    id: r.id, match_tip_id: r.match_tip_id, user_id: r.user_id, emoji: r.emoji, created_at: r.created_at,
    display_name: r.profiles?.display_name ?? "Unbekannt",
  }));
```

Und den `ProfileTipList`-Aufruf anpassen:
```tsx
      <ProfileTipList items={items} viewerId={viewerId} reactions={reactions} comments={[]} />
```

- [ ] **Step 3: ProfileTipList Reaktionen rendern**

In `src/components/profile-tip-list.tsx`:
1. Import: `import { TipReactions } from "@/components/tip-reactions";`
2. Innerhalb der Tipp-Karte, nur wenn `it.hasStarted`, die Reaktionen einsetzen — nach dem Ergebnis-Absatz:

```tsx
          {it.hasStarted && (
            <TipReactions
              matchTipId={it.matchTipId}
              viewerId={viewerId}
              initial={reactions
                .filter((r) => r.match_tip_id === it.matchTipId)
                .map((r) => ({ emoji: r.emoji, user_id: r.user_id, display_name: r.display_name }))}
            />
          )}
```

(`viewerId` und `reactions` sind bereits Props — jetzt auch tatsächlich nutzen, also die Destrukturierung der Funktionssignatur auf `{ items, viewerId, reactions }` erweitern.)

- [ ] **Step 4: Build + Lint**

Run: `npm run build && npm run lint`
Expected: erfolgreich.

- [ ] **Step 5: Manuell + RLS prüfen**

Auf einem fremden Profil bei einem angepfiffenen Spiel auf ein Emoji tippen → Count erhöht sich, bleibt nach Reload. Nochmal tippen → entfernt. SQL-Gate prüfen (sollte 0 Zeilen bei nicht-angepfifftem Spiel erlauben):
```sql
-- Versuch, auf einen Tipp eines noch nicht angepfifften Spiels zu reagieren, muss scheitern.
```

- [ ] **Step 6: Commit**

```bash
git add src/components/tip-reactions.tsx src/components/profile-view.tsx src/components/profile-tip-list.tsx
git commit -m "feat: emoji reactions on tips (kickoff-gated)"
```

---

## Task 8: Kommentare (tip-comments Client)

**Files:**
- Create: `src/components/tip-comments.tsx`
- Modify: `src/components/profile-view.tsx` (Kommentare laden + übergeben)
- Modify: `src/components/profile-tip-list.tsx` (Kommentare rendern)

- [ ] **Step 1: tip-comments.tsx (Client) schreiben**

`src/components/tip-comments.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/avatar";
import { toast } from "sonner";

export interface CommentItem {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  display_name: string;
  avatar_url: string | null;
}

const MAX = 200;

interface TipCommentsProps {
  matchTipId: string;
  viewerId: string;
  initial: CommentItem[];
}

export function TipComments({ matchTipId, viewerId, initial }: TipCommentsProps) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("tip_comments")
      .insert({ match_tip_id: matchTipId, author_id: viewerId, body });
    setBusy(false);
    if (error) { toast.error("Kommentar konnte nicht gespeichert werden."); return; }
    setText("");
    router.refresh();
  }

  async function remove(id: string) {
    if (busy) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("tip_comments").delete().eq("id", id);
    setBusy(false);
    if (error) { toast.error("Löschen fehlgeschlagen."); return; }
    router.refresh();
  }

  return (
    <div className="mt-2 space-y-2">
      {initial.map((c) => (
        <div key={c.id} className="flex items-start gap-2 text-sm">
          <Avatar name={c.display_name} url={c.avatar_url} size={22} />
          <div className="flex-1">
            <span className="font-medium text-night">{c.author_id === viewerId ? "Du" : c.display_name}</span>{" "}
            <span className="text-slate-600">{c.body}</span>
          </div>
          {c.author_id === viewerId && (
            <button type="button" onClick={() => remove(c.id)} disabled={busy}
              className="text-xs text-muted-foreground hover:text-destructive" title="Löschen">✕</button>
          )}
        </div>
      ))}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={text}
          maxLength={MAX}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder="Kommentieren…"
          className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm focus:outline-none focus:border-slate-300"
        />
        <button type="button" onClick={submit} disabled={busy || !text.trim()}
          className="text-sm font-medium text-[#15803d] disabled:opacity-40">Senden</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Kommentare in ProfileView laden**

In `src/components/profile-view.tsx` nach dem Reaktionen-Block ergänzen:

```ts
  const commentsRaw = targetTipIds.length
    ? (await supabase
        .from("tip_comments")
        .select("*, profiles(display_name, avatar_url)")
        .in("match_tip_id", targetTipIds)
        .order("created_at", { ascending: true })).data
    : [];
  const comments = (commentsRaw ?? []).map((c: {
    id: string; match_tip_id: string; author_id: string; body: string; created_at: string;
    profiles: { display_name: string; avatar_url: string | null } | null;
  }) => ({
    id: c.id, match_tip_id: c.match_tip_id, author_id: c.author_id, body: c.body, created_at: c.created_at,
    display_name: c.profiles?.display_name ?? "Unbekannt",
    avatar_url: c.profiles?.avatar_url ?? null,
  }));
```

`ProfileTipList`-Aufruf anpassen:
```tsx
      <ProfileTipList items={items} viewerId={viewerId} reactions={reactions} comments={comments} />
```

- [ ] **Step 3: ProfileTipList Kommentare rendern**

In `src/components/profile-tip-list.tsx`:
1. Import: `import { TipComments } from "@/components/tip-comments";`
2. Destrukturierung auf `{ items, viewerId, reactions, comments }` erweitern.
3. Nach den Reaktionen (nur wenn `it.hasStarted`):

```tsx
          {it.hasStarted && (
            <TipComments
              matchTipId={it.matchTipId}
              viewerId={viewerId}
              initial={comments
                .filter((c) => c.match_tip_id === it.matchTipId)
                .map((c) => ({
                  id: c.id, author_id: c.author_id, body: c.body, created_at: c.created_at,
                  display_name: c.display_name, avatar_url: c.avatar_url,
                }))}
            />
          )}
```

- [ ] **Step 4: Build + Lint**

Run: `npm run build && npm run lint`
Expected: erfolgreich.

- [ ] **Step 5: Manuell + RLS prüfen**

Kommentar auf fremdem Profil (angepfifftes Spiel) schreiben → erscheint, bleibt nach Reload. Eigenen Kommentar löschen → weg. Fremden Kommentar: kein Löschen-Button. >200 Zeichen werden vom `maxLength` blockiert; ein direkter Insert >200 scheitert am DB-Check.

- [ ] **Step 6: Commit**

```bash
git add src/components/tip-comments.tsx src/components/profile-view.tsx src/components/profile-tip-list.tsx
git commit -m "feat: comments on tips (kickoff-gated)"
```

---

## Task 9: Eigenes Profil bearbeiten

**Files:**
- Create: `src/components/profile-edit.tsx`
- Modify: `src/app/(authed)/profil/page.tsx`

- [ ] **Step 1: profile-edit.tsx (Client) schreiben**

`src/components/profile-edit.tsx`:

```tsx
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
```

> Hinweis: `Button` unterstützt `variant="outline"` (shadcn). Falls die lokale Button-Variante anders heißt, an `src/components/ui/button.tsx` anpassen.

- [ ] **Step 2: ProfileEdit in /profil einbinden**

`src/app/(authed)/profil/page.tsx` erweitern — Profil laden für den Namen, ProfileEdit unter die ProfileView:

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileView } from "@/components/profile-view";
import { ProfileEdit } from "@/components/profile-edit";

export const metadata: Metadata = { title: "Profil | WM 2026 Tippspiel" };

export default async function ProfilPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles").select("display_name").eq("id", user.id).single();

  return (
    <div className="space-y-3">
      <ProfileView targetId={user.id} viewerId={user.id} />
      <div className="px-4 max-w-lg mx-auto">
        <ProfileEdit userId={user.id} initialName={profile?.display_name ?? ""} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build + Lint**

Run: `npm run build && npm run lint`
Expected: erfolgreich.

- [ ] **Step 4: Manuell prüfen**

`/profil` → "Profil bearbeiten" → Name ändern + optional neues Bild → Speichern → Toast, Profil aktualisiert sich (Header zeigt neuen Namen/Avatar).

> **RLS bestätigt (keine Migration nötig):** `0002_rls.sql` erlaubt per Spalten-Grant `display_name`, `0005_avatar_grant.sql` ergänzt `GRANT UPDATE (avatar_url) ON profiles TO authenticated;`. Beide vom Edit benötigten Spalten sind also updatebar; `profiles_update_own (id = auth.uid())` begrenzt auf die eigene Zeile. `paid`/`is_admin` bleiben gesperrt.

- [ ] **Step 5: Commit**

```bash
git add src/components/profile-edit.tsx "src/app/(authed)/profil/page.tsx"
git commit -m "feat: edit own profile (name + avatar)"
```

---

## Task 10: Feature-Request-Button

**Files:**
- Create: `src/components/feature-request-button.tsx`
- Modify: `src/app/(authed)/profil/page.tsx`

- [ ] **Step 1: feature-request-button.tsx (Client) schreiben**

`src/components/feature-request-button.tsx`:

```tsx
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
```

- [ ] **Step 2: Button in /profil einbinden**

In `src/app/(authed)/profil/page.tsx` Import + Komponente unter ProfileEdit ergänzen:

```tsx
import { FeatureRequestButton } from "@/components/feature-request-button";
```
Innerhalb des `<div className="px-4 max-w-lg mx-auto">` unter `<ProfileEdit .../>`:
```tsx
        <div className="mt-3">
          <FeatureRequestButton userId={user.id} />
        </div>
```

- [ ] **Step 3: Build + Lint**

Run: `npm run build && npm run lint`
Expected: erfolgreich.

- [ ] **Step 4: Manuell + SQL prüfen**

`/profil` → "Feature vorschlagen" → Text → Absenden → Erfolgs-Toast. In Supabase prüfen:
```sql
SELECT body, created_at FROM feature_requests ORDER BY created_at DESC LIMIT 5;
```
Expected: der gerade gesendete Eintrag erscheint.

- [ ] **Step 5: Commit**

```bash
git add src/components/feature-request-button.tsx "src/app/(authed)/profil/page.tsx"
git commit -m "feat: feature request button on profile"
```

---

## Abschluss

- [ ] `npm run build && npm run lint` final grün.
- [ ] Branch `feature/social-profile` pushen und PR gegen `main` öffnen (Vercel baut eine Preview-URL pro PR — dort mit echten Daten testen).
- [ ] Spec-Abgleich: Profil-Inhalt ✓, Reaktionen ✓, Kommentare ✓, Edit ✓, Navigation ✓, Feature-Request ✓, RLS-Reveal-Gate ✓.

## Selbst-Review-Notizen (vom Plan-Autor)

- **Spec-Coverage:** Alle Spec-Abschnitte haben Tasks (Routen→T5/T6, Profil-Inhalt→T5, Interaktion→T7/T8, Edit→T9, FR→T10, Datenmodell/RLS→T1, DRY rank/avatar→T2/T3, scoring DRY→T4).
- **T9 RLS bestätigt:** `profiles`-Spalten-Grant für `avatar_url` existiert (`0005_avatar_grant.sql`). Keine Zusatz-Migration nötig.
- **Typkonsistenz:** `ProfileTipItem`, `ReactionItem`, `CommentItem`, `withRanks`, `pointsForTip`, `closestDistance` durchgängig gleich benannt und genutzt.
- **Kein Test-Runner** im Projekt → bewusst kein TDD; Verifikation via build/lint/SQL/manuell.
