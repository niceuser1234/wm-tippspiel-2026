// =============================================================================
// scripts/reset-bets.ts — Wettzeitraum zurücksetzen + Usertipps löschen
//
// Verwendung: npx tsx scripts/reset-bets.ts
//
// Was passiert:
//   1. Alle special_bets: lock_at → NEW_LOCK_AT
//   2. Tipps von JONATHAN_EMAIL: match_tips + special_bet_tips löschen
// =============================================================================

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('FEHLER: NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlt');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// 14.06.2026 19:00 MESZ = 17:00 UTC (= Anpfiff Deutschland–Curaçao)
const NEW_LOCK_AT = '2026-06-14T17:00:00Z';
const JONATHAN_EMAIL = 'jonathanhaberstroh@gmail.com';

async function main() {
  console.log('WM 2026 Tippspiel — Reset-Skript');
  console.log(`Ziel: ${supabaseUrl}\n`);

  // -------------------------------------------------------------------------
  // 1. Alle Sonderwetten-Sperrzeiten aktualisieren
  // -------------------------------------------------------------------------
  console.log('--- Sonderwetten lock_at ---');
  const { data: updatedBets, error: betError } = await supabase
    .from('special_bets')
    .update({ lock_at: NEW_LOCK_AT })
    .gt('lock_at', '2000-01-01')
    .select('title');

  if (betError) {
    throw new Error(`Fehler beim Updaten von special_bets: ${betError.message}`);
  }

  console.log(`  ${(updatedBets ?? []).length} Sonderwetten auf ${NEW_LOCK_AT} gesetzt.`);
  for (const b of updatedBets ?? []) {
    console.log(`    · ${b.title}`);
  }

  // -------------------------------------------------------------------------
  // 2. Jonathan's User-ID via Admin-API ermitteln
  // -------------------------------------------------------------------------
  console.log('\n--- User ---');
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw new Error(`Fehler bei listUsers: ${listError.message}`);

  const jonathan = listData.users.find((u) => u.email === JONATHAN_EMAIL);
  if (!jonathan) {
    console.error(`  User "${JONATHAN_EMAIL}" nicht gefunden.`);
    process.exit(1);
  }
  console.log(`  Gefunden: ${jonathan.id} (${jonathan.email})`);

  // -------------------------------------------------------------------------
  // 3. match_tips löschen
  // -------------------------------------------------------------------------
  console.log('\n--- match_tips ---');
  const { error: matchTipError, count: matchCount } = await supabase
    .from('match_tips')
    .delete({ count: 'exact' })
    .eq('user_id', jonathan.id);

  if (matchTipError) throw new Error(`Fehler beim Löschen von match_tips: ${matchTipError.message}`);
  console.log(`  ${matchCount ?? 0} match_tip(s) gelöscht.`);

  // -------------------------------------------------------------------------
  // 4. special_bet_tips löschen
  // -------------------------------------------------------------------------
  console.log('\n--- special_bet_tips ---');
  const { error: betTipError, count: betCount } = await supabase
    .from('special_bet_tips')
    .delete({ count: 'exact' })
    .eq('user_id', jonathan.id);

  if (betTipError) throw new Error(`Fehler beim Löschen von special_bet_tips: ${betTipError.message}`);
  console.log(`  ${betCount ?? 0} special_bet_tip(s) gelöscht.`);

  console.log('\nReset abgeschlossen.');
}

main().catch((err) => {
  console.error('\nReset fehlgeschlagen:', err);
  process.exit(1);
});
