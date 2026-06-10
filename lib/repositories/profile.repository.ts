/**
 * Profile repository — Supabase implementation.
 * Provides `IProfileRepository`. See repositories/types.ts for the contract.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ApprovalStatus, Database, Profile } from '../database.types';
import type { IProfileRepository, RepoResult } from './types';
import { ok, fail } from './errors';

type Client = SupabaseClient<Database>;

export class SupabaseProfileRepository implements IProfileRepository {
  constructor(private readonly client: Client) {}

  async listApprovedStudents(): Promise<RepoResult<Profile[]>> {
    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('role', 'allievo')
      .eq('approval_status', 'approved')
      .eq('active', true)
      .order('full_name');
    if (error) return fail(error);
    return ok((data ?? []) as Profile[]);
  }

  async listPendingStudents(): Promise<RepoResult<Profile[]>> {
    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('role', 'allievo')
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: false });
    if (error) return fail(error);
    return ok((data ?? []) as Profile[]);
  }

  async getById(id: string): Promise<RepoResult<Profile | null>> {
    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();
    // .single() returns an error when 0 rows — translate to null instead of
    // surfacing it, callers want a "not found" semantics here.
    if (error) {
      if (error.code === 'PGRST116') return ok(null);
      return fail(error);
    }
    return ok(data as Profile);
  }

  async setApprovalStatus(
    studentId: string,
    status: ApprovalStatus,
    coachId: string | null
  ): Promise<RepoResult<void>> {
    const { error } = await this.client
      .from('profiles')
      .update({
        approval_status: status,
        approved_at: new Date().toISOString(),
        approved_by: coachId,
      })
      .eq('id', studentId);
    if (error) return fail(error);
    return ok(undefined);
  }
}
