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

/**
 * flag-icons-Codes (ISO 3166-1 alpha-2, plus GB-Subdivisionen für
 * England/Schottland). Quelle für die SVG-Flaggen — rendern auf JEDEM Gerät
 * identisch (Emoji-Flaggen fehlen z.B. komplett auf Windows).
 */
export const TEAM_ISO: Record<string, string> = {
  // Gruppe A
  Mexiko: "mx", Südafrika: "za", Südkorea: "kr", Tschechien: "cz",
  // Gruppe B
  Kanada: "ca", "Bosnien-Herzegowina": "ba", Katar: "qa", Schweiz: "ch",
  // Gruppe C
  Brasilien: "br", Marokko: "ma", Haiti: "ht", Schottland: "gb-sct",
  // Gruppe D
  USA: "us", Paraguay: "py", Australien: "au", Türkei: "tr",
  // Gruppe E
  Deutschland: "de", Curaçao: "cw", Elfenbeinküste: "ci", Ecuador: "ec",
  // Gruppe F
  Niederlande: "nl", Japan: "jp", Schweden: "se", Tunesien: "tn",
  // Gruppe G
  Belgien: "be", Ägypten: "eg", Iran: "ir", Neuseeland: "nz",
  // Gruppe H
  Spanien: "es", Uruguay: "uy", "Saudi-Arabien": "sa", "Kap Verde": "cv",
  // Gruppe I
  Frankreich: "fr", Senegal: "sn", Norwegen: "no", Irak: "iq",
  // Gruppe J
  Argentinien: "ar", Algerien: "dz", Österreich: "at", Jordanien: "jo",
  // Gruppe K
  Portugal: "pt", "DR Kongo": "cd", Usbekistan: "uz", Kolumbien: "co",
  // Gruppe L
  England: "gb-eng", Kroatien: "hr", Ghana: "gh", Panama: "pa",
};

/** flag-icons-Code für ein Team, oder null für unbekannte Namen. */
export function isoFor(team: string): string | null {
  return TEAM_ISO[team] ?? null;
}

/** Flagge-Emoji für ein Team, Fallback ⚽ (für Text-Kontexte ohne JSX). */
export function flagFor(team: string): string {
  return TEAM_FLAGS[team] ?? "⚽";
}

/** "🇩🇪 Deutschland" — Emoji-Variante (Fallback/Text). UI nutzt <TeamLabel>. */
export function teamLabel(team: string): string {
  return `${flagFor(team)} ${team}`;
}
