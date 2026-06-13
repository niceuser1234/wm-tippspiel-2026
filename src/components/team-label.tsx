import type { ReactNode } from "react";
import { isoFor } from "@/lib/teams";
import type { BetType } from "@/types/database";

/** SVG-Flagge eines Teams (flag-icons). Fallback ⚽ für unbekannte Namen. */
export function TeamFlag({
  team,
  className = "",
}: {
  team: string;
  className?: string;
}) {
  const iso = isoFor(team);
  if (!iso) {
    return <span className={className}>⚽</span>;
  }
  return (
    <span
      className={`fi fi-${iso} rounded-[2px] shadow-sm ${className}`}
      aria-hidden="true"
    />
  );
}

/** "🇩🇪 Deutschland" als JSX — Standard-Team-Darstellung überall im UI. */
export function TeamLabel({
  team,
  className = "",
}: {
  team: string;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <TeamFlag team={team} />
      <span>{team}</span>
    </span>
  );
}

/** Rendert eine Sonderwetten-Antwort lesbar (Flaggen, zwei Teams etc.). */
export function BetAnswer({
  betType,
  answer,
}: {
  betType: BetType;
  answer: string;
}): ReactNode {
  if (betType === "two_teams") {
    let teams: string[] = [];
    try {
      const parsed = JSON.parse(answer);
      if (Array.isArray(parsed)) teams = parsed;
    } catch {
      // ignore malformed
    }
    if (teams.length === 2) {
      return (
        <span className="inline-flex items-center gap-1.5">
          <TeamLabel team={teams[0]} />
          <span className="opacity-60">&amp;</span>
          <TeamLabel team={teams[1]} />
        </span>
      );
    }
    return <>{answer}</>;
  }
  if (betType === "team") {
    return <TeamLabel team={answer} />;
  }
  return <>{answer}</>;
}
