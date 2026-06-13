// =============================================================================
// scripts/dev-preview.ts — Dev-Preview: simuliert aufgedeckte Wetten + Rangliste
//
// Verwendung:
//   npx tsx scripts/dev-preview.ts --setup    (Dummy-Daten anlegen)
//   npx tsx scripts/dev-preview.ts --restore  (alles zurücksetzen)
//
// Was --setup macht:
//   • 2 Matches auf gestern setzen + Ergebnis eintragen
//   • 4 Dummy-User anlegen mit realistisch verschiedenen Tipps
//   • Jonathan bekommt ebenfalls Tipps (taucht in Rangliste auf)
//   • 2 Sonderwetten: lock_at → Vergangenheit, correct_answer gesetzt
//   • Alle Dummy-User + Jonathan tippen auf die Sonderwetten
//
// Was --restore macht:
//   • Match-Daten zurücksetzen (Kickoff + Ergebnis)
//   • Sonderwetten zurücksetzen (lock_at + correct_answer)
//   • Alle Tipps von Dummy-Usern + Jonathan löschen
//   • Dummy-Auth-User löschen (cascade → profiles)
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

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

const JONATHAN_EMAIL = 'jonathanhaberstroh@gmail.com';

// Erkennbar an diesen Test-Emails → sicheres Löschen beim Restore
const DUMMY_USERS = [
  { email: 'dev-max@tippspiel.test',  name: 'Max Mustermann' },
  { email: 'dev-lisa@tippspiel.test', name: 'Lisa Schmidt' },
  { email: 'dev-tom@tippspiel.test',  name: 'Tom Fischer' },
  { email: 'dev-anna@tippspiel.test', name: 'Anna Müller' },
];

// Gestern 15:00 UTC — deutlich vor "jetzt", aber nicht verdächtig früh
const YESTERDAY = (() => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  d.setUTCHours(15, 0, 0, 0);
  return d.toISOString();
})();

// Vorgestern 18:00 UTC — 2. simuliertes Spiel
const DAY_BEFORE = (() => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 2);
  d.setUTCHours(18, 0, 0, 0);
  return d.toISOString();
})();

// Sonderwetten, die "aufgedeckt" werden (lock_at vor 3h, Lösung bekannt)
const LOCKED_BETS_PAST = (() => {
  const d = new Date();
  d.setUTCHours(d.getUTCHours() - 3);
  return d.toISOString();
})();

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

function ok(label: string) { console.log(`  ✓ ${label}`); }
function info(label: string) { console.log(`  · ${label}`); }
function section(title: string) { console.log(`\n--- ${title} ---`); }

async function findUserByEmail(email: string) {
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) throw new Error(`listUsers: ${error.message}`);
  return data.users.find((u) => u.email === email) ?? null;
}

// ---------------------------------------------------------------------------
// SETUP
// ---------------------------------------------------------------------------

