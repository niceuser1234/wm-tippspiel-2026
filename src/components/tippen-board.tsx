"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { MatchTipCard } from "@/components/match-tip-card";
import { SpecialBetCard } from "@/components/special-bet-card";
import type { Match, MatchTip, SpecialBet, SpecialBetTip } from "@/types/database";

interface Props {
  matches: Match[];
  matchTips: MatchTip[];
  mainBets: SpecialBet[];
  groupWinnerBets: SpecialBet[];
  betTips: SpecialBetTip[];
}

export function TippenBoard({
  matches,
  matchTips,
  mainBets,
  groupWinnerBets,
  betTips,
}: Props) {
  const tipByMatch = new Map(matchTips.map((t) => [t.match_id, t]));
  const tipByBet = new Map(betTips.map((t) => [t.special_bet_id, t]));

  // Abgegebene Tipps live mitzählen — sowohl Spieltipps als auch Sonderwetten.
  const [doneMatches, setDoneMatches] = useState<Set<string>>(
    () => new Set(matchTips.map((t) => t.match_id))
  );
  const [doneBets, setDoneBets] = useState<Set<string>>(
    () => new Set(betTips.map((t) => t.special_bet_id))
  );

  const handleMatchSaved = useCallback((id: string) => {
    setDoneMatches((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const handleBetSaved = useCallback((id: string) => {
    setDoneBets((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const allBetsCount = mainBets.length + groupWinnerBets.length;
  const total = matches.length + allBetsCount;
  const done = doneMatches.size + doneBets.size;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const hasAnything = total > 0;

  return (
    <>
      {total > 0 && (
        <div className="mb-7">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-semibold text-night">
              {done} von {total} Tipps abgegeben
            </span>
            <span className="text-sm font-bold tabular-nums text-[#15803d]">
              {pct}%
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#15803d] transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {!hasAnything ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-lg font-semibold text-muted-foreground">
            Keine offenen Tipps mehr ⚽
          </p>
          <Link
            href="/uebersicht"
            className="text-sm text-primary font-medium underline underline-offset-4"
          >
            Zur Übersicht →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {matches.length > 0 && (
            <section>
              <h2 className="text-base font-bold text-night mb-3">Spieltipps</h2>
              <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))]">
                {matches.map((match) => (
                  <MatchTipCard
                    key={match.id}
                    match={match}
                    existingTip={tipByMatch.get(match.id) ?? null}
                    onSaved={handleMatchSaved}
                  />
                ))}
              </div>
            </section>
          )}

          {mainBets.length > 0 && (
            <section>
              <h2 className="text-base font-bold text-night mb-3">Sonderwetten</h2>
              <div className="grid gap-3 items-start grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))]">
                {mainBets.map((bet) => (
                  <SpecialBetCard
                    key={bet.id}
                    bet={bet}
                    existingAnswer={tipByBet.get(bet.id)?.answer ?? null}
                    onSaved={handleBetSaved}
                  />
                ))}
              </div>
            </section>
          )}

          {groupWinnerBets.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-base font-bold text-night">Gruppensieger</h2>
                <span className="text-xs font-semibold text-muted-foreground bg-slate-100 rounded-full px-2 py-0.5">
                  {groupWinnerBets.length} Gruppen · je 3 Pkt.
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Wer gewinnt welche Gruppe?
              </p>
              <div className="grid gap-3 items-start grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))]">
                {groupWinnerBets.map((bet) => (
                  <SpecialBetCard
                    key={bet.id}
                    bet={bet}
                    existingAnswer={tipByBet.get(bet.id)?.answer ?? null}
                    onSaved={handleBetSaved}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
