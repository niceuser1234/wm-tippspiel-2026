-- =============================================================================
-- 0004_avatars.sql — Profilbilder
--
--   1. profiles.avatar_url (öffentliche Storage-URL des Profilbilds)
--   2. leaderboard-View um avatar_url erweitert (für alle sichtbar)
--   3. Storage-Bucket "avatars" (public) + RLS-Policies
--      - public read (Bild für alle sichtbar)
--      - INSERT/UPDATE/DELETE nur im eigenen Ordner ({uid}/...)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Spalte
-- ---------------------------------------------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- ---------------------------------------------------------------------------
-- 2. Leaderboard-View neu (avatar_url ans Ende angehängt — CREATE OR REPLACE
--    erlaubt nur das Anhängen neuer Spalten)
-- ---------------------------------------------------------------------------
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
         AND mt.away_tip = m.away_score            THEN 4
        WHEN (mt.home_tip - mt.away_tip)
           = (m.home_score - m.away_score)         THEN 3
        WHEN SIGN(mt.home_tip - mt.away_tip)
           = SIGN(m.home_score - m.away_score)     THEN 2
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

-- ---------------------------------------------------------------------------
-- 3. Storage-Bucket + Policies
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "avatars_public_read"  ON storage.objects;
DROP POLICY IF EXISTS "avatars_insert_own"   ON storage.objects;
DROP POLICY IF EXISTS "avatars_update_own"   ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete_own"   ON storage.objects;

-- Bilder für alle lesbar
CREATE POLICY "avatars_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Nur ins eigene Verzeichnis schreiben ({uid}/datei)
CREATE POLICY "avatars_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
