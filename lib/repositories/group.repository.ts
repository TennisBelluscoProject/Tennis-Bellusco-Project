/**
 * Group repository — Supabase implementation.
 * Provides `IGroupRepository`. See repositories/types.ts for the contract.
 *
 * Un gruppo di lezione e' una riga di `profiles` con `is_group = true`
 * (scripts/sql/2026_gruppi.sql, ADR-5-1). Qui dentro sta TUTTA la conoscenza
 * di quella scelta: i flag da impostare alla creazione, il filtro da usare
 * nelle liste, il join per risolvere i nomi dei partecipanti.
 *
 * Il resto dell'applicazione non deve sapere che un gruppo e' un profilo:
 * gli passa un `Profile` e lo tratta come un soggetto allenabile qualsiasi.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Profile } from '../database.types';
import type { GroupMemberView, IGroupRepository, RepoResult } from './types';
import { ok, fail } from './errors';

type Client = SupabaseClient<Database>;

/** Forma della riga letta con il join sui profili degli allievi collegati. */
type MemberRow = {
  id: string;
  student_id: string | null;
  display_name: string | null;
  profiles: { full_name: string } | null;
};

export class SupabaseGroupRepository implements IGroupRepository {
  constructor(private readonly client: Client) {}

  async list(): Promise<RepoResult<Profile[]>> {
    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('is_group', true)
      .eq('active', true)
      .order('full_name');
    if (error) return fail(error);
    return ok((data ?? []) as Profile[]);
  }

  async create({
    coachId,
    name,
  }: {
    coachId: string | null;
    name: string;
  }): Promise<RepoResult<Profile>> {
    // I flag NON sono negoziabili e non li decide il chiamante:
    //  - role 'allievo' + is_fictitious → eredita le policy RLS dei profili
    //    gestiti dal maestro (insert/update/delete gia' in vigore);
    //  - approval_status 'approved' → un gruppo non passa da un'approvazione,
    //    non essendoci nessuno che si registra;
    //  - is_group → e' cio' che lo tiene fuori dalle liste allievi.
    const { data, error } = await this.client
      .from('profiles')
      .insert({
        role: 'allievo',
        full_name: name.trim(),
        is_group: true,
        is_fictitious: true,
        approval_status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: coachId,
        active: true,
      })
      .select('*')
      .single();
    if (error) return fail(error);
    return ok(data as Profile);
  }

  async rename(groupId: string, name: string): Promise<RepoResult<Profile>> {
    const { data, error } = await this.client
      .from('profiles')
      .update({ full_name: name.trim() })
      .eq('id', groupId)
      .eq('is_group', true)
      .select('*')
      .single();
    if (error) return fail(error);
    return ok(data as Profile);
  }

  async delete(groupId: string): Promise<RepoResult<void>> {
    // Il doppio filtro e' una cintura di sicurezza: anche se l'id arrivasse
    // sbagliato, questa delete non puo' toccare una persona.
    const { error } = await this.client
      .from('profiles')
      .delete()
      .eq('id', groupId)
      .eq('is_group', true);
    if (error) return fail(error);
    return ok(undefined);
  }

  async listMembers(groupId: string): Promise<RepoResult<GroupMemberView[]>> {
    // `profiles!group_members_student_id_fkey` disambigua: la tabella ha DUE
    // FK verso profiles (group_id e student_id), quindi il join va nominato.
    const { data, error } = await this.client
      .from('group_members')
      .select('id, student_id, display_name, profiles!group_members_student_id_fkey(full_name)')
      .eq('group_id', groupId);
    if (error) return fail(error);

    const rows = (data ?? []) as unknown as MemberRow[];
    const members: GroupMemberView[] = rows.map((r) => ({
      id: r.id,
      studentId: r.student_id,
      // Per gli allievi collegati il nome viene SEMPRE dal profilo: se il
      // maestro lo corregge, il gruppo si allinea da solo.
      name: r.profiles?.full_name ?? r.display_name ?? 'Senza nome',
    }));
    members.sort((a, b) => a.name.localeCompare(b.name, 'it'));
    return ok(members);
  }

  async countMembers(
    groupIds: string[]
  ): Promise<RepoResult<Record<string, number>>> {
    if (groupIds.length === 0) return ok({});
    const { data, error } = await this.client
      .from('group_members')
      .select('group_id')
      .in('group_id', groupIds);
    if (error) return fail(error);

    const counts: Record<string, number> = {};
    for (const id of groupIds) counts[id] = 0;
    for (const row of (data ?? []) as { group_id: string }[]) {
      counts[row.group_id] = (counts[row.group_id] ?? 0) + 1;
    }
    return ok(counts);
  }

  async addStudent(groupId: string, studentId: string): Promise<RepoResult<void>> {
    // L'unicita' e' garantita da un indice PARZIALE (solo dove student_id non
    // e' null), che PostgREST non sa usare per un upsert: la duplicazione la
    // intercettiamo qui prima di scrivere. Se due click partissero insieme,
    // l'indice fa comunque da rete di sicurezza lato database.
    const { data: existing, error: readErr } = await this.client
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('student_id', studentId)
      .limit(1);
    if (readErr) return fail(readErr);
    if ((existing ?? []).length > 0) return ok(undefined);

    const { error } = await this.client
      .from('group_members')
      .insert({ group_id: groupId, student_id: studentId });
    if (error) return fail(error);
    return ok(undefined);
  }

  async addName(groupId: string, displayName: string): Promise<RepoResult<void>> {
    const clean = displayName.trim();
    if (!clean) return fail({ message: 'Il nome del partecipante e\u0027 vuoto' });

    const { error } = await this.client
      .from('group_members')
      .insert({ group_id: groupId, display_name: clean });
    if (error) return fail(error);
    return ok(undefined);
  }

  async removeMember(memberId: string): Promise<RepoResult<void>> {
    const { error } = await this.client
      .from('group_members')
      .delete()
      .eq('id', memberId);
    if (error) return fail(error);
    return ok(undefined);
  }
}
