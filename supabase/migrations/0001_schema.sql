-- =============================================================================
-- 0001_schema.sql — WM 2026 Tippspiel: Tabellen + Constraints
-- =============================================================================

-- ---------------------------------------------------------------------------
-- profiles (extends auth.users)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name text    NOT NULL DEFAULT '',
  paid         boolean NOT NULL DEFAULT false,
  is_admin     boolean NOT NULL DEFAULT false
);

-- ---------------------------------------------------------------------------
-- matches
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS matches (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  stage       text        NOT NULL
                CHECK (stage IN ('group','r32','r16','qf','sf','third_place','final')),
  home_team   text        NOT NULL,
  away_team   text        NOT NULL,
  kickoff_at  timestamptz NOT NULL,
  home_score  int,
  away_score  int
);

-- ---------------------------------------------------------------------------
-- match_tips
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS match_tips (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES profiles  ON DELETE CASCADE,
  match_id   uuid        NOT NULL REFERENCES matches   ON DELETE CASCADE,
  home_tip   int         NOT NULL CHECK (home_tip BETWEEN 0 AND 20),
  away_tip   int         NOT NULL CHECK (away_tip BETWEEN 0 AND 20),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, match_id)
);

CREATE INDEX IF NOT EXISTS match_tips_match_id_idx ON match_tips (match_id);

-- ---------------------------------------------------------------------------
-- special_bets (Sonderwetten-Definitionen)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS special_bets (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title          text        NOT NULL,
  bet_type       text        NOT NULL
                   CHECK (bet_type IN ('team','number','text','two_teams','round')),
  options        jsonb,
  points_value   int         NOT NULL,
  lock_at        timestamptz NOT NULL,
  correct_answer text,
  is_blind       boolean     NOT NULL DEFAULT false
);

-- ---------------------------------------------------------------------------
-- special_bet_tips
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS special_bet_tips (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES profiles     ON DELETE CASCADE,
  special_bet_id uuid        NOT NULL REFERENCES special_bets ON DELETE CASCADE,
  answer         text        NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, special_bet_id)
);

CREATE INDEX IF NOT EXISTS special_bet_tips_special_bet_id_idx
  ON special_bet_tips (special_bet_id);
