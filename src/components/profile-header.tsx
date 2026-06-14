import { Avatar } from "@/components/avatar";

interface ProfileHeaderProps {
  displayName: string;
  avatarUrl: string | null;
  paid: boolean;
  rank: number | null;
  totalPoints: number;
  matchPoints: number;
  specialPoints: number;
  exactCount: number;
  hitRatePct: number | null; // null = noch keine gewerteten Tipps
}

function medal(rank: number | null): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return rank ? `#${rank}` : "—";
}

export function ProfileHeader({
  displayName, avatarUrl, paid, rank,
  totalPoints, matchPoints, specialPoints, exactCount, hitRatePct,
}: ProfileHeaderProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 pt-6 pb-4 flex flex-col items-center text-center gap-2">
        <Avatar name={displayName} url={avatarUrl} size={112} />
        <div className="flex items-center gap-2">
          <h1 className="display-heading text-2xl text-night">{displayName}</h1>
          {paid && <span title="Zahler" className="text-lg">💰</span>}
        </div>
        <p className="text-sm font-semibold text-amber-600">
          {medal(rank)} · {totalPoints} Punkte
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-slate-100 divide-x divide-slate-100">
        <Stat label="Spieltipps" value={matchPoints} />
        <Stat label="Sonderwetten" value={specialPoints} />
        <Stat label="Volltreffer" value={`${exactCount} ⭐`} />
        <Stat label="Trefferquote" value={hitRatePct === null ? "—" : `${hitRatePct}%`} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="px-3 py-3 text-center">
      <div className="text-lg font-black text-night tabular-nums">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}
