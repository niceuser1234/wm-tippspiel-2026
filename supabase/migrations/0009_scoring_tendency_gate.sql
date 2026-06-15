-- =============================================================================
-- 0009_scoring_tendency_gate.sql — "Am nächsten dran" nur bei richtiger Tendenz
--
-- Fix: Bisher (0007) bekam der Tipp mit der kleinsten Tor-Distanz 5 Punkte,
-- AUCH bei falscher Tendenz (z.B. 2:1 auf ein 2:2 → falsche Tendenz, aber nah).
-- Neu: 5 zählt nur, wenn die Tendenz stimmt. Die kleinste Distanz wird nur
-- unter den tendenz-richtigen, nicht-exakten Tipps bestimmt.
--
--   Exaktes Ergebnis                                          → 7
--   Am nächsten dran (kleinste Distanz UNTER richtiger Tendenz) → 5
--   Richtige Tendenz                                           → 3
--   Falsche Tendenz                                            → 0
-- =============================================================================

CREATE OR REPLACE VIEW leaderboard
  WITH (security_invoker = true)
AS
WITH
match_scored AS (
  SELECT
    mt.user_id,
    mt.match_id,
    (mt.home_tip = m.home_score AND mt.away_tip = m.away_score) AS is_exact,
    (ABS(mt.home_tip - m.home_score) + ABS(mt.away_tip - m.away_score)) AS dist,
    (SIGN(mt.home_tip - mt.away_tip) = SIGN(m.home_score - m.away_score)) AS tend_ok
  FROM match_tips mt
  JOIN matches m ON m.id = mt.match_id
  WHERE m.home_score IS NOT NULL
    AND m.away_score IS NOT NULL
),
-- Kleinste Distanz je Spiel — NUR nicht-exakte UND tendenz-richtige Tipps
match_mindist AS (
  SELECT match_id, MIN(dist) AS mindist
  FROM match_scored
  WHERE NOT is_exact AND tend_ok
  GROUP BY match_id
),
match_pts AS (
  SELECT
    ms.user_id,
    SUM(
      CASE
        WHEN ms.is_exact                          THEN 7
        WHEN ms.tend_ok AND ms.dist = md.mindist  THEN 5
        WHEN ms.tend_ok                           THEN 3
        ELSE 0
      END
    ) AS pts,
    COUNT(*) FILTER (WHERE ms.is_exact) AS exact_count
  FROM match_scored ms
  LEFT JOIN match_mindist md ON md.match_id = ms.match_id
  GROUP BY ms.user_id
),
simple_special_pts AS (
  SELECT sbt.user_id, SUM(sb.points_value) AS pts
  FROM special_bet_tips sbt
  JOIN special_bets sb ON sb.id = sbt.special_bet_id
  WHERE sb.correct_answer IS NOT NULL
    AND sb.bet_type IN ('team', 'text', 'round')
    AND sbt.answer = sb.correct_answer
  GROUP BY sbt.user_id
),
number_pts AS (
  SELECT sbt.user_id, SUM(sb.points_value) AS pts
  FROM special_bet_tips sbt
  JOIN special_bets sb ON sb.id = sbt.special_bet_id
  WHERE sb.bet_type = 'number'
    AND sb.correct_answer IS NOT NULL
    AND sbt.answer ~ '^[0-9]+$'
    AND ABS(sbt.answer::numeric - sb.correct_answer::numeric) = (
      SELECT MIN(ABS(s2.answer::numeric - sb.correct_answer::numeric))
      FROM special_bet_tips s2
      WHERE s2.special_bet_id = sb.id
        AND s2.answer ~ '^[0-9]+$'
    )
  GROUP BY sbt.user_id
),
two_team_pts AS (
  SELECT
    sbt.user_id,
    SUM(
      (sb.points_value / 2) * (
        SELECT COUNT(*)
        FROM jsonb_array_elements_text(sbt.answer::jsonb) AS tip(team)
        WHERE tip.team IN (
          SELECT jsonb_array_elements_text(sb.correct_answer::jsonb)
        )
      )
    ) AS pts
  FROM special_bet_tips sbt
  JOIN special_bets sb ON sb.id = sbt.special_bet_id
  WHERE sb.bet_type = 'two_teams'
    AND sb.correct_answer IS NOT NULL
  GROUP BY sbt.user_id
),
special_pts AS (
  SELECT user_id, SUM(pts) AS pts
  FROM (
    SELECT user_id, pts FROM simple_special_pts
    UNION ALL
    SELECT user_id, pts FROM number_pts
    UNION ALL
    SELECT user_id, pts FROM two_team_pts
  ) combined
  GROUP BY user_id
)
SELECT
  p.id,
  p.display_name,
  p.paid,
  COALESCE(mp.pts, 0)                          AS match_points,
  COALESCE(sp.pts, 0)                          AS special_points,
  COALESCE(mp.pts, 0) + COALESCE(sp.pts, 0)   AS total_points,
  COALESCE(mp.exact_count, 0)                  AS exact_count,
  p.avatar_url                                 AS avatar_url
FROM profiles p
LEFT JOIN match_pts   mp ON mp.user_id = p.id
LEFT JOIN special_pts sp ON sp.user_id = p.id
ORDER BY total_points DESC, exact_count DESC;
