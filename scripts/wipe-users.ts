// =============================================================================
// scripts/wipe-users.ts — Frischer Stand: alle Teilnehmer-Daten löschen
//
// Verwendung: npx tsx scripts/wipe-users.ts
//
// Löscht:
//   - alle special_bet_tips
//   - alle match_tips
//   - alle profiles
//   - alle auth.users
//   - alle Dateien im Storage-Bucket "avatars"
//
// NICHT angetastet: matches, special_bets (Spielstruktur).
// =============================================================================

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

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

// Alle Zeilen einer Tabelle löschen (Dummy-Filter, der immer wahr ist).
async function deleteAll(table: string): Promise<number> {
  const { error, count } = await supabase
    .from(table)
    .delete({ count: 'exact' })
    .not('user_id', 'is', null);
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

async function main() {
  console.log('WM 2026 — Wipe (frischer Stand)');
  console.log(`Ziel: ${supabaseUrl}\n`);

  // -------------------------------------------------------------------------
  // 1. Tipps
  // -------------------------------------------------------------------------
  console.log('--- Tipps ---');
  const sbt = await deleteAll('special_bet_tips');
  console.log(`  ✓ ${sbt} special_bet_tips gelöscht`);
  const mt = await deleteAll('match_tips');
  console.log(`  ✓ ${mt} match_tips gelöscht`);

  // -------------------------------------------------------------------------
  // 2. Storage: avatars-Bucket leeren
  // -------------------------------------------------------------------------
  console.log('\n--- Profilbilder (Storage) ---');
  let removedFiles = 0;
  const { data: folders } = await supabase.storage.from('avatars').list('', {
    limit: 1000,
  });
  for (const folder of folders ?? []) {
    // pro User-Ordner die Dateien sammeln
    const { data: files } = await supabase.storage
      .from('avatars')
      .list(folder.name, { limit: 1000 });
    const paths = (files ?? []).map((f) => `${folder.name}/${f.name}`);
    if (paths.length > 0) {
      const { error } = await supabase.storage.from('avatars').remove(paths);
      if (!error) removedFiles += paths.length;
    }
  }
  console.log(`  ✓ ${removedFiles} Bild-Datei(en) entfernt`);

  // -------------------------------------------------------------------------
  // 3. Auth-User (cascade entfernt zugehörige profiles-Zeile)
  // -------------------------------------------------------------------------
  console.log('\n--- Auth-User ---');
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({
    perPage: 1000,
  });
  if (listErr) throw new Error(`listUsers: ${listErr.message}`);

  let deletedUsers = 0;
  for (const u of list.users) {
    const { error } = await supabase.auth.admin.deleteUser(u.id);
    if (error) {
      console.log(`  ⚠ ${u.email}: ${error.message}`);
    } else {
      deletedUsers++;
    }
  }
  console.log(`  ✓ ${deletedUsers} Auth-User gelöscht`);

  // -------------------------------------------------------------------------
  // 4. Verbliebene profiles (falls kein Cascade) sicher entfernen
  // -------------------------------------------------------------------------
  console.log('\n--- Profile (Rest) ---');
  const { error: profErr, count: profCount } = await supabase
    .from('profiles')
    .delete({ count: 'exact' })
    .not('id', 'is', null);
  if (profErr) {
    console.log(`  ⚠ ${profErr.message}`);
  } else {
    console.log(`  ✓ ${profCount ?? 0} verbliebene profiles gelöscht`);
  }

  // -------------------------------------------------------------------------
  // 5. Kontrolle
  // -------------------------------------------------------------------------
  console.log('\n--- Kontrolle ---');
  for (const t of ['profiles', 'match_tips', 'special_bet_tips']) {
    const { count } = await supabase.from(t).select('*', { count: 'exact', head: true });
    console.log(`  ${t}: ${count ?? 0} Zeilen`);
  }
  const { count: matchCount } = await supabase.from('matches').select('*', { count: 'exact', head: true });
  const { count: betCount } = await supabase.from('special_bets').select('*', { count: 'exact', head: true });
  console.log(`  matches: ${matchCount ?? 0} (unverändert)`);
  console.log(`  special_bets: ${betCount ?? 0} (unverändert)`);

  console.log('\nWipe abgeschlossen — alles frisch.');
}

main().catch((err) => {
  console.error('\nWipe fehlgeschlagen:', err.message);
  process.exit(1);
});
