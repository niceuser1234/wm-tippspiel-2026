# Auto Knockout-Fixture Sync + News Banner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically insert World Cup knockout-stage pairings (R32 to Final) into the `matches` table as ESPN publishes them, and show a dismissible top-right banner when new knockout bets open.

**Architecture:** Mirror the existing `sync-scores` Edge Function. A new `sync-fixtures` function reads the same keyless ESPN feed, filters to knockout rounds with concrete (mappable) teams, and INSERTs any pairing not already present. A pg_cron job runs it every 30 min. Shared ESPN helpers live in a `_shared/` module testable from both Deno (runtime) and Node (`node --test`). The betting UI is unchanged: any `matches` row with `kickoff_at > now()` is automatically bettable, so no scoring/lock/reveal changes are needed. A `KnockoutBanner` client component reads a round signature and a localStorage dismiss flag.

**Tech Stack:** Supabase Edge Functions (Deno), pg_cron + pg_net, Supabase Management API, Next.js App Router (server + client components), TypeScript, lucide-react.

**Spec:** `docs/superpowers/specs/2026-06-29-knockout-fixtures-auto-sync-design.md`

## Global Constraints

- **Project ref:** `wmoqthevlthvfeazdqlh`. Function base URL: `https://wmoqthevlthvfeazdqlh.supabase.co/functions/v1/`.
- **Deploy auth:** `SUPABASE_ACCESS_TOKEN` and `SUPABASE_SERVICE_ROLE_KEY` live in `Projects/WM Tippspiel 2026/.env.local`. Load with `set -a && source .env.local && set +a` before deploy/invoke commands.
- **Migrations are applied via the Supabase Management API SQL endpoint, NOT `supabase db push`** (the migration history has drifted). Endpoint: `POST https://api.supabase.com/v1/projects/wmoqthevlthvfeazdqlh/database/query` with `Authorization: Bearer $SUPABASE_ACCESS_TOKEN`.
- **Vault secret already exists:** `sync_scores_service_role_key` (created for the 0010 cron). Reuse it. Do NOT create a new secret.
- **Cross-runtime TS rule:** `_shared/*.ts` files are imported by Deno (needs explicit `.ts` extension) AND run under Node type-stripping (`node --test`). Therefore: (a) always use the `.ts` extension in import specifiers, (b) import type-only symbols with the inline `type` keyword, e.g. `import { mapTeam, type EspnEvent } from "./espn.ts";`. Verified: omitting inline `type` breaks `node --test`.
- **ESPN round → DB stage map:** `round-of-32`→`r32`, `round-of-16`→`r16`, `quarterfinals`→`qf`, `semifinals`→`sf`, `3rd-place-match`→`third_place`, `final`→`final`. Group stage → not a knockout (ignored).
- **Team names:** exact German strings from `TEAM_MAP` (e.g. `Deutschland`, `Elfenbeinküste`, `Curaçao`). Never insert an English name.
- **Insert-only:** `sync-fixtures` never updates or deletes existing rows. It can only add new pairings.
- **Banner copy stays neutral** ("K.-o.-Wetten") — do not name the round, because R32 is technically "Sechzehntelfinale" not "Achtelfinale".
- **Next.js caveat (AGENTS.md):** this Next version may differ from training data. The established server→client pattern in this repo is `feature-request-button.tsx` (a `"use client"` child rendered by a server component). Follow it.

## Task Order Rationale

The spec's rollout listed the `sync-scores` refactor first. This plan **defers that refactor to the final task** so the live scorer is untouched during today's match window (Deutschland–Paraguay, 20:30Z). The immediate fix is delivered by Task 3 using the new shared module; `sync-scores` keeps its own inline copy until Task 6 (a pure DRY cleanup). Tasks 1→3 are time-critical (run before kickoff). Tasks 4→6 follow after.

---

### Task 1: Shared ESPN module (`_shared/espn.ts`)

Pure, cross-runtime helpers. New `mapRoundToStage`, an `EspnEvent` shape that carries the round/stage/completed flag, and `parseEspnEvents` that returns ALL events (scheduled + finished). `TEAM_MAP`, `normalize`, `ESPN_URL` are moved verbatim from the existing `sync-scores`.

**Files:**
- Create: `supabase/functions/_shared/espn.ts`
- Test: `supabase/functions/_shared/espn.test.ts`

**Interfaces:**
- Produces (consumed by Tasks 2, 3, 6):
  - `export const ESPN_URL: string`
  - `export type Stage = "group" | "r32" | "r16" | "qf" | "sf" | "third_place" | "final"`
  - `export function normalize(s: string): string`
  - `export const TEAM_MAP: Record<string, string>`
  - `export function mapTeam(apiName: string): string | undefined`
  - `export function mapRoundToStage(headline: string | null | undefined): Stage | null`
  - `export interface EspnEvent { round: string | null; stage: Stage | null; completed: boolean; homeName: string; awayName: string; homeScore: number | null; awayScore: number | null; date: string | null }`
  - `export function parseEspnEvents(json: any): EspnEvent[]`
  - `export async function fetchEspnEvents(): Promise<EspnEvent[]>`

