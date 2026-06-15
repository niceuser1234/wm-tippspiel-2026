import type { LeaderboardRow } from "@/types/database";

export interface RankedRow extends LeaderboardRow {
  rank: number;
}

/**
 * Ränge mit Gleichstand-Handling: gleiche total_points UND exact_count → geteilter Rang
 * (z.B. zwei Platz 2 → nächster ist Platz 4).
 * Erwartet `rows` bereits sortiert (leaderboard-View: total_points DESC, exact_count DESC).
 */
export function withRanks(rows: LeaderboardRow[]): RankedRow[] {
  const out: RankedRow[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    let rank = i + 1;
    if (i > 0) {
      const prev = rows[i - 1];
      if (prev.total_points === row.total_points && prev.exact_count === row.exact_count) {
        rank = out[i - 1].rank;
      }
    }
    out.push({ ...row, rank });
  }
  return out;
}
