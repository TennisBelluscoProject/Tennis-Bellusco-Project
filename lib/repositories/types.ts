/**
 * ╭──────────────────────────────────────────────────────────────────────╮
 * │  REPOSITORY INTERFACES — provided contracts for data access          │
 * ╰──────────────────────────────────────────────────────────────────────╯
 *
 * These are the "Explicit Interfaces" of the data layer.
 *
 * In the architecture spec (Bass, Clements, Kazman) this file plays the
 * role of the "ball-and-socket" notation in a UML component diagram:
 *
 *     ┌──────────────┐                            ┌──────────────┐
 *     │ React Page   │──(o─── IGoalRepository ──○─│ Supabase     │
 *     │ (PlayerView) │                            │ Repositories │
 *     └──────────────┘  required        provided  └──────────────┘
 *
 *  - Pages and React components REQUIRE an `IGoalRepository` to do their
 *    job; they do NOT know that the implementation is Supabase.
 *  - The Supabase implementations (see `goal.repository.ts` etc.) PROVIDE
 *    these interfaces. Swapping Supabase for a mock, a REST adapter, or a
 *    different backend means changing one file in `./` — none in `app/` or
 *    `components/`.
 *
 * Why this matters (mapping to the lecture):
 *   - "Few interfaces": each repo has 4-7 methods, not 30.
 *   - "Small interfaces (loose coupling)": only domain types in/out, no
 *     Supabase types leak across the boundary.
 *   - "Explicit interfaces": this very file. Every consumer can read it
 *     and know exactly what's expected without opening the implementation.
 *   - "Information hiding": SQL, joins, RPC names stay inside the impl.
 *   - "Cohesion": one repo per aggregate (Goal, Match, Profile, Template).
 */

import type {
  Profile,
  Goal,
  GoalStatus,
  MatchResultRow,
  GoalTemplate,
  ApprovalStatus,
} from '../database.types';

// ─── Shared types ──────────────────────────────────────────────────────────

/**
 * Result envelope for every repository call.
 * Wrapping success/error explicitly avoids `throw` at the consumer site and
 * forces error handling at the type level.
 */
export type RepoResult<T> =
  | { data: T; error: null }
  | { data: null; error: RepoError };

export interface RepoError {
  message: string;
  /** Code from the underlying driver (Postgres / PostgREST), if any. */
  code?: string;
}

// ─── Goal ──────────────────────────────────────────────────────────────────

export interface IGoalRepository {
  /** All goals of a single student, ordered by `sort_order`. */
  listByStudent(studentId: string): Promise<RepoResult<Goal[]>>;

  /** Lightweight count + created_at snapshot used for club-wide stats. */
  listAllForStats(): Promise<
    RepoResult<Pick<Goal, 'id' | 'created_at'>[]>
  >;

  create(input: {
    studentId: string;
    createdBy: string;
    data: Partial<Goal>;
  }): Promise<RepoResult<Goal>>;

  update(id: string, patch: Partial<Goal>): Promise<RepoResult<Goal>>;

  /**
   * Transition a goal to a new status. Encapsulates the side effects:
   *   completed → progress = 100, completed_at = now()
   *   planned   → progress = 0,   completed_at = null
   */
  changeStatus(id: string, status: GoalStatus): Promise<RepoResult<Goal>>;

  /** Used by the kanban progress slider — fire-and-forget patch. */
  setProgress(id: string, progress: number): Promise<RepoResult<void>>;

  delete(id: string): Promise<RepoResult<void>>;
}

// ─── Match (agonistic results) ─────────────────────────────────────────────

export interface IMatchRepository {
  listByStudent(studentId: string): Promise<RepoResult<MatchResultRow[]>>;

  /**
   * All matches across all students, with `profiles` joined. Used by the
   * coach's "Risultati Agonistici" tab. Limited to a configurable number
   * of recent rows (default 100) to avoid unbounded reads.
   */
  listAllWithStudent(limit?: number): Promise<RepoResult<MatchResultRow[]>>;

  /** Bare snapshot of every match for win-rate / volume aggregations. */
  listAllForStats(): Promise<
    RepoResult<Pick<MatchResultRow, 'id' | 'result' | 'match_date'>[]>
  >;

  create(input: {
    studentId: string;
    data: Partial<MatchResultRow>;
  }): Promise<RepoResult<MatchResultRow>>;

  update(id: string, patch: Partial<MatchResultRow>): Promise<RepoResult<MatchResultRow>>;

  setCoachNotes(id: string, notes: string | null): Promise<RepoResult<void>>;

  delete(id: string): Promise<RepoResult<void>>;
}

// ─── Profile (students + coach) ────────────────────────────────────────────

export interface IProfileRepository {
  /** Approved + active allievi, ordered by full name. */
  listApprovedStudents(): Promise<RepoResult<Profile[]>>;

  /** Pending registration requests, newest first. */
  listPendingStudents(): Promise<RepoResult<Profile[]>>;

  getById(id: string): Promise<RepoResult<Profile | null>>;

  /**
   * Change approval status; sets `approved_at = now()` and `approved_by`
   * to the coach id so the audit trail is preserved.
   */
  setApprovalStatus(
    studentId: string,
    status: ApprovalStatus,
    coachId: string | null
  ): Promise<RepoResult<void>>;
}

// ─── Goal Template (catalog) ───────────────────────────────────────────────

export interface IGoalTemplateRepository {
  list(): Promise<RepoResult<GoalTemplate[]>>;

  create(input: {
    createdBy: string;
    data: Partial<GoalTemplate>;
  }): Promise<RepoResult<GoalTemplate>>;

  update(id: string, patch: Partial<GoalTemplate>): Promise<RepoResult<GoalTemplate>>;

  delete(id: string): Promise<RepoResult<void>>;
}
