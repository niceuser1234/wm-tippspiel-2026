-- =============================================================================
-- 0008_social.sql — Reaktionen, Kommentare, Feature-Requests
-- Reveal-Gate spiegelt match_tips-Policy: Interaktion erst nach Anpfiff.
-- DROP POLICY IF EXISTS vor jedem CREATE → re-runnable (wie 0004).
-- =============================================================================

CREATE TABLE IF NOT EXISTS tip_reactions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  match_tip_id uuid        NOT NULL REFERENCES match_tips ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES profiles   ON DELETE CASCADE,
  emoji        text        NOT NULL CHECK (emoji IN ('😂','🔥','👀','😱','👏')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_tip_id, user_id, emoji)
);
CREATE INDEX IF NOT EXISTS tip_reactions_match_tip_id_idx ON tip_reactions (match_tip_id);

CREATE TABLE IF NOT EXISTS tip_comments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  match_tip_id uuid        NOT NULL REFERENCES match_tips ON DELETE CASCADE,
  author_id    uuid        NOT NULL REFERENCES profiles   ON DELETE CASCADE,
  body         text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 200),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tip_comments_match_tip_id_idx ON tip_comments (match_tip_id);

CREATE TABLE IF NOT EXISTS feature_requests (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES profiles ON DELETE CASCADE,
  body       text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tip_reactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tip_comments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_requests ENABLE ROW LEVEL SECURITY;

-- Explizite Grants (defensiv; Supabase-Default-Privileges decken public-Tabellen i.d.R. ab)
GRANT SELECT, INSERT, DELETE ON tip_reactions    TO authenticated;
GRANT SELECT, INSERT, DELETE ON tip_comments     TO authenticated;
GRANT SELECT, INSERT          ON feature_requests TO authenticated;

-- ---- tip_reactions: sichtbar/erstellbar nur nach Anpfiff des zugehörigen Spiels ----
DROP POLICY IF EXISTS "tip_reactions_select_reveal"          ON tip_reactions;
DROP POLICY IF EXISTS "tip_reactions_insert_own_after_kickoff" ON tip_reactions;
DROP POLICY IF EXISTS "tip_reactions_delete_own"             ON tip_reactions;

CREATE POLICY "tip_reactions_select_reveal"
  ON tip_reactions FOR SELECT TO authenticated
  USING (
    now() >= (SELECT m.kickoff_at FROM matches m
              JOIN match_tips mt ON mt.match_id = m.id
              WHERE mt.id = match_tip_id)
  );

CREATE POLICY "tip_reactions_insert_own_after_kickoff"
  ON tip_reactions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND now() >= (SELECT m.kickoff_at FROM matches m
                  JOIN match_tips mt ON mt.match_id = m.id
                  WHERE mt.id = match_tip_id)
  );

CREATE POLICY "tip_reactions_delete_own"
  ON tip_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ---- tip_comments: analog, author_id ----
DROP POLICY IF EXISTS "tip_comments_select_reveal"           ON tip_comments;
DROP POLICY IF EXISTS "tip_comments_insert_own_after_kickoff" ON tip_comments;
DROP POLICY IF EXISTS "tip_comments_delete_own"              ON tip_comments;

CREATE POLICY "tip_comments_select_reveal"
  ON tip_comments FOR SELECT TO authenticated
  USING (
    now() >= (SELECT m.kickoff_at FROM matches m
              JOIN match_tips mt ON mt.match_id = m.id
              WHERE mt.id = match_tip_id)
  );

CREATE POLICY "tip_comments_insert_own_after_kickoff"
  ON tip_comments FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND now() >= (SELECT m.kickoff_at FROM matches m
                  JOIN match_tips mt ON mt.match_id = m.id
                  WHERE mt.id = match_tip_id)
  );

CREATE POLICY "tip_comments_delete_own"
  ON tip_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid());

-- ---- feature_requests: eigene anlegen/lesen; Admin liest alle ----
DROP POLICY IF EXISTS "feature_requests_insert_own"          ON feature_requests;
DROP POLICY IF EXISTS "feature_requests_select_own_or_admin" ON feature_requests;

CREATE POLICY "feature_requests_insert_own"
  ON feature_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "feature_requests_select_own_or_admin"
  ON feature_requests FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (SELECT is_admin FROM profiles WHERE id = auth.uid())
  );
