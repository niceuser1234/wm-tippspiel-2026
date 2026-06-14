import type { LeaderboardRow } from "@/types/database";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/avatar";
import { withRanks } from "@/lib/rank";

interface LeaderboardTableProps {
  rows: LeaderboardRow[];
  currentUserId: string | null;
}

/**
 * Server Component für Rangliste.
 * Berechnet Ränge mit Gleichstand-Handling (z.B. zwei Platz 2 → nächster ist Platz 4).
 * Eigene Zeile: bg-amber-50 mit gold-Ring.
 * Tabellenzahlen: tabular-nums für Alignment.
 * Mobile: kompakt ohne horizontalen Scroll @ 375px.
 */
export function LeaderboardTable({
  rows,
  currentUserId,
}: LeaderboardTableProps) {
  // Ränge berechnen: Gleichstand = geteilter Rang (Logik in lib/rank)
  const rowsWithRanks = withRanks(rows);

  const getMedalOrRank = (rank: number): string => {
    switch (rank) {
      case 1:
        return "🥇";
      case 2:
        return "🥈";
      case 3:
        return "🥉";
      default:
        return rank.toString();
    }
  };

  return (
    <div className="overflow-x-auto -mx-4">
      <table className="wm-table">
        {/* Header */}
        <thead>
          <tr>
            <th>Platz</th>
            <th>Name</th>
            <th className="text-right hidden sm:table-cell">Spieltipps</th>
            <th className="text-right hidden sm:table-cell">Sonderwetten</th>
            <th className="text-right">Gesamt</th>
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {rowsWithRanks.map((row) => {
            const isCurrentUser = row.id === currentUserId;
            const matchPts = row.match_points ?? 0;
            const specialPts = row.special_points ?? 0;
            const totalPts = row.total_points ?? 0;
            const displayName = row.display_name ?? "Anonym";

            return (
              <tr
                key={row.id}
                className={cn(
                  isCurrentUser ? "is-me" : "hover:bg-secondary/50"
                )}
              >
                {/* Platz */}
                <td className="wm-table__rank">
                  {getMedalOrRank(row.rank)}
                </td>

                {/* Name + Avatar + paid Indikator */}
                <td>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={displayName} url={row.avatar_url} size={32} />
                    <span className="font-medium text-night">{displayName}</span>
                    {row.paid && (
                      <span title="Zahler" className="text-lg">💰</span>
                    )}
                  </div>
                </td>

                {/* Spieltipps (hidden auf mobile) */}
                <td className="text-right font-medium score-nums text-night hidden sm:table-cell">
                  {matchPts}
                </td>

                {/* Sonderwetten (hidden auf mobile) */}
                <td className="text-right font-medium score-nums text-night hidden sm:table-cell">
                  {specialPts}
                </td>

                {/* Gesamt — prominent, gold */}
                <td className="text-right">
                  <span className="wm-table__total">{totalPts}</span>
                  {matchPts > 0 || specialPts > 0 ? (
                    <div className="text-xs text-muted-foreground mt-1 sm:hidden">
                      {matchPts} + {specialPts}
                    </div>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
