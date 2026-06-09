// =============================================================================
// scripts/seed.ts — Idempotentes Seed-Skript für WM 2026 Tippspiel
//
// Verwendung: npx tsx scripts/seed.ts
// Voraussetzungen: .env.local mit NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY
//
// Idempotenz:
//   matches:      Deduplizierung per (home_team, away_team, kickoff_at)
//   special_bets: Deduplizierung per title
// =============================================================================

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { matches, type MatchSeed } from '../seed/matches';
import { specialBets, type SpecialBetSeed } from '../seed/special-bets';

// .env.local aus Projekt-Root laden
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// ---------------------------------------------------------------------------
// Env-Vars validieren
// ---------------------------------------------------------------------------
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('FEHLER: NEXT_PUBLIC_SUPABASE_URL fehlt in .env.local');
  process.exit(1);
}
if (!serviceRoleKey) {
  console.error('FEHLER: SUPABASE_SERVICE_ROLE_KEY fehlt in .env.local');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Supabase-Client mit Service-Role-Key (umgeht RLS — nur für Seeding!)
// ---------------------------------------------------------------------------
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// ---------------------------------------------------------------------------
// Matches seeden
// ---------------------------------------------------------------------------
async function seedMatches(): Promise<void> {
  console.log('\n--- Matches ---');

  // Bestehende Matches laden
  const { data: existing, error: fetchError } = await supabase
    .from('matches')
    .select('home_team, away_team, kickoff_at');

  if (fetchError) {
    throw new Error(`Fehler beim Laden bestehender Matches: ${fetchError.message}`);
  }

  // Set für schnelle Deduplizierung. kickoff_at über Date normalisieren —
  // Postgres formatiert timestamptz anders als der ISO-String im Seed,
  // reiner String-Vergleich würde bei jedem Lauf Duplikate anlegen.
  const key = (m: { home_team: string; away_team: string; kickoff_at: string }) =>
    `${m.home_team}|${m.away_team}|${new Date(m.kickoff_at).getTime()}`;

  const existingKeys = new Set((existing ?? []).map(key));

  const toInsert: MatchSeed[] = matches.filter((m) => !existingKeys.has(key(m)));

  if (toInsert.length === 0) {
    console.log(`  Alle ${matches.length} Matches bereits vorhanden — übersprungen.`);
    return;
  }

  const { error: insertError } = await supabase.from('matches').insert(toInsert);

  if (insertError) {
    throw new Error(`Fehler beim Einfügen von Matches: ${insertError.message}`);
  }

  const skipped = matches.length - toInsert.length;
  console.log(`  ${toInsert.length} Match(es) angelegt, ${skipped} übersprungen.`);
  for (const m of toInsert) {
    console.log(`    + ${m.home_team} vs. ${m.away_team} (${m.kickoff_at})`);
  }
}

// ---------------------------------------------------------------------------
// Special Bets seeden
// ---------------------------------------------------------------------------
async function seedSpecialBets(): Promise<void> {
  console.log('\n--- Sonderwetten ---');

  // Bestehende Special Bets laden
  const { data: existing, error: fetchError } = await supabase
    .from('special_bets')
    .select('title');

  if (fetchError) {
    throw new Error(`Fehler beim Laden bestehender Sonderwetten: ${fetchError.message}`);
  }

  const existingTitles = new Set((existing ?? []).map((sb) => sb.title));

  const toInsert: Array<{
    title: string;
    bet_type: SpecialBetSeed['bet_type'];
    options: string[] | null;
    points_value: number;
    lock_at: string;
  }> = specialBets
    .filter((sb) => !existingTitles.has(sb.title))
    .map((sb) => ({
      title: sb.title,
      bet_type: sb.bet_type,
      options: sb.options,
      points_value: sb.points_value,
      lock_at: sb.lock_at,
    }));

  if (toInsert.length === 0) {
    console.log(`  Alle ${specialBets.length} Sonderwetten bereits vorhanden — übersprungen.`);
    return;
  }

  const { error: insertError } = await supabase
    .from('special_bets')
    .insert(toInsert);

  if (insertError) {
    throw new Error(`Fehler beim Einfügen von Sonderwetten: ${insertError.message}`);
  }

  const skipped = specialBets.length - toInsert.length;
  console.log(`  ${toInsert.length} Sonderwette(n) angelegt, ${skipped} übersprungen.`);
  for (const sb of toInsert) {
    console.log(`    + "${sb.title}" (${sb.bet_type}, ${sb.points_value} Pkt.)`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  console.log('WM 2026 Tippspiel — Seed-Skript');
  console.log(`Ziel: ${supabaseUrl}`);

  await seedMatches();
  await seedSpecialBets();

  console.log('\nSeed abgeschlossen.');
}

main().catch((err) => {
  console.error('\nSeed fehlgeschlagen:', err);
  process.exit(1);
});