- [ ] **Step 1: Create `_shared/espn.ts` skeleton with the verbatim-moved pieces**

Copy three things VERBATIM from `supabase/functions/sync-scores/index.ts` into the new file:
- `ESPN_URL` (currently line 34-35) — add `export`.
- `TEAM_MAP` (currently lines 41-123) — add `export`.
- `normalize` (currently lines 127-135) — add `export`.

Then the file header + new code. Full new-code portion to add below the moved pieces:

```typescript
// supabase/functions/_shared/espn.ts
//
// Shared helpers for ESPN's keyless FIFA World Cup 2026 scoreboard feed.
// Used by sync-scores (results) and sync-fixtures (knockout pairings).
//
// Cross-runtime: imported by Deno Edge Functions AND executed under Node
// type-stripping (`node --test`). Keep it dependency-free (only global fetch).
// Always import type-only symbols with the inline `type` keyword.

// --- (1) ESPN_URL: moved verbatim from sync-scores, add `export` ---
// export const ESPN_URL = "https://site.api.espn.com/.../scoreboard?dates=20260611-20260720&limit=400";

export type Stage = "group" | "r32" | "r16" | "qf" | "sf" | "third_place" | "final";

// ESPN round headline -> DB stage. Group stage / unknown -> null (not knockout).
const ROUND_TO_STAGE: Record<string, Stage> = {
  "round-of-32": "r32",
  "round-of-16": "r16",
  "quarterfinals": "qf",
  "semifinals": "sf",
  "3rd-place-match": "third_place",
  "final": "final",
};

export function mapRoundToStage(headline: string | null | undefined): Stage | null {
  if (!headline) return null;
  return ROUND_TO_STAGE[headline] ?? null;
}

// --- (2) TEAM_MAP: moved verbatim from sync-scores, add `export` ---
// --- (3) normalize(): moved verbatim from sync-scores, add `export` ---

export function mapTeam(apiName: string): string | undefined {
  return TEAM_MAP[normalize(apiName)];
}

export interface EspnEvent {
  round: string | null;     // raw ESPN headline, e.g. "round-of-32"
  stage: Stage | null;      // mapped DB stage, null for group/unknown
  completed: boolean;       // true once the match is finished
  homeName: string;         // ESPN displayName (English)
  awayName: string;
  homeScore: number | null; // null when unparseable
  awayScore: number | null;
  date: string | null;      // ISO kickoff timestamp
}

// Parse the ESPN scoreboard JSON into a flat list of events (scheduled + finished).
export function parseEspnEvents(json: any): EspnEvent[] {
  const events: any[] = Array.isArray(json?.events) ? json.events : [];
  const out: EspnEvent[] = [];
  for (const ev of events) {
    const comp = ev?.competitions?.[0];
    if (!comp) continue;
    const cs: any[] = comp.competitors ?? [];
    const home = cs.find((c) => c.homeAway === "home");
    const away = cs.find((c) => c.homeAway === "away");
    if (!home?.team?.displayName || !away?.team?.displayName) continue;
    const hs = parseInt(home.score, 10);
    const as = parseInt(away.score, 10);
    const headline: string | null = comp?.notes?.[0]?.headline ?? null;
    out.push({
      round: headline,
      stage: mapRoundToStage(headline),
      completed: Boolean(comp?.status?.type?.completed),
      homeName: home.team.displayName,
      awayName: away.team.displayName,
      homeScore: Number.isNaN(hs) ? null : hs,
      awayScore: Number.isNaN(as) ? null : as,
      date: ev?.date ?? comp?.date ?? null,
    });
  }
  return out;
}

export async function fetchEspnEvents(): Promise<EspnEvent[]> {
  const res = await fetch(ESPN_URL, {
    headers: { "Accept": "application/json", "User-Agent": "wm-tippspiel-sync" },
  });
  if (!res.ok) {
    throw new Error(`ESPN HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return parseEspnEvents(await res.json());
}
```

- [ ] **Step 2: Write the failing test `_shared/espn.test.ts`**

```typescript
import { test } from "node:test";
import assert from "node:assert";
import {
  normalize,
  mapTeam,
  mapRoundToStage,
  parseEspnEvents,
  type EspnEvent,
} from "./espn.ts";

test("normalize strips diacritics, case, punctuation", () => {
  assert.equal(normalize("Curaçao"), "curacao");
  assert.equal(normalize("Côte d'Ivoire"), "cote d ivoire");
  assert.equal(normalize("Bosnia-Herzegovina"), "bosnia herzegovina");
});

