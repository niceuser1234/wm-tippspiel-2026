/**
 * Handgeschriebene DB-Typen — Quelle der Wahrheit ist supabase/migrations/.
 * Inline-Definitionen (statt Typ-Aliase) damit @supabase/supabase-js die
 * generischen Constraint-Typen korrekt auflösen kann.
 */

export type Stage =
  | "group"
  | "r32"
  | "r16"
  | "qf"
  | "sf"
  | "third_place"
  | "final";

export type BetType = "team" | "number" | "text" | "two_teams" | "round";

// ---- Convenience-Types für direkten Import ----
export interface Profile {
  id: string;
  display_name: string;
  paid: boolean;
  is_admin: boolean;
}

export interface Match {
  id: string;
  stage: Stage;
  home_team: string;
  away_team: string;
  kickoff_at: string;
  home_score: number | null;
  away_score: number | null;
}

export interface MatchTip {
  id: string;
  user_id: string;
  match_id: string;
  home_tip: number;
  away_tip: number;
  created_at: string;
}

export interface SpecialBet {
  id: string;
  title: string;
  bet_type: BetType;
  options: string[] | null;
  points_value: number;
  lock_at: string;
  correct_answer: string | null;
  is_blind: boolean;
}

export interface SpecialBetTip {
  id: string;
  user_id: string;
  special_bet_id: string;
  answer: string;
  created_at: string;
}

export interface LeaderboardRow {
  id: string | null;
  display_name: string | null;
  paid: boolean | null;
  match_points: number | null;
  special_points: number | null;
  total_points: number | null;
  exact_count: number | null;
}

/** Supabase-Database-Typ für createClient<Database>. Inline-Typen sind Pflicht
 *  damit die column-select-Typ-Inferenz von supabase-js nicht auf `never` fällt. */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          paid: boolean;
          is_admin: boolean;
        };
        Insert: {
          id: string;
          display_name?: string;
          paid?: boolean;
          is_admin?: boolean;
        };
        Update: {
          id?: string;
          display_name?: string;
          paid?: boolean;
          is_admin?: boolean;
        };
        Relationships: [];
      };
      matches: {
        Row: {
          id: string;
          stage: Stage;
          home_team: string;
          away_team: string;
          kickoff_at: string;
          home_score: number | null;
          away_score: number | null;
        };
        Insert: {
          id?: string;
          stage: Stage;
          home_team: string;
          away_team: string;
          kickoff_at: string;
          home_score?: number | null;
          away_score?: number | null;
        };
        Update: {
          id?: string;
          stage?: Stage;
          home_team?: string;
          away_team?: string;
          kickoff_at?: string;
          home_score?: number | null;
          away_score?: number | null;
        };
        Relationships: [];
      };
      match_tips: {
        Row: {
          id: string;
          user_id: string;
          match_id: string;
          home_tip: number;
          away_tip: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          match_id: string;
          home_tip: number;
          away_tip: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          match_id?: string;
          home_tip?: number;
          away_tip?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      special_bets: {
        Row: {
          id: string;
          title: string;
          bet_type: BetType;
          options: string[] | null;
          points_value: number;
          lock_at: string;
          correct_answer: string | null;
          is_blind: boolean;
        };
        Insert: {
          id?: string;
          title: string;
          bet_type: BetType;
          options?: string[] | null;
          points_value: number;
          lock_at: string;
          correct_answer?: string | null;
          is_blind?: boolean;
        };
        Update: {
          id?: string;
          title?: string;
          bet_type?: BetType;
          options?: string[] | null;
          points_value?: number;
          lock_at?: string;
          correct_answer?: string | null;
          is_blind?: boolean;
        };
        Relationships: [];
      };
      special_bet_tips: {
        Row: {
          id: string;
          user_id: string;
          special_bet_id: string;
          answer: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          special_bet_id: string;
          answer: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          special_bet_id?: string;
          answer?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      leaderboard: {
        Row: {
          id: string | null;
          display_name: string | null;
          paid: boolean | null;
          match_points: number | null;
          special_points: number | null;
          total_points: number | null;
          exact_count: number | null;
        };
        // Required by GenericNonUpdatableView — without it Schema collapses to never
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
