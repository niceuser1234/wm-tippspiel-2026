import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { LeaderboardTable } from "@/components/leaderboard-table";

export const metadata: Metadata = {
  title: "Rangliste | WM 2026 Tippspiel",
};

export default async function RanglistePage() {
  const supabase = await createClient();

  // Aktuellen User laden für Hervorhebung
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Leaderboard-View laden — bereits ORDER BY total_points DESC, exact_count DESC
  const { data: rows, error } = await supabase
    .from("leaderboard")
    .select("*");

  const currentUserId = user?.id ?? null;

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <h1 className="display-heading text-2xl text-night mb-6">🏆 Rangliste</h1>

      {error || !rows || rows.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">
          Noch keine Punkte — die Spiele laufen ab 11. Juni ⚽
        </p>
      ) : (
        <LeaderboardTable rows={rows} currentUserId={currentUserId} />
      )}
    </div>
  );
}
