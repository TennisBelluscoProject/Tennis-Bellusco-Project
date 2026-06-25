/**
 * Student-path repository — Supabase implementation.
 * Provides `IStudentPathRepository`. Vedi repositories/types.ts.
 *
 * L'attivazione (creazione istanza + materializzazione dei goal) e' delegata
 * alla RPC transazionale `activate_path`, cosi' l'operazione e' atomica e la
 * logica resta una sola, lato DB.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Path, StudentPath } from '../database.types';
import type {
  ActiveStudentPath,
  IStudentPathRepository,
  RepoResult,
} from './types';
import { ok, fail } from './errors';

type Client = SupabaseClient<Database>;

// shape della riga student_paths con il percorso annidato (join)
type RowWithPath = StudentPath & { paths: Path | null };

export class SupabaseStudentPathRepository implements IStudentPathRepository {
  constructor(private readonly client: Client) {}

  async listActiveByStudent(
    studentId: string
  ): Promise<RepoResult<ActiveStudentPath[]>> {
    const { data, error } = await this.client
      .from('student_paths')
      .select('*, paths(*)')
      .eq('student_id', studentId)
      .order('activated_at', { ascending: false });
    if (error) return fail(error);

    const rows = (data ?? []) as unknown as RowWithPath[];
    const result: ActiveStudentPath[] = rows
      .filter((r) => r.paths !== null)
      .map((r) => {
        const { paths, ...studentPath } = r;
        return { studentPath: studentPath as StudentPath, path: paths as Path };
      });
    return ok(result);
  }

  async activate(
    pathId: string,
    studentId: string
  ): Promise<RepoResult<string>> {
    const { data, error } = await this.client.rpc('activate_path', {
      p_path_id: pathId,
      p_student_id: studentId,
    });
    if (error) return fail(error);
    return ok(data as string);
  }

  async listActivationsByPath(pathId: string): Promise<RepoResult<string[]>> {
    const { data, error } = await this.client
      .from('student_paths')
      .select('student_id')
      .eq('path_id', pathId);
    if (error) return fail(error);
    return ok((data ?? []).map((r) => (r as { student_id: string }).student_id));
  }

  async deactivate(
    pathId: string,
    studentId: string
  ): Promise<RepoResult<void>> {
    const { error } = await this.client.rpc('deactivate_path', {
      p_path_id: pathId,
      p_student_id: studentId,
    });
    if (error) return fail(error);
    return ok(undefined);
  }
}