test("mapTeam resolves English ESPN names to German DB names", () => {
  assert.equal(mapTeam("Germany"), "Deutschland");
  assert.equal(mapTeam("Paraguay"), "Paraguay");
  assert.equal(mapTeam("Ivory Coast"), "Elfenbeinküste");
  assert.equal(mapTeam("Congo DR"), "DR Kongo");
  assert.equal(mapTeam("Winner Group A"), undefined); // TBD placeholder
});

test("mapRoundToStage maps knockout headlines, ignores group stage", () => {
  assert.equal(mapRoundToStage("round-of-32"), "r32");
  assert.equal(mapRoundToStage("round-of-16"), "r16");
  assert.equal(mapRoundToStage("quarterfinals"), "qf");
  assert.equal(mapRoundToStage("semifinals"), "sf");
  assert.equal(mapRoundToStage("3rd-place-match"), "third_place");
  assert.equal(mapRoundToStage("final"), "final");
  assert.equal(mapRoundToStage("group-stage"), null);
  assert.equal(mapRoundToStage(null), null);
});

test("parseEspnEvents flattens scheduled + finished events", () => {
  const json = {
    events: [
      {
        date: "2026-06-29T20:30Z",
        competitions: [{
          notes: [{ headline: "round-of-32" }],
          status: { type: { completed: false } },
          competitors: [
            { homeAway: "home", score: "0", team: { displayName: "Germany" } },
            { homeAway: "away", score: "0", team: { displayName: "Paraguay" } },
          ],
        }],
      },
      {
        date: "2026-06-14T17:00Z",
        competitions: [{
          notes: [{ headline: "group-stage" }],
          status: { type: { completed: true } },
          competitors: [
            { homeAway: "home", score: "3", team: { displayName: "Germany" } },
            { homeAway: "away", score: "1", team: { displayName: "Curacao" } },
          ],
        }],
      },
    ],
  };
  const out: EspnEvent[] = parseEspnEvents(json);
  assert.equal(out.length, 2);
  assert.deepEqual(
    { stage: out[0].stage, completed: out[0].completed, home: out[0].homeName, away: out[0].awayName },
    { stage: "r32", completed: false, home: "Germany", away: "Paraguay" },
  );
  assert.equal(out[1].stage, null);
  assert.equal(out[1].completed, true);
  assert.equal(out[1].homeScore, 3);
});
```

- [ ] **Step 3: Run the test, expect FAIL**

Run: `cd "Projects/WM Tippspiel 2026" && node --test supabase/functions/_shared/espn.test.ts`
Expected: FAIL — `Cannot find module './espn.ts'` or assertion errors (file not yet complete / verbatim pieces not pasted).

- [ ] **Step 4: Complete `_shared/espn.ts`** by pasting the three verbatim pieces (ESPN_URL, TEAM_MAP, normalize) into their marked slots from Step 1.

- [ ] **Step 5: Run the test, expect PASS**

Run: `cd "Projects/WM Tippspiel 2026" && node --test supabase/functions/_shared/espn.test.ts`
Expected: PASS — `# pass 4`, `# fail 0`.

- [ ] **Step 6: Commit**

```bash
cd "Projects/WM Tippspiel 2026"
git add supabase/functions/_shared/espn.ts supabase/functions/_shared/espn.test.ts
git commit -m "feat(sync): shared ESPN feed module with round->stage mapping + tests"
```

---

### Task 2: Fixture-planning logic (`_shared/fixtures.ts`)

Pure decision logic: given ESPN events and the rows already in the DB, decide which knockout pairings to INSERT. No I/O, fully unit-testable.

**Files:**
- Create: `supabase/functions/_shared/fixtures.ts`
- Test: `supabase/functions/_shared/fixtures.test.ts`

**Interfaces:**
- Consumes (from Task 1): `normalize`, `mapTeam`, `type EspnEvent`, `type Stage`.
- Produces (consumed by Task 3):
  - `export interface ExistingMatch { stage: Stage; home_team: string; away_team: string }`
  - `export interface FixtureInsert { stage: Stage; home_team: string; away_team: string; kickoff_at: string }`
  - `export interface FixturePlan { inserts: FixtureInsert[]; skipped_existing: number; not_yet_concrete: Array<{ round: string | null; home: string; away: string }>; unmapped: string[] }`
  - `export function planFixtureInserts(events: EspnEvent[], existing: ExistingMatch[]): FixturePlan`

- [ ] **Step 1: Write the failing test `_shared/fixtures.test.ts`**

