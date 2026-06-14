/**
 * Scoring-Helper fürs UI-Display (Punkte-Badges in der Übersicht).
 * Die maßgebliche Berechnung läuft in der `leaderboard`-View (SQL) —
 * beide MÜSSEN identisch sein.
 *
 * Punktelogik Spieltipps:
 *   - Exaktes Ergebnis            → 6
 *   - Richtige Tendenz (Sieg/Unentschieden/Niederlage), nicht exakt → 3
 *   - Falsch                      → 0
 */

export function calcMatchPoints(
  tip: { home_tip: number; away_tip: number },
  result: { home_score: number; away_score: number }
): 0 | 3 | 6 {
  // Exaktes Ergebnis
  if (tip.home_tip === result.home_score && tip.away_tip === result.away_score) {
    return 6;
  }
  // Gleiche Tendenz (Sieg/Unentschieden/Niederlage)
  const tipTendenz = Math.sign(tip.home_tip - tip.away_tip);
  const resultTendenz = Math.sign(result.home_score - result.away_score);
  if (tipTendenz === resultTendenz) {
    return 3;
  }
  return 0;
}

/** CSS-Klassen für Punkte-Badges — wm-pts-System aus globals.css. */
export const POINTS_COLORS: Record<0 | 3 | 6, string> = {
  6: "wm-pts wm-pts--4 badge-exact",
  3: "wm-pts wm-pts--3 anim-pop",
  0: "wm-pts wm-pts--0",
};
