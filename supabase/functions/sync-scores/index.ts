// supabase/functions/sync-scores/index.ts
//
// Syncs finished FIFA World Cup 2026 match scores into the `matches` table.
// Runs entirely inside Supabase (invoked by the pg_cron job in migration 0010
// every 30 min). Uses the auto-injected service-role key to bypass RLS for
// writes. Only fills rows where home_score IS NULL — never overwrites a manual
// correction.
//
// Data source: ESPN's public scoreboard JSON for the FIFA World Cup, via the
// shared `_shared/espn.ts` helpers (also used by sync-fixtures). `competitor.score`
// is the final result incl. extra time; penalty shootouts are reported separately
// (shootoutScore) and intentionally NOT added, so a match decided on penalties
// syncs as the level post-ET score.
//
// ── Deploy ────────────────────────────────────────────────────────────────────
//   set -a && source .env.local && set +a
//   npx supabase functions deploy sync-scores --project-ref wmoqthevlthvfeazdqlh
//
// ── Manual test trigger ───────────────────────────────────────────────────────
//   curl -X POST 'https://wmoqthevlthvfeazdqlh.supabase.co/functions/v1/sync-scores' \
//     -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
//     -H "Content-Type: application/json"
// ──────────────────────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchEspnEvents, normalize, mapTeam } from "../_shared/espn.ts";

interface DbMatch {
  id: string;
  stage: string | null;
  home_team: string;
  away_team: string;
  kickoff_at: string | null;
}

Deno.serve(async (_req: Request) => {
  const summary = {
    ok: true,
    source: "espn:fifa.world",
    finished_matches: 0,
    updated: [] as Array<{ id: string; home: string; away: string; score: string }>,
    skipped_already_set: 0,
    unmatched_in_db: [] as Array<{ home: string; away: string; score: string }>,
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

    // 1. Fetch all WC events from ESPN, keep only finished ones with both scores.
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

    // 2. Load all unplayed DB rows once and index by sorted normalized team pair.
    const { data: rows, error: selErr } = await supabase
      .from("matches")
      .select("id, stage, home_team, away_team, kickoff_at")
      .is("home_score", null);
    if (selErr) throw new Error(`DB select failed: ${selErr.message}`);

    const pairKey = (a: string, b: string) =>
      [normalize(a), normalize(b)].sort().join("|");

    const index = new Map<string, DbMatch[]>();
    for (const r of (rows ?? []) as DbMatch[]) {
      const k = pairKey(r.home_team, r.away_team);
      const list = index.get(k) ?? [];
      list.push(r);
      index.set(k, list);
    }

    // 3. Walk finished matches, map names, match a DB row, and update.
    for (const fx of finished) {
      const deHome = mapTeam(fx.homeName);
      const deAway = mapTeam(fx.awayName);
      if (!deHome && !summary.unmapped.includes(fx.homeName)) summary.unmapped.push(fx.homeName);
      if (!deAway && !summary.unmapped.includes(fx.awayName)) summary.unmapped.push(fx.awayName);
      if (!deHome || !deAway) continue;

      const k = pairKey(deHome, deAway);
      const candidates = index.get(k);
      if (!candidates || candidates.length === 0) {
        // No unplayed DB row for this pairing (already set, or not in our bracket).
        summary.unmatched_in_db.push({ home: deHome, away: deAway, score: `${fx.homeScore}:${fx.awayScore}` });
        continue;
      }

      // If >1 candidate (same pair across stages later), pick the one whose
      // kickoff is closest to the match date.
      let pick = candidates[0];
      if (candidates.length > 1 && fx.date) {
        const t = new Date(fx.date).getTime();
        pick = candidates.reduce((best, c) => {
          const db = c.kickoff_at ? Math.abs(new Date(c.kickoff_at).getTime() - t) : Infinity;
          const bb = best.kickoff_at ? Math.abs(new Date(best.kickoff_at).getTime() - t) : Infinity;
          return db < bb ? c : best;
        }, candidates[0]);
      }

      // Orientation: assign goals to the DB column matching ESPN's home team.
      const dbHomeIsEspnHome = normalize(pick.home_team) === normalize(deHome);
      const homeScore = dbHomeIsEspnHome ? fx.homeScore : fx.awayScore;
      const awayScore = dbHomeIsEspnHome ? fx.awayScore : fx.homeScore;

      const { data: upd, error: updErr } = await supabase
        .from("matches")
        .update({ home_score: homeScore, away_score: awayScore })
        .eq("id", pick.id)
        .is("home_score", null) // idempotency guard: never overwrite a set score
        .select("id");

      if (updErr) {
        summary.errors.push(`update ${pick.id} (${deHome} v ${deAway}): ${updErr.message}`);
        continue;
      }
      if (upd && upd.length > 0) {
        summary.updated.push({
          id: pick.id,
          home: pick.home_team,
          away: pick.away_team,
          score: `${homeScore}:${awayScore}`,
        });
        const remaining = candidates.filter((c) => c.id !== pick.id);
        if (remaining.length) index.set(k, remaining); else index.delete(k);
      } else {
        summary.skipped_already_set++;
      }
    }

    console.log("sync-scores summary:", JSON.stringify(summary));
    return new Response(JSON.stringify(summary, null, 2), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    summary.ok = false;
    summary.errors.push((e as Error).message);
    console.error("sync-scores failed:", JSON.stringify(summary));
    return new Response(JSON.stringify(summary, null, 2), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
