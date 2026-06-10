/**
 * Goal repository — Supabase implementation.
 *
 * This module PROVIDES `IGoalRepository`. It owns:
 *   - the table name ('goals')
 *   - the side effects of status transitions
 *   - all error-to-RepoError conversion
 *
 * Consumers (`PlayerView`, `useAsyncResource`, etc.) import only the
 * interface from './types' and the default instance from './index' — they
 * never touch Supabase here.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Goal, GoalStatus } from '../database.types';
import type { IGoalRepository, RepoResult } from './types';
import { ok, fail } from './errors';

type Client = SupabaseClient<Database>;

export class SupabaseGoalRepository implements IGoalRepository {
  constructor(private readonly client: Client) {}

  async listByStudent(studentId: string): Promise<RepoResult<Goal[]>> {
    const { data, error } = await this.client
      .from('goals')
      .select('*')
      .eq('student_id', studentId)
      .order('sort_order');
    if (error) return fail(error);
    return ok((data ?? []) as Goal[]);
  }

  async listAllForStats() {
    const { data, error } = await this.client.from('goals').select('id, created_at');
    if (error) return fail(error);
    return ok((data ?? []) as Pick<Goal, 'id' | 'created_at'>[]);
  }

  async create({
    studentId,
    createdBy,
    data,
  }: {
    studentId: string;
    createdBy: string;
    data: Partial<Goal>;
  }): Promise<RepoResult<Goal>> {
    // We accept Partial<Goal> from the form and add the FK + creator id.
    // student_id and created_by are NOT NULL in the schema.
    const row = { ...data, student_id: studentId, created_by: createdBy };
    const { data: inserted, error } = await this.client
      .from('goals')
      // Cast: the form may not include all NOT NULL fields (title is the
      // one required by the schema and is validated upstream by the form).
      .insert(row as unknown as Database['public']['Tables']['goals']['Insert'])
      .select('*')
      .single();
    if (error) return fail(error);
    return ok(inserted as Goal);
  }

  async update(id: string, patch: Partial<Goal>): Promise<RepoResult<Goal>> {
    const { data, error } = await this.client
      .from('goals')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) return fail(error);
    return ok(data as Goal);
  }

  async changeStatus(id: string, status: GoalStatus): Promise<RepoResult<Goal>> {
    // Status transitions carry implicit side effects. They are encoded here
    // (in the repo) instead of being repeated in every page that moves a
    // goal across the kanban — single source of truth.
    const patch: Partial<Goal> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (status === 'completed') {
      patch.progress = 100;
      patch.completed_at = new Date().toISOString();
    }
    if (status === 'planned') {
      patch.progress = 0;
      patch.completed_at = null;
    }
    const { data, error } = await this.client
      .from('goals')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) return fail(error);
    return ok(data as Goal);
  }

  async setProgress(id: string, progress: number): Promise<RepoResult<void>> {
    const { error } = await this.client
      .from('goals')
      .update({ progress, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return fail(error);
    return ok(undefined);
  }

  async delete(id: string): Promise<RepoResult<void>> {
    const { error } = await this.client.from('goals').delete().eq('id', id);
    if (error) return fail(error);
    return ok(undefined);
  }
}
