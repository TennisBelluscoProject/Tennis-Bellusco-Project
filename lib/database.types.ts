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
  /**
   * true = questa riga NON e' una persona ma un GRUPPO di lezione (es.
   * "U12 Lun/Mer 17:00"). I gruppi hanno sempre anche `is_fictitious = true`
   * e `role = 'allievo'`, cosi' ereditano le policy RLS dei profili gestiti
   * dal maestro e possono avere obiettivi e percorsi come un allievo.
   *
   * ATTENZIONE: ogni query che elenca gli allievi deve filtrare
   * `is_group = false`, altrimenti i gruppi compaiono tra le persone.
   * Vedi scripts/sql/2026_gruppi.sql (ADR-5-1).
   */
  is_group: boolean;
  /**
   * Percorso Kids (i 12 passi del Diario) attivo per questo allievo.
   * NULL = nessun percorso attivo: e' il default, il percorso NON parte da
   * solo. Lo decide il maestro, e non si deduce da `level` — quello resta la
   * sua classificazione (Principiante / Intermedio / Avanzato), che e' un
   * vocabolario diverso dai tre percorsi.
   */
  kids_path_level: PlayerLevel | null;
  kids_path_set_at: string | null;
  kids_path_set_by: string | null;
  created_at: string;
}

/**
 * Un partecipante di un gruppo di lezione.
 *
 * Due forme, mutuamente non esclusive ma con almeno una valorizzata:
 *  - `student_id` != null  → allievo gia' a sistema; il nome si legge dal suo
 *                            profilo, cosi' resta allineato se cambia.
 *  - `display_name` != null → nome libero, per chi non ha (ancora) un profilo.
 */
export type GroupMember = {
  id: string;
  group_id: string;
  student_id: string | null;
  display_name: string | null;
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
  // Chiave dell'obiettivo dei 12 passi Kids che ha materializzato questa card
  // (lib/kids/curriculum.ts). Non e' una FK: il contenuto dei percorsi Kids
  // sta nel codice, non in tabella. NULL = obiettivo non Kids.
  kids_objective_key: string | null;
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

// ─── Percorsi Kids (i 12 passi del Diario del Tennis) ──────────────────────
//
// Il contenuto dei tre percorsi sta in lib/kids/curriculum.ts (dati statici).
// Sul database viaggia solo lo stato dell'allievo.

/** Una riga = un obiettivo dei 12 passi SPUNTATO da quell'allievo. */
export type KidsPathProgress = {
  id: string;
  student_id: string;
  level: PlayerLevel;
  /** Chiave stabile generata da lib/kids/curriculum.ts. */
  objective_key: string;
  completed_at: string;
  /** Chi ha messo la spunta (maestro o allievo stesso). */
  checked_by: string | null;
}

/** Percorso da 12 passi concluso, con l'eventuale promozione di livello. */
export type KidsLevelCompletion = {
  id: string;
  student_id: string;
  level: PlayerLevel;
  completed_at: string;
  promoted_to: PlayerLevel | null;
}

/** Quanti obiettivi servono per concludere un livello (validazione server). */
export type KidsLevelTotal = {
  level: PlayerLevel;
  total_objectives: number;
  updated_at: string;
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
  | 'is_group'
  | 'kids_path_level'
  | 'kids_path_set_at'
  | 'kids_path_set_by'
  | 'created_at'
>;

type GroupMemberInsert = Optionalize<
  GroupMember,
  'id' | 'student_id' | 'display_name' | 'created_at'
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
  | 'kids_objective_key'
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

type KidsPathProgressInsert = Optionalize<
  KidsPathProgress,
  'id' | 'completed_at' | 'checked_by'
>;

type KidsLevelCompletionInsert = Optionalize<
  KidsLevelCompletion,
  'id' | 'completed_at' | 'promoted_to'
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
      group_members: {
        Row: GroupMember;
        Insert: GroupMemberInsert;
        Update: Partial<GroupMember>;
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
      kids_path_progress: {
        Row: KidsPathProgress;
        Insert: KidsPathProgressInsert;
        Update: Partial<KidsPathProgress>;
        Relationships: [];
      };
      kids_level_completions: {
        Row: KidsLevelCompletion;
        Insert: KidsLevelCompletionInsert;
        Update: Partial<KidsLevelCompletion>;
        Relationships: [];
      };
      kids_level_totals: {
        Row: KidsLevelTotal;
        Insert: KidsLevelTotal;
        Update: Partial<KidsLevelTotal>;
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
      /**
       * Percorsi Kids: valida lato server che tutti gli obiettivi del
       * livello siano spuntati, registra il completamento e promuove
       * l'allievo al livello successivo. Ritorna il nuovo livello.
       */
      kids_complete_level: {
        Args: { p_student_id: string; p_level: PlayerLevel };
        Returns: PlayerLevel;
      };
      /**
       * Percorsi Kids: azzera un allievo. Cancella spunte, storico dei
       * livelli conclusi e card dei 12 passi, e spegne kids_path_level.
       * Serve alla disattivazione: riattivare riparte da zero. Solo maestro.
       */
      kids_reset_student: {
        Args: { p_student_id: string };
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
