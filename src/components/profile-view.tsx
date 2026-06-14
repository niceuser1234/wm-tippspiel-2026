import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { withRanks } from "@/lib/rank";
import { pointsForTip } from "@/lib/scoring";
import { ProfileHeader } from "@/components/profile-header";
import { ProfileTipList, type ProfileTipItem } from "@/components/profile-tip-list";
import type { Match, TipReaction, TipComment } from "@/types/database";

interface ReactionRaw {
  id: string;
  match_tip_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
  profiles: { display_name: string } | null;
}

interface CommentRaw {
  id: string;
  match_tip_id: string;
  author_id: string;
  body: string;
  created_at: string;
  profiles: { display_name: string; avatar_url: string | null } | null;
}

interface TipRow {
  id: string;
  user_id: string;
  match_id: string;
  home_tip: number;
  away_tip: number;
}

interface ProfileViewProps {
  targetId: string;
  viewerId: string;
}

export async function ProfileView({ targetId, viewerId }: ProfileViewProps) {
  const supabase = await createClient();

  // Profil
  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", targetId).single();
  if (!profile) notFound();

  // Rang + Punkte aus leaderboard-View
  const { data: lbRows } = await supabase.from("leaderboard").select("*");
  const ranked = withRanks(lbRows ?? []);
  const me = ranked.find((r) => r.id === targetId) ?? null;

  // Spiele (für Ergebnis/Teams/kickoff)
  const { data: matchesRaw } = await supabase.from("matches").select("*");
  const matches: Match[] = matchesRaw ?? [];
  const matchById = new Map(matches.map((m) => [m.id, m]));

  // ALLE sichtbaren Tipps (RLS: fremde nur nach Anpfiff) — für "closest" pro Spiel
  const { data: allTipsRaw } = await supabase
    .from("match_tips").select("id, user_id, match_id, home_tip, away_tip");
  const allTips: TipRow[] = (allTipsRaw as TipRow[] | null) ?? [];

  // Tipps des Ziel-Users
  const targetTips = allTips.filter((t) => t.user_id === targetId);

  // Tipps pro Spiel (für closest)
  const tipsByMatch = new Map<string, TipRow[]>();
  for (const t of allTips) {
    const arr = tipsByMatch.get(t.match_id) ?? [];
    arr.push(t);
    tipsByMatch.set(t.match_id, arr);
  }

  // Trefferquote: gewertete Spiele (mit Ergebnis), die der User getippt hat
  let scored = 0;
  let scoredHits = 0;

  const now = new Date();
  const items: ProfileTipItem[] = targetTips
    .map((t): ProfileTipItem | null => {
      const m = matchById.get(t.match_id);
      if (!m) return null;
      const hasResult = m.home_score !== null && m.away_score !== null;
      const hasStarted = new Date(m.kickoff_at) <= now;
      let points: number | null = null;
      if (hasResult) {
        const result = { home_score: m.home_score!, away_score: m.away_score! };
        points = pointsForTip(t, result, tipsByMatch.get(t.match_id) ?? [t]);
        scored += 1;
        if (points > 0) scoredHits += 1;
      }
      return {
        matchTipId: t.id,
        homeTeam: m.home_team,
        awayTeam: m.away_team,
        kickoffAt: m.kickoff_at,
        homeScore: m.home_score,
        awayScore: m.away_score,
        homeTip: t.home_tip,
        awayTip: t.away_tip,
        points,
        hasStarted,
      };
    })
    .filter((x): x is ProfileTipItem => x !== null)
    .sort((a, b) => new Date(b.kickoffAt).getTime() - new Date(a.kickoffAt).getTime());

  const hitRatePct = scored === 0 ? null : Math.round((scoredHits / scored) * 100);

  // Reaktionen für die sichtbaren Tipps des Ziel-Users
  const targetTipIds = targetTips.map((t) => t.id);
  let reactions: (TipReaction & { display_name: string })[] = [];
  if (targetTipIds.length) {
    const { data } = await supabase
      .from("tip_reactions")
      .select("*, profiles(display_name)")
      .in("match_tip_id", targetTipIds);
    reactions = ((data as ReactionRaw[] | null) ?? []).map((r) => ({
      id: r.id, match_tip_id: r.match_tip_id, user_id: r.user_id, emoji: r.emoji, created_at: r.created_at,
      display_name: r.profiles?.display_name ?? "Unbekannt",
    }));
  }

  // Kommentare für die sichtbaren Tipps des Ziel-Users
  let comments: (TipComment & { display_name: string; avatar_url: string | null })[] = [];
  if (targetTipIds.length) {
    const { data } = await supabase
      .from("tip_comments")
      .select("*, profiles(display_name, avatar_url)")
      .in("match_tip_id", targetTipIds)
      .order("created_at", { ascending: true });
    comments = ((data as CommentRaw[] | null) ?? []).map((c) => ({
      id: c.id, match_tip_id: c.match_tip_id, author_id: c.author_id, body: c.body, created_at: c.created_at,
      display_name: c.profiles?.display_name ?? "Unbekannt",
      avatar_url: c.profiles?.avatar_url ?? null,
    }));
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
      <ProfileHeader
        displayName={profile.display_name || "Anonym"}
        avatarUrl={profile.avatar_url}
        paid={profile.paid}
        rank={me?.rank ?? null}
        totalPoints={me?.total_points ?? 0}
        matchPoints={me?.match_points ?? 0}
        specialPoints={me?.special_points ?? 0}
        exactCount={me?.exact_count ?? 0}
        hitRatePct={hitRatePct}
      />
      <ProfileTipList items={items} viewerId={viewerId} reactions={reactions} comments={comments} />
    </div>
  );
}
