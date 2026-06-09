/**
 * Die 48 Teilnehmer der WM 2026 mit Flaggen-Emoji, gruppiert nach Gruppen A–L
 * (verifiziert 09.06.2026). Deutsche Teamnamen als Keys — müssen exakt mit
 * matches.home_team/away_team und special_bets.options übereinstimmen.
 */
export const TEAM_FLAGS: Record<string, string> = {
  // Gruppe A
  Mexiko: "🇲🇽",
  Südafrika: "🇿🇦",
  Südkorea: "🇰🇷",
  Tschechien: "🇨🇿",
  // Gruppe B
  Kanada: "🇨🇦",
  "Bosnien-Herzegowina": "🇧🇦",
  Katar: "🇶🇦",
  Schweiz: "🇨🇭",
  // Gruppe C
  Brasilien: "🇧🇷",
  Marokko: "🇲🇦",
  Haiti: "🇭🇹",
  Schottland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  // Gruppe D
  USA: "🇺🇸",
  Paraguay: "🇵🇾",
  Australien: "🇦🇺",
  Türkei: "🇹🇷",
  // Gruppe E (Deutschlands Gruppe)
  Deutschland: "🇩🇪",
  Curaçao: "🇨🇼",
  Elfenbeinküste: "🇨🇮",
  Ecuador: "🇪🇨",
  // Gruppe F
  Niederlande: "🇳🇱",
  Japan: "🇯🇵",
  Schweden: "🇸🇪",
  Tunesien: "🇹🇳",
  // Gruppe G
  Belgien: "🇧🇪",
  Ägypten: "🇪🇬",
  Iran: "🇮🇷",
  Neuseeland: "🇳🇿",
  // Gruppe H
  Spanien: "🇪🇸",
  Uruguay: "🇺🇾",
  "Saudi-Arabien": "🇸🇦",
  "Kap Verde": "🇨🇻",
  // Gruppe I
  Frankreich: "🇫🇷",
  Senegal: "🇸🇳",
  Norwegen: "🇳🇴",
  Irak: "🇮🇶",
  // Gruppe J
  Argentinien: "🇦🇷",
  Algerien: "🇩🇿",
  Österreich: "🇦🇹",
  Jordanien: "🇯🇴",
  // Gruppe K
  Portugal: "🇵🇹",
  "DR Kongo": "🇨🇩",
  Usbekistan: "🇺🇿",
  Kolumbien: "🇨🇴",
  // Gruppe L
  England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  Kroatien: "🇭🇷",
  Ghana: "🇬🇭",
  Panama: "🇵🇦",
};

export const ALL_TEAMS = Object.keys(TEAM_FLAGS);

/** Flagge für ein Team, Fallback ⚽ für unbekannte Namen (z.B. K.o.-Platzhalter). */
export function flagFor(team: string): string {
  return TEAM_FLAGS[team] ?? "⚽";
}

/** "🇩🇪 Deutschland" — Standard-Darstellung überall im UI. */
export function teamLabel(team: string): string {
  return `${flagFor(team)} ${team}`;
}
