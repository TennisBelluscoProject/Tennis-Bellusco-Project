// ─── Domain enums / literal unions ─────────────────────────────────────────
//
// These are application-level enums. They mirror what the Postgres schema
// stores in dedicated `enum`/`check` columns. Keeping them as TS literal
// unions (not just `string`) gives us exhaustive switch checks at compile
// time and autocomplete everywhere they're used.

export type UserRole = 'maestro' | 'allievo';
export type GoalCategory = 'tecnica' | 'tattica' | 'fisico' | 'mente' | 'agonismo';
export type GoalStatus = 'planned' | 'in_progress' | 'completed';
export type SurfaceType = 'terra_rossa' | 'erba' | 'cemento' | 'sintetico';
export type MatchResult = 'win' | 'loss' | 'retired' | 'walkover';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type PlayerLevel = 'DELFINO' | 'CERBIATTO' | 'COCCODRILLO';

// ─── Row types (what `.select('*')` returns) ───────────────────────────────
//
// One `*Row` interface per table. These are kept exported as `Profile`,
// `Goal`, etc. for backwards compatibility with the existing codebase —
// every component imports them by these names.

export type Profile = {
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
  is_fictitious: boolean;
  created_at: string;
}

export type InviteLink = {
  id: string;
  token: string;
  email: string;
  role: UserRole;
  invited_by: string | null;
  used_at: string | null;
  expires_at: string;
  created_at: string;
}

export type Goal = {
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
  // FK opzionale al nodo di percorso che ha materializzato questo obiettivo.
  // NULL = obiettivo "libero" del Kanban; NOT NULL = obiettivo di un Percorso.
  path_node_id: string | null;
}

export type MatchResultRow = {
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
  // Joined columns when the query does `.select('*, profiles!...(...)')`.
  profiles?: Profile;
}

export type GoalTemplate = {
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

// ─── Percorsi di obiettivi (Skill Tree) ────────────────────────────────────
//
// Un Percorso e' un DAG di obiettivi-tipo: i nodi sono competenze, gli archi
// sono prerequisiti. Allo stato bloccato/sbloccato NON corrisponde una colonna:
// viene CALCOLATO attraversando il grafo (vedi lib/paths/topo.ts).

export type Path = {
  id: string;
  title: string;
  description: string | null;
  difficulty: PlayerLevel;
  created_by: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type PathNode = {
  id: string;
  path_id: string;
  goal_template_id: string | null;
  title: string;
  category: GoalCategory;
  description: string | null;
  sort_order: number;
  created_at: string;
}

// Arco del DAG: from_node_id e' PREREQUISITO di to_node_id.
export type PathEdge = {
  id: string;
  path_id: string;
  from_node_id: string;
  to_node_id: string;
  created_at: string;
}

// Istanza: un Percorso attivato per uno specifico allievo.
export type StudentPath = {
  id: string;
  student_id: string;
  path_id: string;
  activated_at: string;
  activated_by: string | null;
}

// ─── Database<T> shape expected by @supabase/supabase-js ───────────────────
//
// The Supabase TS generic expects this exact nested shape:
//   Database['public']['Tables'][TableName]['Row'   | 'Insert' | 'Update']
//
// - Row    : what `.select()` returns. Required + nullable fields are exact.
// - Insert : what `.insert(...)` accepts. Generated/DB-default columns are
//            optional; not-null required columns stay required.
// - Update : what `.update(...)` accepts. Everything is optional.
//
// Reference: https://supabase.com/docs/guides/api/rest/generating-types

type Optionalize<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Columns that have a DB default or are auto-generated (UUID, timestamps,
// boolean defaults). Insert can omit them.
type ProfileInsert = Optionalize<
  Profile,
  | 'id'
  | 'first_name'
  | 'last_name'
  | 'email'
  | 'phone'
  | 'birth_date'
  | 'photo_url'
  | 'level'
  | 'ranking'
  | 'active'
  | 'approval_status'
  | 'approved_at'
  | 'approved_by'
  | 'is_fictitious'
  | 'created_at'
>;

type InviteLinkInsert = Optionalize<
  InviteLink,
  'id' | 'invited_by' | 'used_at' | 'created_at'
>;

type GoalInsert = Optionalize<
  Goal,
  | 'id'
  | 'description'
  | 'progress'
  | 'deadline'
  | 'sort_order'
  | 'created_by'
  | 'coach_notes'
  | 'created_at'
  | 'updated_at'
  | 'completed_at'
  | 'path_node_id'
>;

type MatchResultInsert = Optionalize<
  MatchResultRow,
  | 'id'
  | 'tournament_name'
  | 'location'
  | 'surface'
  | 'category'
  | 'opponent_name'
  | 'opponent_ranking'
  | 'round'
  | 'score'
  | 'notes'
  | 'coach_notes'
  | 'indoor'
  | 'created_at'
  | 'profiles'
>;

type GoalTemplateInsert = Optionalize<
  GoalTemplate,
  | 'id'
  | 'description'
  | 'created_by'
  | 'created_at'
  | 'updated_at'
  | 'sort_order'
>;

type PathInsert = Optionalize<
  Path,
  'id' | 'description' | 'created_by' | 'is_active' | 'created_at' | 'updated_at'
>;

type PathNodeInsert = Optionalize<
  PathNode,
  'id' | 'goal_template_id' | 'description' | 'sort_order' | 'created_at'
>;

type PathEdgeInsert = Optionalize<PathEdge, 'id' | 'created_at'>;

type StudentPathInsert = Optionalize<
  StudentPath,
  'id' | 'activated_at' | 'activated_by'
>;

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: ProfileInsert;
        Update: Partial<Profile>;
        Relationships: [];
      };
      invite_links: {
        Row: InviteLink;
        Insert: InviteLinkInsert;
        Update: Partial<InviteLink>;
        Relationships: [];
      };
      goals: {
        Row: Goal;
        Insert: GoalInsert;
        Update: Partial<Goal>;
        Relationships: [];
      };
      match_results: {
        Row: MatchResultRow;
        Insert: MatchResultInsert;
        Update: Partial<MatchResultRow>;
        Relationships: [];
      };
      goal_templates: {
        Row: GoalTemplate;
        Insert: GoalTemplateInsert;
        Update: Partial<GoalTemplate>;
        Relationships: [];
      };
      paths: {
        Row: Path;
        Insert: PathInsert;
        Update: Partial<Path>;
        Relationships: [];
      };
      path_nodes: {
        Row: PathNode;
        Insert: PathNodeInsert;
        Update: Partial<PathNode>;
        Relationships: [];
      };
      path_edges: {
        Row: PathEdge;
        Insert: PathEdgeInsert;
        Update: Partial<PathEdge>;
        Relationships: [];
      };
      student_paths: {
        Row: StudentPath;
        Insert: StudentPathInsert;
        Update: Partial<StudentPath>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      activate_path: {
        Args: { p_path_id: string; p_student_id: string };
        Returns: string;
      };
      save_path_graph: {
        Args: {
          p_path_id: string;
          p_nodes: Record<string, unknown>[];
          p_edges: Record<string, unknown>[];
        };
        Returns: undefined;
      };
      deactivate_path: {
        Args: { p_path_id: string; p_student_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      user_role: UserRole;
      goal_category: GoalCategory;
      goal_status: GoalStatus;
      surface_type: SurfaceType;
      match_result: MatchResult;
      approval_status: ApprovalStatus;
      player_level: PlayerLevel;
    };
  };
}
