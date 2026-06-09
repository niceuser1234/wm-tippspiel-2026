/**
 * Scoring-Helper fürs UI-Display (Punkte-Badges in der Übersicht).
 * Die maßgebliche Berechnung läuft in der `leaderboard`-View (SQL).
 * Diese Funktion dupliziert die Logik ausschließlich für die Anzeige
 * von Einzel-Tipp-Badges (+4 / +3 / +2 / 0).
 */

export function calcMatchPoints(
  tip: { home_tip: number; away_tip: number },
  result: { home_score: number; away_score: number }
): 0 | 2 | 3 | 4 {
  // Exaktes Ergebnis
  if (tip.home_tip === result.home_score && tip.away_tip === result.away_score) {
    return 4;
  }
  // Gleiche Tordifferenz (aber nicht exakt)
  if (
    tip.home_tip - tip.away_tip ===
    result.home_score - result.away_score
  ) {
    return 3;
  }
  // Gleiche Tendenz (Sieg/Unentschieden/Niederlage)
  const tipTendenz = Math.sign(tip.home_tip - tip.away_tip);
  const resultTendenz = Math.sign(result.home_score - result.away_score);
  if (tipTendenz === resultTendenz) {
    return 2;
  }
  return 0;
}

/** Tailwind-Klassen für Punkte-Badges (Text-Farbe + Hintergrund). */
export const POINTS_COLORS: Record<0 | 2 | 3 | 4, string> = {
  4: "bg-amber-100 text-amber-700 border-amber-300",   // Gold — exakt
  3: "bg-green-100 text-green-700 border-green-300",   // Grün — Tordifferenz
  2: "bg-emerald-50 text-emerald-600 border-emerald-200", // Heller grün — Tendenz
  0: "bg-slate-100 text-slate-400 border-slate-200",   // Grau — daneben
};
