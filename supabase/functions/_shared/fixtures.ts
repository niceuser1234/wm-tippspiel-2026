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
