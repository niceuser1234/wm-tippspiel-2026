// =============================================================================
// seed/matches.ts — 12 kuratierte Gruppenspiele WM 2026
//
// Termine verifiziert am 09.06.2026 (sportschau.de, fussballnationalmannschaft.net,
// fussballdaten.de, ran.de). Anstoßzeiten in UTC (Quellen nennen MESZ = UTC+2).
//
// Gruppe E: Deutschland, Curaçao, Elfenbeinküste, Ecuador
// =============================================================================

export interface MatchSeed {
  stage: 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'third_place' | 'final';
  home_team: string;
  away_team: string;
  kickoff_at: string; // ISO 8601 UTC
}

export const matches: MatchSeed[] = [
  // ---------------------------------------------------------------------------
  // DEUTSCHLAND — Gruppe E (alle 3 Spiele)
  // ---------------------------------------------------------------------------
  {
    stage: 'group',
    home_team: 'Deutschland',
    away_team: 'Curaçao',
    kickoff_at: '2026-06-14T17:00:00Z', // 14.6. 19:00 MESZ, Houston
  },
  {
    stage: 'group',
    home_team: 'Deutschland',
    away_team: 'Elfenbeinküste',
    kickoff_at: '2026-06-20T20:00:00Z', // 20.6. 22:00 MESZ, Toronto
  },
  {
    stage: 'group',
    home_team: 'Deutschland',
    away_team: 'Ecuador',
    kickoff_at: '2026-06-25T20:00:00Z', // 25.6. 22:00 MESZ, New York/New Jersey
  },

  // ---------------------------------------------------------------------------
  // TOPSPIELE — 9 handverlesene Spiele der Titelkandidaten
  // ---------------------------------------------------------------------------
  {
    stage: 'group',
    home_team: 'Niederlande',
    away_team: 'Japan',
    kickoff_at: '2026-06-14T20:00:00Z', // 14.6. 22:00 MESZ, Dallas (Gruppe F)
  },
  {
    stage: 'group',
    home_team: 'Frankreich',
    away_team: 'Senegal',
    kickoff_at: '2026-06-16T19:00:00Z', // 16.6. 21:00 MESZ (Gruppe I)
  },
  {
    stage: 'group',
    home_team: 'England',
    away_team: 'Kroatien',
    kickoff_at: '2026-06-17T20:00:00Z', // 17.6. 22:00 MESZ (Gruppe L)
  },
  {
    stage: 'group',
    home_team: 'Argentinien',
    away_team: 'Österreich',
    kickoff_at: '2026-06-22T17:00:00Z', // 22.6. 19:00 MESZ (Gruppe J)
  },
  {
    stage: 'group',
    home_team: 'England',
    away_team: 'Ghana',
    kickoff_at: '2026-06-23T20:00:00Z', // 23.6. 22:00 MESZ (Gruppe L)
  },
  {
    stage: 'group',
    home_team: 'Norwegen',
    away_team: 'Frankreich',
    kickoff_at: '2026-06-26T19:00:00Z', // 26.6. 21:00 MESZ (Gruppe I) — Haaland vs. Mbappé
  },
  {
    stage: 'group',
    home_team: 'Uruguay',
    away_team: 'Spanien',
    kickoff_at: '2026-06-27T00:00:00Z', // 27.6. 02:00 MESZ (Gruppe H)
  },
  {
    stage: 'group',
    home_team: 'Portugal',
    away_team: 'Kolumbien',
    kickoff_at: '2026-06-27T23:30:00Z', // 28.6. 01:30 MESZ, Miami (Gruppe K)
  },
];
