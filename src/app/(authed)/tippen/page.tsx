import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MatchTipCard } from "@/components/match-tip-card";
import { SpecialBetCard } from "@/components/special-bet-card";
import type { Match, MatchTip, SpecialBet, SpecialBetTip } from "@/types/database";

export const metadata: Metadata = {
  title: "Tippen | WM 2026 Tippspiel",
};

export default async function TippenPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const now = new Date().toISOString();

  const [
    { data: openMatches },
    { data: myMatchTips },
    { data: openBets },
    { data: myBetTips },
  ] = await Promise.all([
    supabase
      .from("matches")
      .select("*")
      .gt("kickoff_at", now)
      .order("kickoff_at", { ascending: true }),
    supabase
      .from("match_tips")
      .select("*")
      .eq("user_id", user!.id),
    supabase
      .from("special_bets")
      .select("*")
      .gt("lock_at", now)
      .order("lock_at", { ascending: true }),
    supabase
      .from("special_bet_tips")
      .select("*")
      .eq("user_id", user!.id),
  ]);

  const matches: Match[] = openMatches ?? [];
  const matchTips: MatchTip[] = myMatchTips ?? [];
  const bets: SpecialBet[] = openBets ?? [];
  const betTips: SpecialBetTip[] = myBetTips ?? [];

  const tipByMatch = new Map(matchTips.map((t) => [t.match_id, t]));
  const tipByBet = new Map(betTips.map((t) => [t.special_bet_id, t]));

  // Gruppensieger-Wetten in eigenen kompakten Block bündeln (A–L sortiert)
  const GROUP_PREFIX = "Gruppensieger Gruppe ";
  const groupWinnerBets = bets
    .filter((b) => b.title.startsWith(GROUP_PREFIX))
    .sort((a, b) => a.title.localeCompare(b.title, "de"));
  const mainBets = bets.filter((b) => !b.title.startsWith(GROUP_PREFIX));

  // Fortschritt: wie viele der offenen Tipps sind abgegeben?
  const totalCount = matches.length + bets.length;
  const doneCount =
    matches.filter((m) => tipByMatch.has(m.id)).length +
    bets.filter((b) => tipByBet.has(b.id)).length;
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const hasAnything = matches.length > 0 || bets.length > 0;

  return (
    <div className="px-4 py-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="display-heading text-2xl text-night">
          ⚽ Tippen
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Tipps bis zum Anpfiff änderbar
        </p>
      </div>

      {totalCount > 0 && (
        <div className="mb-7">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-semibold text-night">
              {doneCount} von {totalCount} Tipps abgegeben
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
              <h2 className="text-base font-bold text-night mb-3">
                Spieltipps
              </h2>
              <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))]">
                {matches.map((match) => (
                  <MatchTipCard
                    key={match.id}
                    match={match}
                    existingTip={tipByMatch.get(match.id) ?? null}
                  />
                ))}
              </div>
            </section>
          )}

          {mainBets.length > 0 && (
            <section>
              <h2 className="text-base font-bold text-night mb-3">
                Sonderwetten
              </h2>
              <div className="grid gap-3 items-start grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))]">
                {mainBets.map((bet) => (
                  <SpecialBetCard
                    key={bet.id}
                    bet={bet}
                    existingAnswer={tipByBet.get(bet.id)?.answer ?? null}
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
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
