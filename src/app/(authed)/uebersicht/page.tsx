import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { MatchRevealCard } from "@/components/match-reveal-card";
import { BetAnswer } from "@/components/team-label";
import type { Match, SpecialBet } from "@/types/database";

export const metadata: Metadata = {
  title: "Übersicht | WM 2026 Tippspiel",
};

// ---- Typen für JOINed Abfragen ----

interface MatchTipWithProfile {
  user_id: string;
  match_id: string;
  home_tip: number;
  away_tip: number;
  profiles: { display_name: string } | null;
}

interface SpecialBetTipWithProfile {
  user_id: string;
  special_bet_id: string;
  answer: string;
  profiles: { display_name: string } | null;
}

// ---- Hilfsfunktionen für Sonderwetten-Anzeige ----


function findClosestNumber(
  bet: SpecialBet,
  allTips: SpecialBetTipWithProfile[]
): number | null {
  if (bet.bet_type !== "number" || !bet.correct_answer) return null;
  const correct = parseFloat(bet.correct_answer);
  const diffs = allTips.map((t) =>
    Math.abs(parseFloat(t.answer) - correct)
  );
  return Math.min(...diffs);
}

// ---- Page ----

export default async function UebersichtPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const currentUserId = user?.id ?? "";
  const now = new Date();

  // 1. Alle Spiele, nach Anstoß sortiert
  const { data: matchesRaw } = await supabase
    .from("matches")
    .select("*")
    .order("kickoff_at", { ascending: true });

  const matches: Match[] = matchesRaw ?? [];

  // 2. Alle match_tips mit Profil-JOIN
  //    RLS: Fremde Tipps nur nach Anpfiff sichtbar — kein clientseitiger Filter nötig.
  //    Wir laden einfach alles; die DB gibt vor Anpfiff nur die eigene Zeile zurück.
  const { data: allTipsRaw } = await supabase
    .from("match_tips")
    .select("*, profiles(display_name)");

  const allTips: MatchTipWithProfile[] = (allTipsRaw as MatchTipWithProfile[] | null) ?? [];

  // 3. Alle Sonderwetten
  const { data: specialBetsRaw } = await supabase
    .from("special_bets")
    .select("*")
    .order("lock_at", { ascending: true });

  const specialBets: SpecialBet[] = specialBetsRaw ?? [];

  // 4. Alle special_bet_tips mit Profil-JOIN
  //    RLS: nur nach lock_at sichtbar (oder eigene vorher).
  const { data: specialTipsRaw } = await supabase
    .from("special_bet_tips")
    .select("*, profiles(display_name)");

  const specialTips: SpecialBetTipWithProfile[] =
    (specialTipsRaw as SpecialBetTipWithProfile[] | null) ?? [];

  // ---- Spiele in Abschnitte aufteilen ----
  const upcoming = matches.filter((m) => new Date(m.kickoff_at) > now);
  const started = matches.filter((m) => new Date(m.kickoff_at) <= now);

  // Tips-Lookup pro Match
  function tipsForMatch(matchId: string, matchKickoff: string) {
    const hasStarted = new Date(matchKickoff) <= now;
    // UI-Duplikation der RLS-Logik: Fremde Tipps nur nach Anpfiff zeigen.
    // Die DB liefert vor Anpfiff ohnehin nur die eigene Zeile — dies ist
    // ein zusätzlicher Schutz auf UI-Ebene.
    if (!hasStarted) return null;
    return allTips
      .filter((t) => t.match_id === matchId)
      .map((t) => ({
        user_id: t.user_id,
        home_tip: t.home_tip,
        away_tip: t.away_tip,
        display_name: t.profiles?.display_name ?? "Unbekannt",
      }));
  }

  function ownTipForMatch(matchId: string) {
    const tip = allTips.find(
      (t) => t.match_id === matchId && t.user_id === currentUserId
    );
    return tip ? { home_tip: tip.home_tip, away_tip: tip.away_tip } : null;
  }

  // Alle Spiele haben noch kein Ergebnis UND keines hat begonnen → freundlicher Hinweis
  const allScoresNull =
    matches.length > 0 &&
    matches.every((m) => m.home_score === null && m.away_score === null) &&
    upcoming.length === matches.length;

  return (
    <div className="px-4 py-6 max-w-6xl mx-auto">
      <h1 className="display-heading text-2xl text-night mb-6">📋 Übersicht</h1>

      {allScoresNull && (
        <div className="mb-8 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-5 text-center">
          <p className="text-2xl mb-1">⚽</p>
          <p className="font-semibold text-night text-sm">
            Die Spiele starten am 11. Juni
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Danach werden hier alle Tipps aufgedeckt.
          </p>
        </div>
      )}

      {/* ---- Laufende & abgeschlossene Spiele ---- */}
      {started.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
            Laufend / Abgeschlossen
          </h2>
          <div className="grid gap-3 items-start grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))]">
            {started.map((match) => (
              <MatchRevealCard
                key={match.id}
                match={match}
                tips={tipsForMatch(match.id, match.kickoff_at)}
                ownTip={ownTipForMatch(match.id)}
                currentUserId={currentUserId}
              />
            ))}
          </div>
        </section>
      )}

      {/* ---- Kommende Spiele ---- */}
      {upcoming.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
            Kommende Spiele
          </h2>
          <div className="grid gap-3 items-start grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))]">
            {upcoming.map((match) => (
              <MatchRevealCard
                key={match.id}
                match={match}
                tips={tipsForMatch(match.id, match.kickoff_at)}
                ownTip={ownTipForMatch(match.id)}
                currentUserId={currentUserId}
              />
            ))}
          </div>
        </section>
      )}

      {matches.length === 0 && (
        <p className="text-muted-foreground text-sm py-8 text-center">
          Noch keine Spiele eingetragen. Ab dem 11. Juni geht&apos;s los! ⚽
        </p>
      )}

      {/* ---- Sonderwetten ---- */}
      {specialBets.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
            Sonderwetten
          </h2>
          <div className="grid gap-4 items-start grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))]">
            {specialBets.map((bet) => {
              const lockTime = new Date(bet.lock_at);
              const isLocked = lockTime <= now;
              const ownSpecialTip = specialTips.find(
                (t) =>
                  t.special_bet_id === bet.id && t.user_id === currentUserId
              );
              const betsForThis = specialTips.filter(
                (t) => t.special_bet_id === bet.id
              );

              // Für Wette #3 (number): nächste Schätzung bestimmen
              const closestDiff =
                bet.bet_type === "number" && bet.correct_answer
                  ? findClosestNumber(bet, betsForThis)
                  : null;

              return (
                <div
                  key={bet.id}
                  className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
                >
                  {/* Header */}
                  <div className="px-4 pt-4 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-night text-sm flex-1">
                        {bet.title}
                      </h3>
                      <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2 py-0.5 whitespace-nowrap">
                        {bet.points_value} Pkt
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isLocked
                        ? "🔓 Tipps aufgedeckt"
                        : `🔒 Abgabe bis ${lockTime.toLocaleString("de-DE", {
                            day: "numeric",
                            month: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: "Europe/Berlin",
                          })} Uhr`}
                    </p>
                  </div>

                  {/* Body */}
                  <div className="px-4 pb-4">
                    {!isLocked ? (
                      // Vor lock_at: nur eigene Antwort zeigen
                      <>
                        {ownSpecialTip ? (
                          <div className="mt-2 flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                            <span className="text-sm">🔒</span>
                            <span className="text-sm font-bold text-night flex-1 truncate">
                              <BetAnswer betType={bet.bet_type} answer={ownSpecialTip.answer} />
                            </span>
                            <span className="text-xs text-muted-foreground">
                              dein Tipp
                            </span>
                          </div>
                        ) : (
                          <div className="mt-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700">
                            Noch nicht getippt —{" "}
                            <span className="font-medium">
                              schnell zum Tippen-Tab! ⚽
                            </span>
                          </div>
                        )}
                      </>
                    ) : (
                      // Nach lock_at: alle Antworten zeigen
                      <>
                        {/* Korrekte Antwort hervorheben */}
                        {bet.correct_answer && (
                          <div className="mt-2 mb-3 flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-3 py-2">
                            <span className="text-sm">✅</span>
                            <span className="text-sm font-bold text-green-700 flex-1 truncate">
                              <BetAnswer betType={bet.bet_type} answer={bet.correct_answer} />
                            </span>
                            <span className="text-xs text-green-600">
                              Lösung
                            </span>
                          </div>
                        )}

                        {betsForThis.length === 0 ? (
                          <p className="mt-2 text-xs text-muted-foreground text-center">
                            Keine Tipps abgegeben
                          </p>
                        ) : (
                          <div className="mt-2 space-y-1.5">
                            {betsForThis.map((tip) => {
                              const isOwn = tip.user_id === currentUserId;
                              let correct = false;
                              let partialCorrect = false;

                              if (bet.correct_answer) {
                                if (bet.bet_type === "two_teams") {
                                  // Prüfe jedes Team einzeln
                                  try {
                                    const tipSet = new Set<string>(JSON.parse(tip.answer));
                                    const correctSet = new Set<string>(
                                      JSON.parse(bet.correct_answer)
                                    );
                                    const hits = [...tipSet].filter((t) =>
                                      correctSet.has(t)
                                    ).length;
                                    correct = hits === 2;
                                    partialCorrect = hits === 1;
                                  } catch {
                                    // ignore
                                  }
                                } else if (bet.bet_type === "number") {
                                  const diff = Math.abs(
                                    parseFloat(tip.answer) -
                                      parseFloat(bet.correct_answer)
                                  );
                                  correct =
                                    closestDiff !== null &&
                                    diff === closestDiff;
                                } else {
                                  correct = tip.answer === bet.correct_answer;
                                }
                              }

                              return (
                                <div
                                  key={tip.user_id}
                                  className={[
                                    "flex items-center gap-2 rounded-xl px-3 py-2 text-sm",
                                    correct
                                      ? "bg-green-50 border border-green-200"
                                      : partialCorrect
                                      ? "bg-emerald-50 border border-emerald-200"
                                      : isOwn
                                      ? "bg-amber-50 border border-amber-200"
                                      : "bg-slate-50 border border-slate-100",
                                  ].join(" ")}
                                >
                                  <span
                                    className={[
                                      "flex-1 truncate",
                                      isOwn ? "font-bold text-night" : "text-slate-600",
                                    ].join(" ")}
                                  >
                                    {isOwn ? "Du" : (tip.profiles?.display_name ?? "Unbekannt")}
                                  </span>
                                  <span
                                    className={[
                                      "font-medium truncate max-w-[120px] text-right",
                                      correct
                                        ? "text-green-700"
                                        : partialCorrect
                                        ? "text-emerald-600"
                                        : "text-night",
                                    ].join(" ")}
                                  >
                                    <BetAnswer betType={bet.bet_type} answer={tip.answer} />
                                  </span>
                                  {correct && (
                                    <span className="text-green-600 text-xs font-bold">
                                      ✓
                                    </span>
                                  )}
                                  {partialCorrect && (
                                    <span className="text-emerald-500 text-xs font-bold">
                                      ½
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
