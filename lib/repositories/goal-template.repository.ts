/**
 * Goal-template repository — Supabase implementation.
 * Provides `IGoalTemplateRepository`. See repositories/types.ts.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, GoalTemplate } from '../database.types';
import type { IGoalTemplateRepository, RepoResult } from './types';
import { ok, fail } from './errors';

type Client = SupabaseClient<Database>;

export class SupabaseGoalTemplateRepository implements IGoalTemplateRepository {
  constructor(private readonly client: Client) {}

  async list(): Promise<RepoResult<GoalTemplate[]>> {
    const { data, error } = await this.client
      .from('goal_templates')
      .select('*')
      .order('level')
      .order('category')
      .order('sort_order')
      .order('title');
    if (error) return fail(error);
    return ok((data ?? []) as GoalTemplate[]);
  }

  async create({
    createdBy,
    data,
  }: {
    createdBy: string;
    data: Partial<GoalTemplate>;
  }): Promise<RepoResult<GoalTemplate>> {
    const row = { ...data, created_by: createdBy };
    const { data: inserted, error } = await this.client
      .from('goal_templates')
      .insert(
        [row] as Database['public']['Tables']['goal_templates']['Insert'][]
      )
      .select('*')
      .single();
    if (error) return fail(error);
    return ok(inserted as GoalTemplate);
  }

  async update(
    id: string,
    patch: Partial<GoalTemplate>
  ): Promise<RepoResult<GoalTemplate>> {
    const { data, error } = await this.client
      .from('goal_templates')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) return fail(error);
    return ok(data as GoalTemplate);
  }

  async delete(id: string): Promise<RepoResult<void>> {
    const { error } = await this.client
      .from('goal_templates')
      .delete()
      .eq('id', id);
    if (error) return fail(error);
    return ok(undefined);
  }
}
