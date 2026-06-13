// =============================================================================
// scripts/sync-bets.ts — Live-DB an seed/special-bets.ts angleichen
//
// Verwendung: npx tsx scripts/sync-bets.ts
//
// Was passiert (idempotent):
//   1. Entfernt "Deutschland – Aus in welcher Runde?" (inkl. abgegebener Tipps)
//   2. Fügt alle Wetten aus dem Seed ein, die per Titel noch fehlen
//   3. Gleicht points_value bestehender Wetten an den Seed an
//      (z.B. Gruppensieger Gruppe E: 5 → 3)
// =============================================================================

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { specialBets } from '../seed/special-bets';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('FEHLER: NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlt');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const OBSOLETE_TITLES = ['Deutschland – Aus in welcher Runde?'];

async function main() {
  console.log('WM 2026 — Sonderwetten-Sync');
  console.log(`Ziel: ${supabaseUrl}\n`);

  // -------------------------------------------------------------------------
  // 1. Obsolete Wetten entfernen (erst Tipps, dann Wette)
  // -------------------------------------------------------------------------
  console.log('--- Entfernen ---');
  for (const title of OBSOLETE_TITLES) {
    const { data: bet } = await supabase
      .from('special_bets')
      .select('id, title')
      .eq('title', title)
      .maybeSingle();

    if (!bet) {
      console.log(`  · "${title}" nicht vorhanden — übersprungen`);
      continue;
    }

    const { count: tipCount } = await supabase
      .from('special_bet_tips')
      .delete({ count: 'exact' })
      .eq('special_bet_id', bet.id);

    const { error: delErr } = await supabase
      .from('special_bets')
      .delete()
      .eq('id', bet.id);
    if (delErr) throw new Error(`Löschen "${title}": ${delErr.message}`);

    console.log(`  ✓ "${title}" gelöscht (${tipCount ?? 0} Tipps mit entfernt)`);
  }

  // -------------------------------------------------------------------------
  // 2. Bestehende Wetten laden
  // -------------------------------------------------------------------------
  const { data: existing, error: fetchErr } = await supabase
    .from('special_bets')
    .select('id, title, points_value');
  if (fetchErr) throw new Error(`Laden bestehender Wetten: ${fetchErr.message}`);

  const byTitle = new Map((existing ?? []).map((b) => [b.title, b]));

  // -------------------------------------------------------------------------
  // 3. Fehlende Wetten einfügen
  // -------------------------------------------------------------------------
  console.log('\n--- Einfügen ---');
  const toInsert = specialBets
    .filter((sb) => !byTitle.has(sb.title))
    .map((sb) => ({
      title: sb.title,
      bet_type: sb.bet_type,
      options: sb.options,
      points_value: sb.points_value,
      lock_at: sb.lock_at,
    }));

  if (toInsert.length === 0) {
    console.log('  · Nichts einzufügen — alle Titel vorhanden');
  } else {
    const { error: insErr } = await supabase.from('special_bets').insert(toInsert);
    if (insErr) throw new Error(`Einfügen: ${insErr.message}`);
    console.log(`  ✓ ${toInsert.length} Wette(n) angelegt:`);
    for (const b of toInsert) console.log(`      + "${b.title}" (${b.points_value} Pkt.)`);
  }

  // -------------------------------------------------------------------------
  // 4. points_value bestehender Wetten angleichen
  // -------------------------------------------------------------------------
  console.log('\n--- Punkte angleichen ---');
  let updated = 0;
  for (const sb of specialBets) {
    const cur = byTitle.get(sb.title);
    if (!cur) continue; // war gerade neu eingefügt
    if (cur.points_value !== sb.points_value) {
      const { error: updErr } = await supabase
        .from('special_bets')
        .update({ points_value: sb.points_value })
        .eq('id', cur.id);
      if (updErr) throw new Error(`Update "${sb.title}": ${updErr.message}`);
      console.log(`  ✓ "${sb.title}": ${cur.points_value} → ${sb.points_value} Pkt.`);
      updated++;
    }
  }
  if (updated === 0) console.log('  · Keine Punkt-Änderungen nötig');

  console.log('\nSync abgeschlossen.');
}

main().catch((err) => {
  console.error('\nSync fehlgeschlagen:', err.message);
  process.exit(1);
});