async function setup() {
  console.log('WM 2026 — Dev-Preview SETUP');
  console.log(`Supabase: ${supabaseUrl}\n`);

  // -------------------------------------------------------------------------
  // 1. Matches in die Vergangenheit setzen + Ergebnis eintragen
  // -------------------------------------------------------------------------
  section('Matches — Kickoff & Ergebnis');

  // Match 1: Deutschland vs Curaçao → Ergebnis 3:1
  const { data: matchGER } = await supabase
    .from('matches')
    .update({ kickoff_at: YESTERDAY, home_score: 3, away_score: 1 })
    .eq('home_team', 'Deutschland')
    .eq('away_team', 'Curaçao')
    .select('id, home_team, away_team')
    .single();
  if (!matchGER) throw new Error('Match Deutschland–Curaçao nicht gefunden');
  ok(`${matchGER.home_team} – ${matchGER.away_team}: 3:1 (${YESTERDAY.slice(0, 10)})`);

  // Match 2: Niederlande vs Japan → Ergebnis 2:1
  const { data: matchNED } = await supabase
    .from('matches')
    .update({ kickoff_at: DAY_BEFORE, home_score: 2, away_score: 1 })
    .eq('home_team', 'Niederlande')
    .eq('away_team', 'Japan')
    .select('id, home_team, away_team')
    .single();
  if (!matchNED) throw new Error('Match Niederlande–Japan nicht gefunden');
  ok(`${matchNED.home_team} – ${matchNED.away_team}: 2:1 (${DAY_BEFORE.slice(0, 10)})`);

  // -------------------------------------------------------------------------
  // 2. Sonderwetten aufdecken
  // -------------------------------------------------------------------------
  section('Sonderwetten — aufdecken');

  const { data: betSieger } = await supabase
    .from('special_bets')
    .update({ lock_at: LOCKED_BETS_PAST, correct_answer: 'Frankreich' })
    .eq('title', 'Turniersieger')
    .select('id, title')
    .single();
  if (!betSieger) throw new Error('Sonderwette "Turniersieger" nicht gefunden');
  ok(`"${betSieger.title}" → Lösung: Frankreich`);

  const { data: betGruppeE } = await supabase
    .from('special_bets')
    .update({ lock_at: LOCKED_BETS_PAST, correct_answer: 'Deutschland' })
    .eq('title', 'Gruppensieger Gruppe E')
    .select('id, title')
    .single();
  if (!betGruppeE) throw new Error('Sonderwette "Gruppensieger Gruppe E" nicht gefunden');
  ok(`"${betGruppeE.title}" → Lösung: Deutschland`);

  // -------------------------------------------------------------------------
  // 3. Dummy-User anlegen (oder existierende wiederverwenden)
  // -------------------------------------------------------------------------
  section('Dummy-User anlegen');

  const dummyIds: Record<string, string> = {};

  for (const du of DUMMY_USERS) {
    let user = await findUserByEmail(du.email);
    if (!user) {
      const { data: created, error } = await supabase.auth.admin.createUser({
        email: du.email,
        password: 'DevPreview123!',
        email_confirm: true,
      });
      if (error) throw new Error(`createUser ${du.email}: ${error.message}`);
      user = created.user;
      ok(`Angelegt: ${du.name} (${du.email})`);
    } else {
      info(`Existiert bereits: ${du.name}`);
    }
    dummyIds[du.email] = user!.id;

    // Display-Name setzen (Trigger legt Profil mit leerem Namen an)
    await supabase
      .from('profiles')
      .update({ display_name: du.name })
      .eq('id', user!.id);
  }

  // Jonathan's ID ermitteln
  const jonathan = await findUserByEmail(JONATHAN_EMAIL);
  if (!jonathan) throw new Error(`User ${JONATHAN_EMAIL} nicht gefunden`);
  const jonathanId = jonathan.id;
  info(`Jonathan gefunden: ${jonathanId}`);

  // -------------------------------------------------------------------------
  // 4. Spieltipps anlegen
  //
  // Ergebnisse:
  //   Deutschland–Curaçao: 3:1  (diff=2, tendenz=Heim)
  //   Niederlande–Japan:   2:1  (diff=1, tendenz=Heim)
  //
  // Tipp-Design → Rangliste-Preview:
  //   Max:      3:1 (exakt,+4)  1:0 (diff,+3)  = 7 match + 20 special = 27 ← Platz 1
  //   Lisa:     2:0 (diff,+3)   2:1 (exakt,+4) = 7 match + 5 special  = 12 ← Platz 3
  //   Tom:      2:1 (tendenz,+2) 3:1 (diff,+2) = 4 match + 15 special = 19 ← Platz 2
  //   Anna:     1:3 (falsch,0)  0:0 (falsch,0) = 0 match + 0 special  = 0  ← Platz 5
  //   Jonathan: 4:1 (tendenz,+2) 2:0 (tendenz,+2) = 4 match + 5 sonder = 9 ← Platz 4
  // -------------------------------------------------------------------------
  section('Spieltipps');

  const matchTips = [
    // Deutschland–Curaçao (3:1)
    { user_id: dummyIds['dev-max@tippspiel.test'],  match_id: matchGER.id, home_tip: 3, away_tip: 1 }, // exakt +4
    { user_id: dummyIds['dev-lisa@tippspiel.test'], match_id: matchGER.id, home_tip: 2, away_tip: 0 }, // gleiche Diff +3
    { user_id: dummyIds['dev-tom@tippspiel.test'],  match_id: matchGER.id, home_tip: 2, away_tip: 1 }, // Tendenz +2
    { user_id: dummyIds['dev-anna@tippspiel.test'], match_id: matchGER.id, home_tip: 1, away_tip: 3 }, // falsch +0
    { user_id: jonathanId,                           match_id: matchGER.id, home_tip: 4, away_tip: 1 }, // Tendenz +2

    // Niederlande–Japan (2:1)
    { user_id: dummyIds['dev-max@tippspiel.test'],  match_id: matchNED.id, home_tip: 1, away_tip: 0 }, // gleiche Diff +3
    { user_id: dummyIds['dev-lisa@tippspiel.test'], match_id: matchNED.id, home_tip: 2, away_tip: 1 }, // exakt +4
    { user_id: dummyIds['dev-tom@tippspiel.test'],  match_id: matchNED.id, home_tip: 3, away_tip: 1 }, // Tendenz +2
    { user_id: dummyIds['dev-anna@tippspiel.test'], match_id: matchNED.id, home_tip: 0, away_tip: 0 }, // falsch +0
    { user_id: jonathanId,                           match_id: matchNED.id, home_tip: 2, away_tip: 0 }, // Tendenz +2
  ];

  const { error: mtErr } = await supabase.from('match_tips').upsert(matchTips, {
    onConflict: 'user_id,match_id',
  });
  if (mtErr) throw new Error(`match_tips upsert: ${mtErr.message}`);
  ok(`${matchTips.length} Spieltipps gespeichert`);

  // -------------------------------------------------------------------------
  // 5. Sonderwett-Tipps anlegen
  //
  //   Turniersieger (Lösung: Frankreich, 15 Pkt):
  //     Max → Frankreich ✓ (+15)
  //     Lisa → Brasilien  ✗
  //     Tom  → Frankreich ✓ (+15)
  //     Anna → Argentinien ✗
  //     Jonathan → Brasilien ✗
  //
  //   Gruppensieger Gruppe E (Lösung: Deutschland, 5 Pkt):
  //     Max → Deutschland ✓ (+5)
  //     Lisa → Deutschland ✓ (+5)
  //     Tom  → Elfenbeinküste ✗
  //     Anna → Curaçao ✗
  //     Jonathan → Deutschland ✓ (+5)
  // -------------------------------------------------------------------------
  section('Sonderwett-Tipps');

  const specialTips = [
    // Turniersieger
    { user_id: dummyIds['dev-max@tippspiel.test'],  special_bet_id: betSieger.id, answer: 'Frankreich' },
    { user_id: dummyIds['dev-lisa@tippspiel.test'], special_bet_id: betSieger.id, answer: 'Brasilien' },
    { user_id: dummyIds['dev-tom@tippspiel.test'],  special_bet_id: betSieger.id, answer: 'Frankreich' },
    { user_id: dummyIds['dev-anna@tippspiel.test'], special_bet_id: betSieger.id, answer: 'Argentinien' },
    { user_id: jonathanId,                           special_bet_id: betSieger.id, answer: 'Brasilien' },

    // Gruppensieger Gruppe E
    { user_id: dummyIds['dev-max@tippspiel.test'],  special_bet_id: betGruppeE.id, answer: 'Deutschland' },
    { user_id: dummyIds['dev-lisa@tippspiel.test'], special_bet_id: betGruppeE.id, answer: 'Deutschland' },
    { user_id: dummyIds['dev-tom@tippspiel.test'],  special_bet_id: betGruppeE.id, answer: 'Elfenbeinküste' },
    { user_id: dummyIds['dev-anna@tippspiel.test'], special_bet_id: betGruppeE.id, answer: 'Curaçao' },
    { user_id: jonathanId,                           special_bet_id: betGruppeE.id, answer: 'Deutschland' },
  ];

  const { error: stErr } = await supabase.from('special_bet_tips').upsert(specialTips, {
    onConflict: 'user_id,special_bet_id',
  });
  if (stErr) throw new Error(`special_bet_tips upsert: ${stErr.message}`);
  ok(`${specialTips.length} Sonderwett-Tipps gespeichert`);

  // -------------------------------------------------------------------------
  // Zusammenfassung
  // -------------------------------------------------------------------------
  console.log(`
╔═══════════════════════════════════════════════╗
║  Dev-Preview aktiv — erwartete Rangliste:     ║
║                                               ║
║  1. Max Mustermann   27 Pkt  (7 + 20)         ║
║  2. Tom Fischer      19 Pkt  (4 + 15)         ║
║  3. Lisa Schmidt     12 Pkt  (7 + 5)          ║
║  4. Jonathan (du)     9 Pkt  (4 + 5)          ║
║  5. Anna Müller       0 Pkt  (0 + 0)          ║
║                                               ║
║  Aufgedeckte Matches:                         ║
║    Deutschland – Curaçao  3:1                 ║
║    Niederlande – Japan    2:1                 ║
║                                               ║
║  Aufgedeckte Sonderwetten:                    ║
║    Turniersieger → Frankreich                 ║
║    Gruppensieger Gruppe E → Deutschland       ║
║                                               ║
║  Restore: npx tsx scripts/dev-preview.ts      ║
║           --restore                           ║
╚═══════════════════════════════════════════════╝
`);
}

