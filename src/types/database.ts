/**
 * Handgeschriebene DB-Typen (DECISIONS §1) — Quelle der Wahrheit ist
 * supabase/migrations/. Bei Schemaänderung hier nachziehen.
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
  id: string;
  display_name: string;
  paid: boolean;
  match_points: number;
  special_points: number;
  total_points: number;
  exact_count: number;
}

/** Supabase-Database-Typ für createClient<Database>. */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & Pick<Profile, "id" | "display_name">;
        Update: Partial<Profile>;
        Relationships: [];
      };
      matches: {
        Row: Match;
        Insert: Omit<Match, "id" | "home_score" | "away_score"> &
          Partial<Pick<Match, "id" | "home_score" | "away_score">>;
        Update: Partial<Match>;
        Relationships: [];
      };
      match_tips: {
        Row: MatchTip;
        Insert: Omit<MatchTip, "id" | "created_at"> &
          Partial<Pick<MatchTip, "id" | "created_at">>;
        Update: Partial<MatchTip>;
        Relationships: [];
      };
      special_bets: {
        Row: SpecialBet;
        Insert: Omit<SpecialBet, "id" | "correct_answer" | "is_blind"> &
          Partial<Pick<SpecialBet, "id" | "correct_answer" | "is_blind">>;
        Update: Partial<SpecialBet>;
        Relationships: [];
      };
      special_bet_tips: {
        Row: SpecialBetTip;
        Insert: Omit<SpecialBetTip, "id" | "created_at"> &
          Partial<Pick<SpecialBetTip, "id" | "created_at">>;
        Update: Partial<SpecialBetTip>;
        Relationships: [];
      };
    };
    Views: {
      leaderboard: {
        Row: LeaderboardRow;
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
