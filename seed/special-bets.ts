// =============================================================================
// seed/special-bets.ts — 7 Sonderwetten WM 2026
//
// Exakt nach README-Tabelle + DECISIONS §6.
// Alle lock_at = '2026-06-11T16:00:00Z' (vor dem Eröffnungsspiel).
// options-jsonb: Teamlisten, Spielerlisten, Runden-Listen gemäß DECISIONS §6.
// =============================================================================

export interface SpecialBetSeed {
  title: string;
  bet_type: 'team' | 'number' | 'text' | 'two_teams' | 'round';
  options: string[] | null; // wird als jsonb gespeichert
  points_value: number;
  lock_at: string; // ISO 8601 UTC
}

// Alle 48 qualifizierten Teams (für Wette #1, #4, #6) —
// verifiziert am 09.06.2026 gegen die offiziellen Gruppen A–L (fifa.com, sportschau.de)
const ALL_TEAMS: string[] = [
  // Gruppe A
  'Mexiko', 'Südafrika', 'Südkorea', 'Tschechien',
  // Gruppe B
  'Kanada', 'Bosnien-Herzegowina', 'Katar', 'Schweiz',
  // Gruppe C
  'Brasilien', 'Marokko', 'Haiti', 'Schottland',
  // Gruppe D
  'USA', 'Paraguay', 'Australien', 'Türkei',
  // Gruppe E
  'Deutschland', 'Curaçao', 'Elfenbeinküste', 'Ecuador',
  // Gruppe F
  'Niederlande', 'Japan', 'Schweden', 'Tunesien',
  // Gruppe G
  'Belgien', 'Ägypten', 'Iran', 'Neuseeland',
  // Gruppe H
  'Spanien', 'Uruguay', 'Saudi-Arabien', 'Kap Verde',
  // Gruppe I
  'Frankreich', 'Senegal', 'Norwegen', 'Irak',
  // Gruppe J
  'Argentinien', 'Algerien', 'Österreich', 'Jordanien',
  // Gruppe K
  'Portugal', 'DR Kongo', 'Usbekistan', 'Kolumbien',
  // Gruppe L
  'England', 'Kroatien', 'Ghana', 'Panama',
];

// Gruppe-E-Teams (für Wette #7)
const GROUP_E_TEAMS: string[] = [
  'Deutschland', 'Elfenbeinküste', 'Ecuador', 'Curaçao',
];

// ~24 Torjäger-Kandidaten (für Wette #2, Torschützenkönig)
const TOP_SCORER_CANDIDATES: string[] = [
  'Kylian Mbappé',
  'Erling Haaland',
  'Harry Kane',
  'Jamal Musiala',
  'Lionel Messi',
  'Jude Bellingham',
  'Vinícius Júnior',
  'Lautaro Martínez',
  'Julián Álvarez',
  'Robert Lewandowski',
  'Niclas Füllkrug',
  'Florian Wirtz',
  'Lamine Yamal',
  'Dani Olmo',
  'Antoine Griezmann',
  'Marcus Rashford',
  'Bukayo Saka',
  'Phil Foden',
  'Victor Osimhen',
  'Youssef En-Nesyri',
  'Cody Gakpo',
  'Memphis Depay',
  'Álvaro Morata',
  'Christian Pulisic',
];

// Runden-Optionen für Wette #5 (inkl. Sechzehntelfinale, G4)
const ROUND_OPTIONS: string[] = [
  'Gruppenphase',
  'Sechzehntelfinale',
  'Achtelfinale',
  'Viertelfinale',
  'Halbfinale',
  'Finale (verloren)',
  'Weltmeister',
];

const LOCK_AT = '2026-06-11T16:00:00Z';

export const specialBets: SpecialBetSeed[] = [
  {
    // Wette #1 — Turniersieger
    title: 'Turniersieger',
    bet_type: 'team',
    options: ALL_TEAMS,
    points_value: 15,
    lock_at: LOCK_AT,
  },
  {
    // Wette #2 — Torschützenkönig
    title: 'Torschützenkönig',
    bet_type: 'text',
    options: TOP_SCORER_CANDIDATES,
    points_value: 12,
    lock_at: LOCK_AT,
  },
  {
    // Wette #3 — Gesamtanzahl Tore im Turnier (nächste Schätzung gewinnt)
    title: 'Gesamtanzahl Tore im Turnier',
    bet_type: 'number',
    options: null,
    points_value: 8,
    lock_at: LOCK_AT,
  },
  {
    // Wette #4 — Beide Finalisten (je 4 Pkt. pro richtigem Team)
    title: 'Beide Finalisten',
    bet_type: 'two_teams',
    options: ALL_TEAMS,
    points_value: 8,
    lock_at: LOCK_AT,
  },
  {
    // Wette #5 — Deutschland: Aus in welcher Runde?
    title: 'Deutschland – Aus in welcher Runde?',
    bet_type: 'round',
    options: ROUND_OPTIONS,
    points_value: 6,
    lock_at: LOCK_AT,
  },
  {
    // Wette #6 — Welches Team kassiert die meisten Roten Karten?
    title: 'Welches Team kassiert die meisten Roten Karten?',
    bet_type: 'team',
    options: ALL_TEAMS,
    points_value: 5,
    lock_at: LOCK_AT,
  },
  {
    // Wette #7 — Gruppensieger Gruppe E
    title: 'Gruppensieger Gruppe E',
    bet_type: 'team',
    options: GROUP_E_TEAMS,
    points_value: 5,
    lock_at: LOCK_AT,
  },
];
