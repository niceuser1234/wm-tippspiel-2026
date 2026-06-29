/**
 * Scoring-Helper fürs UI-Display (Punkte-Badges in Übersicht/Profil).
 * Die maßgebliche Berechnung läuft in der `leaderboard`-View (SQL) —
 * beide MÜSSEN identisch sein.
 *
 * Punktelogik Spieltipps:
 *   - Exaktes Ergebnis                                          → 7
 *   - Am nächsten dran: kleinste Tor-Distanz UNTER den Tipps mit
 *     RICHTIGER Tendenz (nicht exakt; bei Gleichstand alle)      → 5
 *   - Richtige Tendenz (Sieg/Unentschieden/Niederlage)           → 3
 *   - Falsche Tendenz                                            → 0
 *
 * WICHTIG: "Am nächsten dran" zählt nur bei richtiger Tendenz. Ein Tipp mit
 * falscher Tendenz bekommt nie 5 — auch wenn er rein rechnerisch am nächsten
 * lag. "Am nächsten dran" braucht ALLE Tipps eines Spiels, daher wird
 * `isClosest` vom Aufrufer (match-reveal-card) bestimmt und hier nur eingesetzt.
 */

export type MatchPoints = 0 | 3 | 5 | 7;

/** Tor-Distanz eines Tipps zum Ergebnis (für die "am nächsten dran"-Wertung). */
export function tipDistance(
  tip: { home_tip: number; away_tip: number },
  result: { home_score: number; away_score: number }
): number {
  return (
    Math.abs(tip.home_tip - result.home_score) +
    Math.abs(tip.away_tip - result.away_score)
  );
}

export function isExactTip(
  tip: { home_tip: number; away_tip: number },
  result: { home_score: number; away_score: number }
): boolean {
  return tip.home_tip === result.home_score && tip.away_tip === result.away_score;
}

/** Tendenz (Sieg/Unentschieden/Niederlage) des Tipps stimmt mit dem Ergebnis. */
export function tendencyMatches(
  tip: { home_tip: number; away_tip: number },
  result: { home_score: number; away_score: number }
): boolean {
  return (
    Math.sign(tip.home_tip - tip.away_tip) ===
    Math.sign(result.home_score - result.away_score)
  );
}

export function calcMatchPoints(
  tip: { home_tip: number; away_tip: number },
  result: { home_score: number; away_score: number },
  isClosest: boolean
): MatchPoints {
  // Exaktes Ergebnis
  if (isExactTip(tip, result)) return 7;
  const tendOk = tendencyMatches(tip, result);
  // Am nächsten dran — NUR bei richtiger Tendenz
  if (isClosest && tendOk) return 5;
  // Gleiche Tendenz, aber nicht am nächsten dran
  if (tendOk) return 3;
  return 0;
}

/** Kleinste Tor-Distanz unter den nicht-exakten Tipps MIT richtiger Tendenz.
 *  Infinity, wenn es keine solchen Tipps gibt. */
export function closestDistance(
  tips: { home_tip: number; away_tip: number }[],
  result: { home_score: number; away_score: number }
): number {
  let min = Infinity;
  for (const t of tips) {
    if (!isExactTip(t, result) && tendencyMatches(t, result)) {
      min = Math.min(min, tipDistance(t, result));
    }
  }
  return min;
}

/** Punkte eines einzelnen Tipps, gegeben ALLE Tipps des Spiels (für "am nächsten dran"). */
export function pointsForTip(
  tip: { home_tip: number; away_tip: number },
  result: { home_score: number; away_score: number },
  allTipsForMatch: { home_tip: number; away_tip: number }[]
): MatchPoints {
  // 5 Punkte gibt es nur wenn NIEMAND das exakte Ergebnis getippt hat
  const anyoneExact = allTipsForMatch.some((t) => isExactTip(t, result));
  const isClosest =
    !anyoneExact &&
    !isExactTip(tip, result) &&
    tendencyMatches(tip, result) &&
    tipDistance(tip, result) === closestDistance(allTipsForMatch, result);
  return calcMatchPoints(tip, result, isClosest);
}

/** CSS-Klassen für Punkte-Badges — wm-pts-System aus globals.css. */
export const POINTS_COLORS: Record<MatchPoints, string> = {
  7: "wm-pts wm-pts--4 badge-exact",
  5: "wm-pts wm-pts--3 anim-pop",
  3: "wm-pts wm-pts--2 anim-pop",
  0: "wm-pts wm-pts--0",
};