// ---------------------------------------------------------------------------
// RESTORE
// ---------------------------------------------------------------------------

async function restore() {
  console.log('WM 2026 — Dev-Preview RESTORE');
  console.log(`Supabase: ${supabaseUrl}\n`);

  // -------------------------------------------------------------------------
  // 1. Matches zurücksetzen (originale Kickoff-Zeiten + Ergebnis löschen)
  // -------------------------------------------------------------------------
  section('Matches — zurücksetzen');

  const { error: gerErr } = await supabase
    .from('matches')
    .update({ kickoff_at: '2026-06-14T17:00:00Z', home_score: null, away_score: null })
    .eq('home_team', 'Deutschland')
    .eq('away_team', 'Curaçao');
  if (gerErr) throw new Error(`Restore Deutschland–Curaçao: ${gerErr.message}`);
  ok('Deutschland–Curaçao → 14.06.2026 19:00 MESZ, kein Ergebnis');

  const { error: nedErr } = await supabase
    .from('matches')
    .update({ kickoff_at: '2026-06-14T20:00:00Z', home_score: null, away_score: null })
    .eq('home_team', 'Niederlande')
    .eq('away_team', 'Japan');
  if (nedErr) throw new Error(`Restore Niederlande–Japan: ${nedErr.message}`);
  ok('Niederlande–Japan → 14.06.2026 22:00 MESZ, kein Ergebnis');

  // -------------------------------------------------------------------------
  // 2. Sonderwetten zurücksetzen
  // -------------------------------------------------------------------------
  section('Sonderwetten — zurücksetzen');

  const NEW_LOCK_AT = '2026-06-14T17:00:00Z';

  const { error: b1Err } = await supabase
    .from('special_bets')
    .update({ lock_at: NEW_LOCK_AT, correct_answer: null })
    .eq('title', 'Turniersieger');
  if (b1Err) throw new Error(`Restore Turniersieger: ${b1Err.message}`);
  ok('"Turniersieger" → lock_at wiederhergestellt, correct_answer gelöscht');

  const { error: b2Err } = await supabase
    .from('special_bets')
    .update({ lock_at: NEW_LOCK_AT, correct_answer: null })
    .eq('title', 'Gruppensieger Gruppe E');
  if (b2Err) throw new Error(`Restore Gruppensieger Gruppe E: ${b2Err.message}`);
  ok('"Gruppensieger Gruppe E" → lock_at wiederhergestellt, correct_answer gelöscht');

  // -------------------------------------------------------------------------
  // 3. Jonathan's Tipps löschen
  // -------------------------------------------------------------------------
  section("Jonathan's Tipps löschen");

  const jonathan = await findUserByEmail(JONATHAN_EMAIL);
  if (jonathan) {
    const { count: mc } = await supabase
      .from('match_tips')
      .delete({ count: 'exact' })
      .eq('user_id', jonathan.id);
    ok(`${mc ?? 0} match_tips gelöscht`);

    const { count: sc } = await supabase
      .from('special_bet_tips')
      .delete({ count: 'exact' })
      .eq('user_id', jonathan.id);
    ok(`${sc ?? 0} special_bet_tips gelöscht`);
  } else {
    info('Jonathan nicht gefunden — übersprungen');
  }

  // -------------------------------------------------------------------------
  // 4. Dummy-User löschen (cascade → profiles + tipps)
  // -------------------------------------------------------------------------
  section('Dummy-User löschen');

  for (const du of DUMMY_USERS) {
    const user = await findUserByEmail(du.email);
    if (!user) {
      info(`${du.name} — nicht gefunden, übersprungen`);
      continue;
    }
    // Tipps zuerst löschen (RLS-freier Service-Role-Zugriff)
    await supabase.from('match_tips').delete().eq('user_id', user.id);
    await supabase.from('special_bet_tips').delete().eq('user_id', user.id);

    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) throw new Error(`deleteUser ${du.email}: ${error.message}`);
    ok(`${du.name} gelöscht`);
  }

  console.log('\nRestore abgeschlossen. DB ist wieder im Ausgangszustand.');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const arg = process.argv[2];

if (arg === '--setup') {
  setup().catch((err) => { console.error('\nFehler:', err.message); process.exit(1); });
} else if (arg === '--restore') {
  restore().catch((err) => { console.error('\nFehler:', err.message); process.exit(1); });
} else {
  console.log('Verwendung:');
  console.log('  npx tsx scripts/dev-preview.ts --setup');
  console.log('  npx tsx scripts/dev-preview.ts --restore');
  process.exit(1);
}
