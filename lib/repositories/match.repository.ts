/**
 * Match repository — Supabase implementation.
 * Provides `IMatchRepository`. See repositories/types.ts for the contract.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, MatchResultRow } from '../database.types';
import type { IMatchRepository, RepoResult } from './types';
import { ok, fail } from './errors';

type Client = SupabaseClient<Database>;

export class SupabaseMatchRepository implements IMatchRepository {
  constructor(private readonly client: Client) {}

  async listByStudent(studentId: string): Promise<RepoResult<MatchResultRow[]>> {
    const { data, error } = await this.client
      .from('match_results')
      .select('*')
      .eq('student_id', studentId)
      .order('match_date', { ascending: false });
    if (error) return fail(error);
    return ok((data ?? []) as MatchResultRow[]);
  }

  async listAllWithStudent(limit = 100): Promise<RepoResult<MatchResultRow[]>> {
    // Joined select: `profiles!match_results_student_id_fkey` is the FK
    // alias declared on the table, so the joined row appears under
    // `.profiles` on each match (see MatchResultRow.profiles).
    const { data, error } = await this.client
      .from('match_results')
      .select('*, profiles!match_results_student_id_fkey(full_name)')
      .order('match_date', { ascending: false })
      .limit(limit);
    if (error) return fail(error);
    return ok((data ?? []) as unknown as MatchResultRow[]);
  }

  async listAllForStats() {
    const { data, error } = await this.client
      .from('match_results')
      .select('id, result, match_date');
    if (error) return fail(error);
    return ok(
      (data ?? []) as Pick<MatchResultRow, 'id' | 'result' | 'match_date'>[]
    );
  }

  async create({
    studentId,
    data,
  }: {
    studentId: string;
    data: Partial<MatchResultRow>;
  }): Promise<RepoResult<MatchResultRow>> {
    const row = { ...data, student_id: studentId };
    const { data: inserted, error } = await this.client
      .from('match_results')
      .insert(
        row as unknown as Database['public']['Tables']['match_results']['Insert']
      )
      .select('*')
      .single();
    if (error) return fail(error);
    return ok(inserted as MatchResultRow);
  }

  async update(
    id: string,
    patch: Partial<MatchResultRow>
  ): Promise<RepoResult<MatchResultRow>> {
    const { data, error } = await this.client
      .from('match_results')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) return fail(error);
    return ok(data as MatchResultRow);
  }

  async setCoachNotes(
    id: string,
    notes: string | null
  ): Promise<RepoResult<void>> {
    const { error } = await this.client
      .from('match_results')
      .update({ coach_notes: notes })
      .eq('id', id);
    if (error) return fail(error);
    return ok(undefined);
  }

  async delete(id: string): Promise<RepoResult<void>> {
    const { error } = await this.client
      .from('match_results')
      .delete()
      .eq('id', id);
    if (error) return fail(error);
    return ok(undefined);
  }
}