```typescript
import { test } from "node:test";
import assert from "node:assert";
import { planFixtureInserts, type ExistingMatch } from "./fixtures.ts";
import { type EspnEvent } from "./espn.ts";

function ev(partial: Partial<EspnEvent>): EspnEvent {
  return {
    round: "round-of-32", stage: "r32", completed: false,
    homeName: "Germany", awayName: "Paraguay",
    homeScore: 0, awayScore: 0, date: "2026-06-29T20:30Z",
    ...partial,
  };
}

test("inserts a concrete knockout pairing not yet in DB", () => {
  const plan = planFixtureInserts([ev({})], []);
  assert.equal(plan.inserts.length, 1);
  assert.deepEqual(plan.inserts[0], {
    stage: "r32", home_team: "Deutschland", away_team: "Paraguay",
    kickoff_at: "2026-06-29T20:30Z",
  });
});

test("skips a pairing already present in DB (idempotent re-run)", () => {
  const existing: ExistingMatch[] = [
    { stage: "r32", home_team: "Deutschland", away_team: "Paraguay" },
  ];
  const plan = planFixtureInserts([ev({})], existing);
  assert.equal(plan.inserts.length, 0);
  assert.equal(plan.skipped_existing, 1);
});

test("matches DB row regardless of home/away orientation", () => {
  const existing: ExistingMatch[] = [
    { stage: "r32", home_team: "Paraguay", away_team: "Deutschland" },
  ];
  const plan = planFixtureInserts([ev({})], existing);
  assert.equal(plan.inserts.length, 0);
  assert.equal(plan.skipped_existing, 1);
});

test("ignores group-stage events", () => {
  const plan = planFixtureInserts([ev({ stage: null, round: "group-stage" })], []);
  assert.equal(plan.inserts.length, 0);
  assert.equal(plan.skipped_existing, 0);
});

test("TBD/unmapped team is not_yet_concrete, never inserted", () => {
  const plan = planFixtureInserts(
    [ev({ stage: "r16", round: "round-of-16", homeName: "Winner Group A", awayName: "Germany" })],
    [],
  );
  assert.equal(plan.inserts.length, 0);
  assert.equal(plan.not_yet_concrete.length, 1);
  assert.deepEqual(plan.unmapped, ["Winner Group A"]);
});

test("missing kickoff date -> not_yet_concrete (NOT NULL guard)", () => {
  const plan = planFixtureInserts([ev({ date: null })], []);
  assert.equal(plan.inserts.length, 0);
  assert.equal(plan.not_yet_concrete.length, 1);
});

test("dedups identical pairings within one feed", () => {
  const plan = planFixtureInserts([ev({}), ev({})], []);
  assert.equal(plan.inserts.length, 1);
});
```

- [ ] **Step 2: Run the test, expect FAIL**

Run: `cd "Projects/WM Tippspiel 2026" && node --test supabase/functions/_shared/fixtures.test.ts`
Expected: FAIL — `Cannot find module './fixtures.ts'`.

- [ ] **Step 3: Write `_shared/fixtures.ts`**

```typescript
// supabase/functions/_shared/fixtures.ts
//
// Pure decision logic for sync-fixtures: which knockout pairings to INSERT,
// given the ESPN events and the matches already in the DB. No I/O.

import { normalize, mapTeam, type EspnEvent, type Stage } from "./espn.ts";

export interface ExistingMatch {
  stage: Stage;
  home_team: string;
  away_team: string;
}

export interface FixtureInsert {
  stage: Stage;
  home_team: string;
  away_team: string;
  kickoff_at: string;
}

export interface FixturePlan {
  inserts: FixtureInsert[];
  skipped_existing: number;
  not_yet_concrete: Array<{ round: string | null; home: string; away: string }>;
  unmapped: string[];
}

const KNOCKOUT: ReadonlySet<Stage> = new Set<Stage>([
  "r32", "r16", "qf", "sf", "third_place", "final",
]);

// Stable key: stage + sorted normalized team pair. Order-independent so a row
// stored as (A vs B) still matches an ESPN event reported as (B vs A).
function pairKey(stage: Stage, a: string, b: string): string {
  return stage + "|" + [normalize(a), normalize(b)].sort().join("|");
}

export function planFixtureInserts(
  events: EspnEvent[],
  existing: ExistingMatch[],
): FixturePlan {
  const plan: FixturePlan = {
    inserts: [], skipped_existing: 0, not_yet_concrete: [], unmapped: [],
  };

  // Seed the "seen" set with knockout rows already in the DB -> idempotent re-runs.
  const seen = new Set<string>();
  for (const m of existing) {
    if (KNOCKOUT.has(m.stage)) seen.add(pairKey(m.stage, m.home_team, m.away_team));
  }

  for (const e of events) {
    if (!e.stage || !KNOCKOUT.has(e.stage)) continue; // knockout rounds only

    const deHome = mapTeam(e.homeName);
    const deAway = mapTeam(e.awayName);
    if (!deHome || !deAway) {
      if (!deHome && !plan.unmapped.includes(e.homeName)) plan.unmapped.push(e.homeName);
      if (!deAway && !plan.unmapped.includes(e.awayName)) plan.unmapped.push(e.awayName);
      plan.not_yet_concrete.push({ round: e.round, home: e.homeName, away: e.awayName });
      continue;
    }
    if (!e.date) { // mapped teams but no kickoff -> can't satisfy NOT NULL column
      plan.not_yet_concrete.push({ round: e.round, home: e.homeName, away: e.awayName });
      continue;
    }

    const key = pairKey(e.stage, deHome, deAway);
    if (seen.has(key)) { plan.skipped_existing++; continue; }
    seen.add(key); // guard against duplicate events within one feed
    plan.inserts.push({
      stage: e.stage,
      home_team: deHome,
      away_team: deAway,
      kickoff_at: e.date,
    });
  }
  return plan;
}
```

