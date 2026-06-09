-- =============================================================================
-- 0002_rls.sql — WM 2026 Tippspiel: Row Level Security + Signup-Trigger
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enable RLS on all tables
-- ---------------------------------------------------------------------------
ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches          ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_tips       ENABLE ROW LEVEL SECURITY;
ALTER TABLE special_bets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE special_bet_tips ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- profiles
-- =============================================================================

-- Alle eingeloggten User können alle Profile sehen (Rangliste braucht Namen)
CREATE POLICY "profiles_select_authenticated"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- Nur eigene Zeile updaten; Spalten-Grant beschränkt auf display_name —
-- sonst könnte sich jeder User selbst is_admin/paid setzen (paid/is_admin nur via Dashboard/Service-Role)
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING     (id = auth.uid())
  WITH CHECK (id = auth.uid());

REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (display_name) ON profiles TO authenticated;

-- Kein INSERT durch User — übernimmt der Trigger unten (SECURITY DEFINER)

-- ---------------------------------------------------------------------------
-- Signup-Trigger: legt profiles-Zeile an, sobald ein neuer auth.user entsteht
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, '')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- matches — öffentlich lesbar, nur Admin schreibt
-- =============================================================================

CREATE POLICY "matches_public_read"
  ON matches FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "matches_admin_write"
  ON matches FOR ALL
  TO authenticated
  USING     ((SELECT is_admin FROM profiles WHERE id = auth.uid()))
  WITH CHECK ((SELECT is_admin FROM profiles WHERE id = auth.uid()));

-- =============================================================================
-- special_bets — öffentlich lesbar, nur Admin schreibt
-- =============================================================================

CREATE POLICY "special_bets_public_read"
  ON special_bets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "special_bets_admin_write"
  ON special_bets FOR ALL
  TO authenticated
  USING     ((SELECT is_admin FROM profiles WHERE id = auth.uid()))
  WITH CHECK ((SELECT is_admin FROM profiles WHERE id = auth.uid()));

-- =============================================================================
-- match_tips
-- =============================================================================

-- SELECT: eigene Tipps immer; fremde erst nach Anpfiff
CREATE POLICY "match_tips_select_reveal"
  ON match_tips FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR now() >= (SELECT kickoff_at FROM matches WHERE id = match_id)
  );

-- INSERT: nur eigene, nur vor Anpfiff
CREATE POLICY "match_tips_insert_before_kickoff"
  ON match_tips FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND now() < (SELECT kickoff_at FROM matches WHERE id = match_id)
  );

-- UPDATE: nur eigene, nur vor Anpfiff (G2)
CREATE POLICY "match_tips_update_before_kickoff"
  ON match_tips FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND now() < (SELECT kickoff_at FROM matches WHERE id = match_id)
  )
  WITH CHECK (
    user_id = auth.uid()
    AND now() < (SELECT kickoff_at FROM matches WHERE id = match_id)
  );

-- DELETE: keine Policy → kein Löschen möglich

-- =============================================================================
-- special_bet_tips
-- =============================================================================

-- SELECT: eigene immer; normale Wetten nach lock_at; Blind Bets erst ab Turnierende
CREATE POLICY "special_bet_tips_select_reveal"
  ON special_bet_tips FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      (SELECT is_blind FROM special_bets WHERE id = special_bet_id) = false
      AND now() >= (SELECT lock_at FROM special_bets WHERE id = special_bet_id)
    )
    OR (
      (SELECT is_blind FROM special_bets WHERE id = special_bet_id) = true
      AND now() >= '2026-07-19 21:00:00+00'
    )
  );

-- INSERT: nur eigene, nur vor lock_at
CREATE POLICY "special_bet_tips_insert_before_lock"
  ON special_bet_tips FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND now() < (SELECT lock_at FROM special_bets WHERE id = special_bet_id)
  );

-- UPDATE: nur eigene, nur vor lock_at (G2)
CREATE POLICY "special_bet_tips_update_before_lock"
  ON special_bet_tips FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND now() < (SELECT lock_at FROM special_bets WHERE id = special_bet_id)
  )
  WITH CHECK (
    user_id = auth.uid()
    AND now() < (SELECT lock_at FROM special_bets WHERE id = special_bet_id)
  );

-- DELETE: keine Policy → kein Löschen möglich
