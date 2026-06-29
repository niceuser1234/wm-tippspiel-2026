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
    skipped_past: 0,
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

    // 3. Decide what to insert (pure logic). Only future-kickoff pairings.
    const plan = planFixtureInserts(events, (rows ?? []) as ExistingMatch[], new Date().toISOString());
    summary.skipped_existing = plan.skipped_existing;
    summary.skipped_past = plan.skipped_past;
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
