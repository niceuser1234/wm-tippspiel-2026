// =============================================================================
// seed/special-bets.ts — Sonderwetten WM 2026
//
// Aufbau nach README-Tabelle + DECISIONS §6, mit Anpassungen:
//   - "Deutschland – Aus in welcher Runde?" entfernt
//   - Gruppensieger-Wette für JEDE Gruppe A–L (je 3 Pkt)
//   - "Mannschaft mit größtem Skandal des Turniers" (8 Pkt, manuell aufgelöst)
// Alle lock_at = '2026-06-14T17:00:00Z' (Anpfiff Deutschland–Curaçao).
// options-jsonb: Teamlisten, Spielerlisten gemäß DECISIONS §6.
// =============================================================================

export interface SpecialBetSeed {
  title: string;
  bet_type: 'team' | 'number' | 'text' | 'two_teams' | 'round';
  options: string[] | null; // wird als jsonb gespeichert
  points_value: number;
  lock_at: string; // ISO 8601 UTC
}

// Alle 48 Teams nach Gruppen A–L —
// verifiziert am 09.06.2026 gegen die offiziellen Gruppen (fifa.com, sportschau.de)
const GROUPS: Record<string, string[]> = {
  A: ['Mexiko', 'Südafrika', 'Südkorea', 'Tschechien'],
  B: ['Kanada', 'Bosnien-Herzegowina', 'Katar', 'Schweiz'],
  C: ['Brasilien', 'Marokko', 'Haiti', 'Schottland'],
  D: ['USA', 'Paraguay', 'Australien', 'Türkei'],
  E: ['Deutschland', 'Curaçao', 'Elfenbeinküste', 'Ecuador'],
  F: ['Niederlande', 'Japan', 'Schweden', 'Tunesien'],
  G: ['Belgien', 'Ägypten', 'Iran', 'Neuseeland'],
  H: ['Spanien', 'Uruguay', 'Saudi-Arabien', 'Kap Verde'],
  I: ['Frankreich', 'Senegal', 'Norwegen', 'Irak'],
  J: ['Argentinien', 'Algerien', 'Österreich', 'Jordanien'],
  K: ['Portugal', 'DR Kongo', 'Usbekistan', 'Kolumbien'],
  L: ['England', 'Kroatien', 'Ghana', 'Panama'],
};

// Alle 48 qualifizierten Teams (für Wette #1, #4, #6, Skandal-Wette)
const ALL_TEAMS: string[] = Object.values(GROUPS).flat();

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

// 14.06.2026 19:00 MESZ = 17:00 UTC (= Anpfiff Deutschland–Curaçao)
const LOCK_AT = '2026-06-14T17:00:00Z';

// Gruppensieger-Wette pro Gruppe A–L (je 3 Pkt)
const GROUP_WINNER_BETS: SpecialBetSeed[] = Object.entries(GROUPS).map(
  ([letter, teams]) => ({
    title: `Gruppensieger Gruppe ${letter}`,
    bet_type: 'team',
    options: teams,
    points_value: 3,
    lock_at: LOCK_AT,
  })
);

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
    // Wette #6 — Welches Team kassiert die meisten Roten Karten?
    title: 'Welches Team kassiert die meisten Roten Karten?',
    bet_type: 'team',
    options: ALL_TEAMS,
    points_value: 5,
    lock_at: LOCK_AT,
  },
  {
    // Mannschaft mit größtem Skandal — wird am Ende manuell aufgelöst
    title: 'Mannschaft mit größtem Skandal des Turniers',
    bet_type: 'team',
    options: ALL_TEAMS,
    points_value: 8,
    lock_at: LOCK_AT,
  },
  // Gruppensieger-Wetten für alle 12 Gruppen A–L (je 3 Pkt)
  ...GROUP_WINNER_BETS,
];
