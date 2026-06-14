/**
 * Server-renderbare Karte für ein einzelnes Spiel in der Übersicht.
 * Kein "use client" — reines JSX, keine Hooks/Events.
 *
 * Sichtbarkeits-Logik (WICHTIG):
 * Die Tipps anderer Teilnehmer werden ONLY angezeigt, wenn kickoff_at
 * in der Vergangenheit liegt. Das ist eine UI-Duplikation der RLS-Logik —
 * die eigentliche Sicherheit liegt in der Datenbank (RLS-Policy auf
 * match_tips: "kickoff_at < now()"). Selbst wenn jemand diese UI-Prüfung
 * umgeht, liefert die DB vor Anpfiff nur die eigene Zeile zurück.
 */

import { calcMatchPoints, POINTS_COLORS, tipDistance, isExactTip } from "@/lib/scoring";
import { TeamLabel } from "@/components/team-label";
import { Avatar } from "@/components/avatar";
import type { Match } from "@/types/database";

interface TipWithName {
  home_tip: number;
  away_tip: number;
  display_name: string;
  avatar_url: string | null;
  user_id: string;
}

interface MatchRevealCardProps {
  match: Match;
  /** null = noch verdeckt (vor Anpfiff, RLS liefert nichts außer eigenem Tipp) */
  tips: TipWithName[] | null;
  ownTip: { home_tip: number; away_tip: number } | null;
  currentUserId: string;
}

export function MatchRevealCard({
  match,
  tips,
  ownTip,
  currentUserId,
}: MatchRevealCardProps) {
  const now = new Date();
  const kickoff = new Date(match.kickoff_at);
  const hasStarted = kickoff <= now;
  const hasResult =
    match.home_score !== null && match.away_score !== null;

  // Lesbare Anstoßzeit
  const kickoffLabel = kickoff.toLocaleString("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header: Teams + Zeit */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 flex justify-start">
            <TeamLabel
              team={match.home_team}
              className="font-semibold text-night text-sm"
            />
          </div>
          <span className="text-xs font-black italic text-muted-foreground px-2">
            vs
          </span>
          <div className="flex-1 flex justify-end">
            <TeamLabel
              team={match.away_team}
              className="font-semibold text-night text-sm"
            />
          </div>
        </div>

        {/* Ergebnis oder Anstoßzeit */}
        {hasResult ? (
          <div className="mt-2 text-center">
            <span className="text-3xl font-black italic text-night tabular-nums">
              {match.home_score} : {match.away_score}
            </span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center mt-1">
            {hasStarted ? "⏱ läuft…" : kickoffLabel + " Uhr"}
          </p>
        )}
      </div>

      {/* Body: Tipp-Zustand */}
      <div className="px-4 pb-4">
        {/* VOR ANPFIFF */}
        {!hasStarted && (
          <>
            {ownTip ? (
              <div className="mt-2 flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                <span className="text-sm">🔒</span>
                <span className="font-bold tabular-nums text-night">
                  {ownTip.home_tip} : {ownTip.away_tip}
                </span>
                <span className="text-xs text-muted-foreground ml-auto">
                  dein Tipp
                </span>
              </div>
            ) : (
              <div className="mt-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700">
                Noch nicht getippt —{" "}
                <span className="font-medium">schnell zum Tippen-Tab! ⚽</span>
              </div>
            )}
            {tips && tips.length > 1 && (
              <p className="text-xs text-muted-foreground mt-2 text-right">
                {tips.length - 1} andere{tips.length - 1 === 1 ? "" : ""} {tips.length - 1 === 1 ? "hat" : "haben"} bereits getippt
              </p>
            )}
          </>
        )}

        {/* NACH ANPFIFF — Tips-Grid */}
        {hasStarted && tips && tips.length > 0 && (() => {
          // "Am nächsten dran": kleinste Tor-Distanz unter den nicht-exakten Tipps
          const result = hasResult
            ? { home_score: match.home_score!, away_score: match.away_score! }
            : null;
          let minDist = Infinity;
          if (result) {
            for (const t of tips) {
              if (!isExactTip(t, result)) {
                minDist = Math.min(minDist, tipDistance(t, result));
              }
            }
          }
          return (
          <div className="mt-3 space-y-1.5">
            {tips.map((tip) => {
              const isOwn = tip.user_id === currentUserId;
              const isClosest =
                result !== null &&
                !isExactTip(tip, result) &&
                tipDistance(tip, result) === minDist;
              const pts = result ? calcMatchPoints(tip, result, isClosest) : null;

              return (
                <div
                  key={tip.user_id}
                  className={[
                    "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors",
                    isOwn
                      ? "bg-amber-50 border border-amber-200"
                      : "bg-slate-50 border border-slate-100",
                  ].join(" ")}
                >
                  {/* Avatar + Name */}
                  <Avatar name={tip.display_name} url={tip.avatar_url} size={26} />
                  <span
                    className={[
                      "flex-1 truncate",
                      isOwn ? "font-bold text-night" : "text-slate-600",
                    ].join(" ")}
                  >
                    {isOwn ? "Du" : tip.display_name}
                  </span>

                  {/* Tipp */}
                  <span className="font-bold tabular-nums text-night">
                    {tip.home_tip} : {tip.away_tip}
                  </span>

                  {/* Punkte-Badge */}
                  {pts !== null ? (
                    <span className={POINTS_COLORS[pts]}>
                      {pts > 0 ? `+${pts}` : "0"}
                    </span>
                  ) : (
                    <span className="wm-pts wm-pts--live">
                      läuft…
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          );
        })()}

        {/* NACH ANPFIFF — keine Tipps vorhanden */}
        {hasStarted && (!tips || tips.length === 0) && (
          <p className="mt-2 text-xs text-muted-foreground text-center">
            Keine Tipps für dieses Spiel
          </p>
        )}
      </div>
    </div>
  );
}
