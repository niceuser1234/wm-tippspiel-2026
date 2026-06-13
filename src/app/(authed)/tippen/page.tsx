import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { TippenBoard } from "@/components/tippen-board";
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

  // Gruppensieger-Wetten in eigenen kompakten Block bündeln (A–L sortiert)
  const GROUP_PREFIX = "Gruppensieger Gruppe ";
  const groupWinnerBets = bets
    .filter((b) => b.title.startsWith(GROUP_PREFIX))
    .sort((a, b) => a.title.localeCompare(b.title, "de"));
  const mainBets = bets.filter((b) => !b.title.startsWith(GROUP_PREFIX));

  return (
    <div className="px-4 py-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="display-heading text-2xl text-night">⚽ Tippen</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Tipps bis zum Anpfiff änderbar
        </p>
      </div>

      <TippenBoard
        matches={matches}
        matchTips={matchTips}
        mainBets={mainBets}
        groupWinnerBets={groupWinnerBets}
        betTips={betTips}
      />
    </div>
  );
}
