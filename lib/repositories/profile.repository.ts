/**
 * Profile repository — Supabase implementation.
 * Provides `IProfileRepository`. See repositories/types.ts for the contract.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ApprovalStatus, Database, PlayerLevel, Profile } from '../database.types';
import type { IProfileRepository, RepoResult } from './types';
import { ok, fail } from './errors';

type Client = SupabaseClient<Database>;

export class SupabaseProfileRepository implements IProfileRepository {
  constructor(private readonly client: Client) {}

  // NOTA: `is_group = false` non e' ridondante. Dal 2026_gruppi.sql anche i
  // gruppi di lezione sono righe di `profiles` con `role = 'allievo'`: senza
  // questo filtro comparirebbero in mezzo alle persone in ogni elenco che
  // passa da qui (dashboard maestro, catalogo Kids, attivazione percorsi).

  async listApprovedStudents(): Promise<RepoResult<Profile[]>> {
    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('role', 'allievo')
      .eq('is_group', false)
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
      .eq('is_group', false)
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

  /**
   * Attiva o cambia il percorso Kids di un allievo; `level = null` lo
   * DISATTIVA e lo AZZERA.
   *
   * La disattivazione non e' una messa in pausa: cancella spunte, storico dei
   * livelli conclusi e card dei 12 passi, cosi' una riattivazione riparte
   * davvero da zero. Va fatta in una sola transazione, altrimenti un errore a
   * meta' lascerebbe l'allievo con le spunte ma senza card (o viceversa): per
   * questo passa dalla RPC `kids_reset_student` invece che da tre delete in
   * fila da qui.
   *
   * Il CAMBIO di percorso (es. da Delfino a Cerbiatto) non azzera niente: e'
   * un'altra cosa, e lo storico dell'allievo resta.
   */
  async setKidsPath(
    studentId: string,
    level: PlayerLevel | null,
    coachId: string | null
  ): Promise<RepoResult<void>> {
    if (level === null) {
      const { error } = await this.client.rpc('kids_reset_student', {
        p_student_id: studentId,
      });
      if (error) return fail(error);
      return ok(undefined);
    }

    const { error } = await this.client
      .from('profiles')
      .update({
        kids_path_level: level,
        kids_path_set_at: new Date().toISOString(),
        kids_path_set_by: coachId,
      })
      .eq('id', studentId);
    if (error) return fail(error);
    return ok(undefined);
  }
}
