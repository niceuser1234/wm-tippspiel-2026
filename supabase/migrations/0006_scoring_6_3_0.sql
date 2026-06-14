-- =============================================================================
-- 0006_scoring_6_3_0.sql — Spieltipp-Punktelogik vereinfacht
--
--   Exaktes Ergebnis            → 6  (vorher 4)
--   Richtige Tendenz, nicht exakt → 3  (vorher: Tordifferenz 3 / Tendenz 2)
--   Falsch                      → 0
--
-- Die Tordifferenz-Zwischenstufe entfällt. Sonderwetten unverändert.
-- View mit avatar_url (aus 0004) beibehalten.
-- =============================================================================

CREATE OR REPLACE VIEW leaderboard
  WITH (security_invoker = true)
AS
WITH
match_pts AS (
  SELECT
    mt.user_id,
    SUM(
      CASE
        WHEN mt.home_tip = m.home_score
         AND mt.away_tip = m.away_score            THEN 6
        WHEN SIGN(mt.home_tip - mt.away_tip)
           = SIGN(m.home_score - m.away_score)     THEN 3
        ELSE 0
      END
    )                                              AS pts,
    COUNT(*) FILTER (
      WHERE mt.home_tip = m.home_score
        AND mt.away_tip = m.away_score
    )                                              AS exact_count
  FROM match_tips mt
  JOIN matches m ON m.id = mt.match_id
  WHERE m.home_score IS NOT NULL
    AND m.away_score IS NOT NULL
  GROUP BY mt.user_id
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