- [ ] **Step 4: Run the test, expect PASS**

Run: `cd "Projects/WM Tippspiel 2026" && node --test supabase/functions/_shared/fixtures.test.ts`
Expected: PASS — `# pass 7`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd "Projects/WM Tippspiel 2026"
git add supabase/functions/_shared/fixtures.ts supabase/functions/_shared/fixtures.test.ts
git commit -m "feat(sync): pure planFixtureInserts logic with dedup + tests"
```

---

### Task 3: `sync-fixtures` Edge Function + deploy + IMMEDIATE FIX

Wraps the pure logic with the ESPN fetch and DB I/O. Supports `?dry=true`. Deploying and invoking it inserts today's 16 R32 pairings (the immediate fix).

**Files:**
- Create: `supabase/functions/sync-fixtures/index.ts`

**Interfaces:**
- Consumes (from Tasks 1, 2): `fetchEspnEvents`, `planFixtureInserts`, `type ExistingMatch`.
- Produces: HTTP endpoint returning the FixturePlan-derived JSON summary.

- [ ] **Step 1: Write `supabase/functions/sync-fixtures/index.ts`**

```typescript
// supabase/functions/sync-fixtures/index.ts
//
// Inserts FIFA World Cup 2026 KNOCKOUT pairings (R32..Final) into `matches` as
// soon as ESPN publishes them with concrete teams. Mirror of sync-scores, but
// INSERT-only: it never updates or deletes. Each row becomes bettable
// immediately (the tippen page lists every match with kickoff_at > now()).
//
// Data source: ESPN keyless fifa.world scoreboard (same feed as sync-scores).
// TBD bracket slots map to no team -> reported as not_yet_concrete and inserted
// on a later run once the round resolves. Dedup by (stage, sorted team pair).
//
// ── Deploy ──────────────────────────────────────────────────────────────────
//   set -a && source .env.local && set +a
//   npx supabase functions deploy sync-fixtures --project-ref wmoqthevlthvfeazdqlh
//
// ── Manual trigger (dry-run shows what WOULD be inserted, writes nothing) ─────
//   curl -X POST 'https://wmoqthevlthvfeazdqlh.supabase.co/functions/v1/sync-fixtures?dry=true' \
//     -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -H "Content-Type: application/json"
// ──────────────────────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchEspnEvents } from "../_shared/espn.ts";
import { planFixtureInserts, type ExistingMatch } from "../_shared/fixtures.ts";

