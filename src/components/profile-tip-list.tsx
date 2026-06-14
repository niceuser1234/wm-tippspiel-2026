import { TeamLabel } from "@/components/team-label";
import { POINTS_COLORS, type MatchPoints } from "@/lib/scoring";
import type { TipReaction, TipComment } from "@/types/database";

export interface ProfileTipItem {
  matchTipId: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
  homeScore: number | null;
  awayScore: number | null;
  homeTip: number;
  awayTip: number;
  points: number | null;
  hasStarted: boolean;
}

interface ProfileTipListProps {
  items: ProfileTipItem[];
  viewerId: string;
  reactions: (TipReaction & { display_name: string })[];
  comments: (TipComment & { display_name: string; avatar_url: string | null })[];
}

export function ProfileTipList({ items }: ProfileTipListProps) {
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-sm py-6 text-center">
        Noch keine sichtbaren Tipps.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Tipps</h2>
      {items.map((it) => (
        <div key={it.matchTipId} className="rounded-2xl border border-slate-200 bg-white shadow-sm px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <TeamLabel team={it.homeTeam} className="font-medium text-night flex-1 truncate" />
            <span className="font-bold tabular-nums text-night">{it.homeTip} : {it.awayTip}</span>
            <TeamLabel team={it.awayTeam} className="font-medium text-night flex-1 truncate justify-end" />
            {it.points !== null && (
              <span className={POINTS_COLORS[it.points as MatchPoints]}>
                {it.points > 0 ? `+${it.points}` : "0"}
              </span>
            )}
          </div>
          {it.homeScore !== null && it.awayScore !== null && (
            <p className="text-xs text-muted-foreground mt-1">
              Ergebnis: {it.homeScore} : {it.awayScore}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
