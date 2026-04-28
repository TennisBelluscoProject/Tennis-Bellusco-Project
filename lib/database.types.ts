export type UserRole = 'maestro' | 'allievo';
export type GoalCategory = 'tecnica' | 'tattica' | 'fisico' | 'mente' | 'agonismo';
export type GoalStatus = 'planned' | 'in_progress' | 'completed';
export type SurfaceType = 'terra_rossa' | 'erba' | 'cemento' | 'sintetico';
export type MatchResult = 'win' | 'loss' | 'retired' | 'walkover';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type PlayerLevel = 'Principiante' | 'Intermedio' | 'Avanzato';

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  photo_url: string | null;
  level: string;
  ranking: string;
  active: boolean;
  approval_status: ApprovalStatus;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
}

export interface InviteLink {
  id: string;
  token: string;
  email: string;
  role: UserRole;
  invited_by: string | null;
  used_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface Goal {
  id: string;
  student_id: string;
  category: GoalCategory;
  title: string;
  description: string | null;
  status: GoalStatus;
  progress: number;
  deadline: string | null;
  sort_order: number;
  created_by: string | null;
  coach_notes: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface MatchResultRow {
  id: string;
  student_id: string;
  tournament_name: string | null;
  location: string | null;
  surface: SurfaceType | null;
  category: string | null;
  opponent_name: string | null;
  opponent_ranking: string | null;
  round: string | null;
  score: string | null;
  result: MatchResult;
  match_date: string;
  notes: string | null;
  coach_notes: string | null;
  indoor: boolean;
  created_at: string;
  // joined
  profiles?: Profile;
}

export interface GoalTemplate {
  id: string;
  category: GoalCategory;
  level: PlayerLevel;
  title: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  sort_order: number;
}

export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> };
      invite_links: { Row: InviteLink; Insert: Partial<InviteLink>; Update: Partial<InviteLink> };
      goals: { Row: Goal; Insert: Partial<Goal>; Update: Partial<Goal> };
      match_results: { Row: MatchResultRow; Insert: Partial<MatchResultRow>; Update: Partial<MatchResultRow> };
      goal_templates: { Row: GoalTemplate; Insert: Partial<GoalTemplate>; Update: Partial<GoalTemplate> };
    };
  };
}