Deno.serve(async (req: Request) => {
  const dry = new URL(req.url).searchParams.get("dry");
  const isDry = dry === "true" || dry === "1";

  const summary = {
    ok: true,
    source: "espn:fifa.world",
    dry: isDry,
    knockout_events: 0,
    inserted: [] as Array<{ stage: string; home: string; away: string; kickoff_at: string }>,
    skipped_existing: 0,
    not_yet_concrete: [] as Array<{ round: string | null; home: string; away: string }>,
    unmapped: [] as string[],
    errors: [] as string[],
  };

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_KEY) {
      throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (auto-injected env)");
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // 1. Pull all WC events (scheduled + finished) from ESPN.
    const events = await fetchEspnEvents();
    summary.knockout_events = events.filter((e) => e.stage !== null).length;

    // 2. Load existing knockout rows so dedup is idempotent across runs.
    const { data: rows, error: selErr } = await supabase
      .from("matches")
      .select("stage, home_team, away_team")
      .in("stage", ["r32", "r16", "qf", "sf", "third_place", "final"]);
    if (selErr) throw new Error(`DB select failed: ${selErr.message}`);

    // 3. Decide what to insert (pure logic).
    const plan = planFixtureInserts(events, (rows ?? []) as ExistingMatch[]);
    summary.skipped_existing = plan.skipped_existing;
    summary.not_yet_concrete = plan.not_yet_concrete;
    summary.unmapped = plan.unmapped;

    // 4. Insert (unless dry-run).
    if (plan.inserts.length > 0 && !isDry) {
      const { error: insErr } = await supabase.from("matches").insert(plan.inserts);
      if (insErr) throw new Error(`insert failed: ${insErr.message}`);
    }
    summary.inserted = plan.inserts.map((i) => ({
      stage: i.stage, home: i.home_team, away: i.away_team, kickoff_at: i.kickoff_at,
    }));

    console.log("sync-fixtures summary:", JSON.stringify(summary));
    return new Response(JSON.stringify(summary, null, 2), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    summary.ok = false;
    summary.errors.push((e as Error).message);
    console.error("sync-fixtures failed:", JSON.stringify(summary));
    return new Response(JSON.stringify(summary, null, 2), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
```

- [ ] **Step 2: Deploy the function**

```bash
cd "Projects/WM Tippspiel 2026"
set -a && source .env.local && set +a
npx supabase functions deploy sync-fixtures --project-ref wmoqthevlthvfeazdqlh
```
Expected: `Deployed Functions on project wmoqthevlthvfeazdqlh: sync-fixtures`.

- [ ] **Step 3: Dry-run — verify what would be inserted (writes nothing)**

```bash
cd "Projects/WM Tippspiel 2026"
set -a && source .env.local && set +a
curl -s -X POST 'https://wmoqthevlthvfeazdqlh.supabase.co/functions/v1/sync-fixtures?dry=true' \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -H "Content-Type: application/json"
```
Expected: `"dry": true`, `"inserted"` lists ~16 R32 pairings with German names (incl. `Deutschland` vs `Paraguay`), `"unmapped": []`, and R16+ TBD entries under `not_yet_concrete`. **Manually eyeball every inserted pairing and German spelling before proceeding.** If any real team is in `unmapped`, stop and add it to `TEAM_MAP` in Task 1 first.

- [ ] **Step 4: Real run — insert the R32 pairings (THE IMMEDIATE FIX)**

```bash
cd "Projects/WM Tippspiel 2026"
set -a && source .env.local && set +a
curl -s -X POST 'https://wmoqthevlthvfeazdqlh.supabase.co/functions/v1/sync-fixtures' \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -H "Content-Type: application/json"
```
Expected: `"dry": false`, `"inserted"` has the R32 pairings.

- [ ] **Step 5: Verify idempotency — run again, expect zero new inserts**

Re-run the exact command from Step 4.
Expected: `"inserted": []`, `"skipped_existing"` ≈ 16.

- [ ] **Step 6: Verify in the app** — open `/tippen` as a logged-in user. Deutschland–Paraguay and the other R32 matches appear and are tippable. (No code change; this confirms the insert path end-to-end.)

- [ ] **Step 7: Commit**

```bash
cd "Projects/WM Tippspiel 2026"
git add supabase/functions/sync-fixtures/index.ts
git commit -m "feat(sync): sync-fixtures function inserts knockout pairings (dry-run supported)"
```

---

### Task 4: Knockout news banner (UI)

Server computes a round signature; a client component shows a dismissible top-right card, re-appearing once per new round.

**Files:**
- Create: `src/components/knockout-banner.tsx`
- Modify: `src/app/(authed)/layout.tsx`

**Interfaces:**
- Produces: `export function KnockoutBanner({ signature }: { signature: string }): JSX.Element | null`
- Consumes: signature string computed in the authed layout.

- [ ] **Step 1: Create `src/components/knockout-banner.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

const DISMISS_KEY = "ko-bets-dismissed";

/**
 * Top-right news card: "new knockout bets are open". Dismiss is stored per
 * device in localStorage, keyed by the current round signature. When a new
 * knockout round opens the signature changes and the banner returns once.
 * Renders nothing on the server (no hydration mismatch) and when there are no
 * open knockout matches (empty signature).
 */
export function KnockoutBanner({ signature }: { signature: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!signature) { setShow(false); return; }
    setShow(localStorage.getItem(DISMISS_KEY) !== signature);
  }, [signature]);

  if (!show) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, signature);
    setShow(false);
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-xs">
      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
        <Link
          href="/tippen"
          onClick={dismiss}
          className="text-sm font-medium leading-snug text-night"
        >
          🏆 Neu: K.-o.-Wetten sind offen. Jetzt tippen!
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Schließen"
          className="shrink-0 text-slate-400 transition-colors hover:text-night"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire the signature query into `src/app/(authed)/layout.tsx`**

Add the import near the top (next to the BottomNav import):

```tsx
import { KnockoutBanner } from "@/components/knockout-banner";
```

After the profile/onboarding redirect block (after the `if (!profile || ...) redirect("/willkommen");` line, before `return`), add:

```tsx
  // Round signature for the knockout news banner: distinct open knockout stages.
  const { data: koMatches } = await supabase
    .from("matches")
    .select("stage")
    .gt("kickoff_at", new Date().toISOString())
    .in("stage", ["r32", "r16", "qf", "sf", "third_place", "final"]);
  const koSignature = [...new Set((koMatches ?? []).map((m) => m.stage))]
    .sort()
    .join(",");
```

Then change the returned JSX so the banner renders inside the shell. Replace:

```tsx
  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 pb-20">{children}</main>
      <BottomNav />
    </div>
  );
```

with:

```tsx
  return (
    <div className="flex flex-col min-h-screen">
      <KnockoutBanner signature={koSignature} />
      <main className="flex-1 pb-20">{children}</main>
      <BottomNav />
    </div>
  );
```

- [ ] **Step 3: Lint + type-check via build**

Run: `cd "Projects/WM Tippspiel 2026" && npm run lint && npm run build`
Expected: lint clean, build succeeds (no TS errors in the new component or layout).

- [ ] **Step 4: Manual UI verification**

Run `npm run dev`, open an authed page. Expected: banner top-right. Click the X — it disappears. Reload — it stays gone (same signature in localStorage). In devtools, run `localStorage.removeItem("ko-bets-dismissed")` and reload — it reappears.

- [ ] **Step 5: Commit**

```bash
cd "Projects/WM Tippspiel 2026"
git add src/components/knockout-banner.tsx "src/app/(authed)/layout.tsx"
git commit -m "feat(ui): dismissible knockout-bets news banner, re-shows per new round"
```

---

### Task 5: pg_cron schedule (`0012_cron_sync_fixtures.sql`)

Mirrors 0010 to run `sync-fixtures` every 30 min. Reuses the existing Vault secret. Applied via the Management API.

**Files:**
- Create: `supabase/migrations/0012_cron_sync_fixtures.sql`

- [ ] **Step 1: Write `supabase/migrations/0012_cron_sync_fixtures.sql`**

```sql
-- 0012_cron_sync_fixtures.sql
-- Schedules the `sync-fixtures` Edge Function every 30 min via pg_cron + pg_net,
-- to auto-insert knockout pairings (R32..Final) as ESPN publishes them.
-- Mirror of 0010_cron_sync_scores.sql. Re-runnable. Contains NO secrets — the
-- service-role bearer is read from Vault at call time.
--
-- Reuses the EXISTING Vault secret `sync_scores_service_role_key` (created for
-- 0010). No new secret needed.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

do $$
begin
  perform cron.unschedule('sync-wm-fixtures');
exception
  when others then null; -- job did not exist yet
end $$;

select cron.schedule(
  'sync-wm-fixtures',
  '*/30 * * * *',
  $cron$
  select net.http_post(
    url     := 'https://wmoqthevlthvfeazdqlh.supabase.co/functions/v1/sync-fixtures',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'sync_scores_service_role_key'
      ),
      'Content-Type', 'application/json'
    ),
    body    := '{}'::jsonb
  );
  $cron$
);
```

- [ ] **Step 2: Apply the migration via the Management API**

```bash
cd "Projects/WM Tippspiel 2026"
set -a && source .env.local && set +a
curl -s -X POST "https://api.supabase.com/v1/projects/wmoqthevlthvfeazdqlh/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data "$(jq -Rs '{query: .}' supabase/migrations/0012_cron_sync_fixtures.sql)"
```
Expected: a JSON array response with no `error` field (an empty `[]` or success rows).

- [ ] **Step 3: Verify the cron job is registered**

```bash
cd "Projects/WM Tippspiel 2026"
set -a && source .env.local && set +a
curl -s -X POST "https://api.supabase.com/v1/projects/wmoqthevlthvfeazdqlh/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  --data '{"query":"select jobname, schedule, active from cron.job where jobname = '"'"'sync-wm-fixtures'"'"';"}'
```
Expected: one row — `sync-wm-fixtures`, `*/30 * * * *`, `active=true`.

- [ ] **Step 4: Commit**

```bash
cd "Projects/WM Tippspiel 2026"
git add supabase/migrations/0012_cron_sync_fixtures.sql
git commit -m "feat(sync): pg_cron schedule for sync-fixtures (every 30 min)"
```

---

### Task 6: Refactor `sync-scores` onto the shared module (DRY cleanup)

Final, lowest-urgency step. Removes the duplicated TEAM_MAP/normalize/parseEspn from `sync-scores` and routes it through `_shared/espn.ts`. Behavior must be identical — verified by a live invoke.

**Files:**
- Modify: `supabase/functions/sync-scores/index.ts`

**Interfaces:**
- Consumes (from Task 1): `fetchEspnEvents`, `normalize`, `type EspnEvent`.

- [ ] **Step 1: Capture a baseline** — invoke the CURRENT (pre-refactor) function and save its summary for comparison.

```bash
cd "Projects/WM Tippspiel 2026"
set -a && source .env.local && set +a
curl -s -X POST 'https://wmoqthevlthvfeazdqlh.supabase.co/functions/v1/sync-scores' \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -H "Content-Type: application/json" \
  > /tmp/sync-scores-before.json
cat /tmp/sync-scores-before.json
```
Note the `updated`, `skipped_already_set`, `unmatched_in_db`, `unmapped` values.

- [ ] **Step 2: Refactor `sync-scores/index.ts`**

Delete the now-duplicated inline blocks (current `ESPN_URL`, `TEAM_MAP`, `normalize`, `mapTeam`, the `DbMatch`/`FinishedMatch` interfaces, and `parseEspn`). Replace the top imports and the fetch/parse section.

Change the imports at the top to:

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchEspnEvents, normalize } from "../_shared/espn.ts";
```

Replace the old fetch + `parseEspn` step (currently steps "1." inside `Deno.serve`, the `espnRes` fetch through `const finished = parseEspn(...)`) with:

```typescript
    // 1. Fetch all WC events, keep only finished ones with both scores.
    const finished = (await fetchEspnEvents())
      .filter((e) => e.completed && e.homeScore !== null && e.awayScore !== null)
      .map((e) => ({
        homeName: e.homeName,
        awayName: e.awayName,
        homeScore: e.homeScore as number,
        awayScore: e.awayScore as number,
        date: e.date,
      }));
    summary.finished_matches = finished.length;
```

The rest of the function (the DB select, the `pairKey`/index build, the update loop using `normalize` and `mapTeam`) stays — but `mapTeam` is now imported. Update the `mapTeam` call site: it currently calls a local `mapTeam`; add `mapTeam` to the import line:

```typescript
import { fetchEspnEvents, normalize, mapTeam } from "../_shared/espn.ts";
```

Keep the local `DbMatch` interface ONLY if the update loop references it; if so, leave that single interface in place (it describes a DB row, not ESPN data).

- [ ] **Step 3: Deploy**

```bash
cd "Projects/WM Tippspiel 2026"
set -a && source .env.local && set +a
npx supabase functions deploy sync-scores --project-ref wmoqthevlthvfeazdqlh
```
Expected: `Deployed Functions on project wmoqthevlthvfeazdqlh: sync-scores`.

- [ ] **Step 4: Verify behavior unchanged**

```bash
cd "Projects/WM Tippspiel 2026"
set -a && source .env.local && set +a
curl -s -X POST 'https://wmoqthevlthvfeazdqlh.supabase.co/functions/v1/sync-scores' \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -H "Content-Type: application/json" \
  > /tmp/sync-scores-after.json
cat /tmp/sync-scores-after.json
```
Expected: `finished_matches`, `unmapped`, and `unmatched_in_db` match the baseline from Step 1 (the second live run will show `updated: []` / higher `skipped_already_set` because Step 1 already wrote the scores — that is correct, not a regression). The key invariant: `finished_matches` count and `unmapped` list are identical.

- [ ] **Step 5: Commit**

```bash
cd "Projects/WM Tippspiel 2026"
git add supabase/functions/sync-scores/index.ts
git commit -m "refactor(sync): route sync-scores through shared ESPN module (DRY)"
```

---

## Self-Review

**Spec coverage:**
- Auto-insert knockout pairings (R32→Final) → Tasks 1–3. ✓
- Immediate fix today (R32, incl. Deutschland–Paraguay) → Task 3 Steps 3–6. ✓
- Fully automatic ongoing (cron) → Task 5. ✓
- Progressive bracket resolution (TBD skipped, inserted later) → Task 2 `not_yet_concrete` logic + Task 5 cron. ✓
- Dry-run safety → Task 3 (`?dry=true`). ✓
- Stage mapping r32..final → Task 1 `mapRoundToStage`. ✓
- Insert-only, never overwrite → Task 3 (insert only). ✓
- Shared module / DRY + sync-scores onto it → Tasks 1, 6. ✓
- News banner top-right, dismissible, per-round re-show → Task 4. ✓
- Reuse Vault secret, Management API for migration → Task 5. ✓
- Betting logic / scoring / lock / reveal unchanged → no task touches them (by design). ✓

**Placeholder scan:** No TBD/TODO/"handle errors" placeholders. The only "copy verbatim" references (Task 1 ESPN_URL/TEAM_MAP/normalize) cite exact source lines in `sync-scores/index.ts` — real code, not invention.

**Type consistency:** `EspnEvent`, `Stage`, `ExistingMatch`, `FixtureInsert`, `FixturePlan`, `planFixtureInserts`, `fetchEspnEvents`, `mapTeam`, `mapRoundToStage`, `normalize` are named identically across Tasks 1→6. Banner prop `signature: string` matches the layout's `koSignature`.
