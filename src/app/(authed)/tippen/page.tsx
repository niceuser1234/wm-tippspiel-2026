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

  const hasAnything = matches.length > 0 || bets.length > 0;

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="display-heading text-2xl text-night">
          ⚽ Tippen
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Tipps bis zum Anpfiff änderbar
        </p>
      </div>

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
              <div className="flex flex-col gap-3">
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

          {bets.length > 0 && (
            <section>
              <h2 className="text-base font-bold text-night mb-3">
                Sonderwetten
              </h2>
              <div className="flex flex-col gap-3">
                {bets.map((bet) => (
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
