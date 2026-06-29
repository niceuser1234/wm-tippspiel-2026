// supabase/functions/_shared/espn.ts
//
// Shared helpers for ESPN's keyless FIFA World Cup 2026 scoreboard feed.
// Used by sync-scores (results) and sync-fixtures (knockout pairings).
//
// Cross-runtime: imported by Deno Edge Functions AND executed under Node
// type-stripping (`node --test`). Keep it dependency-free (only global fetch).
// Always import type-only symbols with the inline `type` keyword.

// ESPN scoreboard endpoint for the FIFA World Cup. The date window spans the
// whole tournament; limit=400 avoids ESPN's default 100-event cap (104 matches).
export const ESPN_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260720&limit=400";

export type Stage = "group" | "r32" | "r16" | "qf" | "sf" | "third_place" | "final";

// ESPN round headline -> DB stage. Group stage / unknown -> null (not knockout).
const ROUND_TO_STAGE: Record<string, Stage> = {
  "round-of-32": "r32",
  "round-of-16": "r16",
  "quarterfinals": "qf",
  "semifinals": "sf",
  "3rd-place-match": "third_place",
  "final": "final",
};

// The round slug comes from `event.season.slug` (e.g. "round-of-32"); ESPN's
// per-competition `notes[0].headline` is empty for this feed.
export function mapRoundToStage(slug: string | null | undefined): Stage | null {
  if (!slug) return null;
  return ROUND_TO_STAGE[slug] ?? null;
}

// English (ESPN) -> German (DB) team names.
// All 18 teams currently in the DB are covered with their exact German strings;
// the rest of the World Cup field is included for forward-compat. Keys are matched
// accent-/case-insensitively (see normalize()).
export const TEAM_MAP: Record<string, string> = {
  // ── Live in the DB today ──
  "argentina": "Argentinien",
  "curacao": "Curaçao",
  "germany": "Deutschland",
  "ecuador": "Ecuador",
  "ivory coast": "Elfenbeinküste",
  "cote d ivoire": "Elfenbeinküste",
  "england": "England",
  "france": "Frankreich",
  "ghana": "Ghana",
  "japan": "Japan",
  "colombia": "Kolumbien",
  "croatia": "Kroatien",
  "netherlands": "Niederlande",
  "norway": "Norwegen",
  "austria": "Österreich",
  "portugal": "Portugal",
  "senegal": "Senegal",
  "spain": "Spanien",
  "uruguay": "Uruguay",
  // ── Rest of the field (forward-compat) ──
  "brazil": "Brasilien",
  "usa": "USA",
  "united states": "USA",
  "mexico": "Mexiko",
  "canada": "Kanada",
  "south korea": "Südkorea",
  "korea republic": "Südkorea",
  "morocco": "Marokko",
  "switzerland": "Schweiz",
  "belgium": "Belgien",
  "denmark": "Dänemark",
  "poland": "Polen",
  "serbia": "Serbien",
  "turkey": "Türkei",
  "turkiye": "Türkei",
  "ukraine": "Ukraine",
  "australia": "Australien",
  "new zealand": "Neuseeland",
  "paraguay": "Paraguay",
  "peru": "Peru",
  "chile": "Chile",
  "saudi arabia": "Saudi-Arabien",
  "iran": "Iran",
  "ir iran": "Iran",
  "iraq": "Irak",
  "jordan": "Jordanien",
  "qatar": "Katar",
  "italy": "Italien",
  "scotland": "Schottland",
  "wales": "Wales",
  "egypt": "Ägypten",
  "nigeria": "Nigeria",
  "cameroon": "Kamerun",
  "tunisia": "Tunesien",
  "algeria": "Algerien",
  "south africa": "Südafrika",
  "costa rica": "Costa Rica",
  "panama": "Panama",
  "honduras": "Honduras",
  "jamaica": "Jamaika",
  "venezuela": "Venezuela",
  "bolivia": "Bolivien",
  "cape verde": "Kap Verde",
  "uzbekistan": "Usbekistan",
  "greece": "Griechenland",
  "czechia": "Tschechien",
  "czech republic": "Tschechien",
  "sweden": "Schweden",
  "hungary": "Ungarn",
  "romania": "Rumänien",
  "slovakia": "Slowakei",
  "slovenia": "Slowenien",
  "dr congo": "DR Kongo",
  "congo dr": "DR Kongo",
  "new caledonia": "Neukaledonien",
  "united arab emirates": "Vereinigte Arabische Emirate",
  "bahrain": "Bahrain",
  "oman": "Oman",
  "haiti": "Haiti",
  "bosnia herzegovina": "Bosnien und Herzegowina",
};

// Lowercase, strip diacritics + punctuation, collapse whitespace.
// "Curaçao" → "curacao", "Türkiye" → "turkiye", "Bosnia-Herzegovina" → "bosnia herzegovina".
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function mapTeam(apiName: string): string | undefined {
  return TEAM_MAP[normalize(apiName)];
}

export interface EspnEvent {
  round: string | null;     // raw ESPN headline, e.g. "round-of-32"
  stage: Stage | null;      // mapped DB stage, null for group/unknown
  completed: boolean;       // true once the match is finished
  homeName: string;         // ESPN displayName (English)
  awayName: string;
  homeScore: number | null; // null when unparseable
  awayScore: number | null;
  date: string | null;      // ISO kickoff timestamp
}

// Parse the ESPN scoreboard JSON into a flat list of events (scheduled + finished).
export function parseEspnEvents(json: any): EspnEvent[] {
  const events: any[] = Array.isArray(json?.events) ? json.events : [];
  const out: EspnEvent[] = [];
  for (const ev of events) {
    const comp = ev?.competitions?.[0];
    if (!comp) continue;
    const cs: any[] = comp.competitors ?? [];
    const home = cs.find((c) => c.homeAway === "home");
    const away = cs.find((c) => c.homeAway === "away");
    if (!home?.team?.displayName || !away?.team?.displayName) continue;
    const hs = parseInt(home.score, 10);
    const as = parseInt(away.score, 10);
    // Round comes from event.season.slug; fall back to notes headline just in case.
    const round: string | null = ev?.season?.slug ?? comp?.notes?.[0]?.headline ?? null;
    out.push({
      round,
      stage: mapRoundToStage(round),
      completed: Boolean(comp?.status?.type?.completed),
      homeName: home.team.displayName,
      awayName: away.team.displayName,
      homeScore: Number.isNaN(hs) ? null : hs,
      awayScore: Number.isNaN(as) ? null : as,
      date: ev?.date ?? comp?.date ?? null,
    });
  }
  return out;
}

export async function fetchEspnEvents(): Promise<EspnEvent[]> {
  const res = await fetch(ESPN_URL, {
    headers: { "Accept": "application/json", "User-Agent": "wm-tippspiel-sync" },
  });
  if (!res.ok) {
    throw new Error(`ESPN HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return parseEspnEvents(await res.json());
}
