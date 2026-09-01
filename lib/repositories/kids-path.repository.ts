/**
 * Kids-path repository — Supabase implementation.
 * Provides `IKidsPathRepository`. Vedi repositories/types.ts per il contratto.
 *
 * Percorsi Kids = i 12 passi del Diario del Tennis. Il CONTENUTO e' statico e
 * vive in lib/kids/curriculum.ts: qui si gestiscono solo le SPUNTE
 * dell'allievo (tabella `kids_path_progress`, una riga per obiettivo
 * completato) e la chiusura del percorso (RPC `kids_complete_level`).
 *
 * Nota sul modello: "completato" e' rappresentato dalla PRESENZA della riga,
 * non da un booleano. De-spuntare significa cancellare la riga. Questo rende
 * l'operazione idempotente e tiene la tabella piccola.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Database,
  KidsLevelCompletion,
  PlayerLevel,
} from '../database.types';
import {
  KIDS_PROGRAMS,
  type KidsProgram,
} from '../kids/curriculum';
import { computeKidsState } from '../kids/progress';
import {
  isEmptyPlan,
  kidsGoalDrafts,
  planKidsGoals,
  type KidsGoalLink,
  type KidsGoalPlan,
} from '../kids/goals';
import type {
  IKidsPathRepository,
  KidsProgressCount,
  RepoResult,
} from './types';
import { ok, fail } from './errors';

type Client = SupabaseClient<Database>;

export class SupabaseKidsPathRepository implements IKidsPathRepository {
  constructor(private readonly client: Client) {}

  async listProgress(
    studentId: string,
    level: PlayerLevel
  ): Promise<RepoResult<string[]>> {
    const { data, error } = await this.client
      .from('kids_path_progress')
      .select('objective_key')
      .eq('student_id', studentId)
      .eq('level', level);
    if (error) return fail(error);
    return ok((data ?? []).map((r) => (r as { objective_key: string }).objective_key));
  }

  /**
   * Le card "In corso" di QUESTO percorso.
   *
   * Il filtro sul percorso e' un `like` sul prefisso della chiave, non una
   * colonna: le chiavi hanno forma '<slug>.<tappa>.<area>.<titolo>-<hash>',
   * quindi 'delfino.%' seleziona esattamente gli obiettivi del Delfino. E'
   * lo stesso ragionamento che fa `kids_level_from_key()` lato database.
   */
  async listInProgress(
    studentId: string,
    level: PlayerLevel
  ): Promise<RepoResult<string[]>> {
    const { data, error } = await this.client
      .from('goals')
      .select('kids_objective_key')
      .eq('student_id', studentId)
      .eq('status', 'in_progress')
      .like('kids_objective_key', `${KIDS_PROGRAMS[level].slug}.%`);
    if (error) return fail(error);
    return ok(
      (data ?? [])
        .map((r) => (r as { kids_objective_key: string | null }).kids_objective_key)
        .filter((k): k is string => k !== null)
    );
  }

  async setObjective({
    studentId,
    level,
    objectiveKey,
    done,
    actorId,
  }: {
    studentId: string;
    level: PlayerLevel;
    objectiveKey: string;
    done: boolean;
    actorId: string;
  }): Promise<RepoResult<void>> {
    return this.setObjectives({
      studentId,
      level,
      objectiveKeys: [objectiveKey],
      done,
      actorId,
    });
  }

  async setObjectives({
    studentId,
    level,
    objectiveKeys,
    done,
    actorId,
  }: {
    studentId: string;
    level: PlayerLevel;
    objectiveKeys: string[];
    done: boolean;
    actorId: string;
  }): Promise<RepoResult<void>> {
    if (objectiveKeys.length === 0) return ok(undefined);

    if (done) {
      // `upsert` sul vincolo (student_id, level, objective_key): ripetere la
      // spunta non genera errore ne' duplicati.
      const rows = objectiveKeys.map((objective_key) => ({
        student_id: studentId,
        level,
        objective_key,
        checked_by: actorId,
      }));
      const { error } = await this.client
        .from('kids_path_progress')
        .upsert(rows, { onConflict: 'student_id,level,objective_key', ignoreDuplicates: true });
      if (error) return fail(error);
      return ok(undefined);
    }

    const { error } = await this.client
      .from('kids_path_progress')
      .delete()
      .eq('student_id', studentId)
      .eq('level', level)
      .in('objective_key', objectiveKeys);
    if (error) return fail(error);
    return ok(undefined);
  }

  async completeLevel(
    studentId: string,
    level: PlayerLevel
  ): Promise<RepoResult<PlayerLevel>> {
    const { data, error } = await this.client.rpc('kids_complete_level', {
      p_student_id: studentId,
      p_level: level,
    });
    if (error) return fail(error);
    return ok(data as PlayerLevel);
  }

  async listCompletions(
    studentId: string
  ): Promise<RepoResult<KidsLevelCompletion[]>> {
    const { data, error } = await this.client
      .from('kids_level_completions')
      .select('*')
      .eq('student_id', studentId)
      .order('completed_at', { ascending: true });
    if (error) return fail(error);
    return ok((data ?? []) as KidsLevelCompletion[]);
  }

  async countsByLevel(
    level: PlayerLevel
  ): Promise<RepoResult<KidsProgressCount[]>> {
    // PostgREST non fa group-by: leggiamo le chiavi (colonna sola, indicizzata)
    // e aggreghiamo in memoria. Con ~300 allievi e ~90 obiettivi il volume
    // resta nell'ordine delle decine di migliaia di righe corte.
    const { data, error } = await this.client
      .from('kids_path_progress')
      .select('student_id')
      .eq('level', level);
    if (error) return fail(error);

    const tally = new Map<string, number>();
    for (const row of (data ?? []) as { student_id: string }[]) {
      tally.set(row.student_id, (tally.get(row.student_id) ?? 0) + 1);
    }
    return ok([...tally].map(([studentId, done]) => ({ studentId, done })));
  }

  // ─── Legame con la sezione Obiettivi ────────────────────────────────
  //
  // Ogni obiettivo di un passo SBLOCCATO ha una card nel Kanban, legata dalla
  // colonna `goals.kids_objective_key`. La regola (quali card devono esistere
  // e in che stato) sta in lib/kids/goals.ts: qui si esegue solo il piano.
  //
  // Lo STATO non viene scritto da qui quando cambia una spunta: ci pensano i
  // trigger di scripts/sql/2026_kids_goals.sql, che tengono allineate le due
  // tabelle qualunque sia la schermata che scrive. Questo metodo serve alla
  // MATERIALIZZAZIONE: creare le card quando una pagina del libretto si apre,
  // togliere quelle di una pagina che si e' richiusa.

  async syncGoals({
    studentId,
    level,
    actorId,
  }: {
    studentId: string;
    level: PlayerLevel;
    actorId: string;
  }): Promise<RepoResult<KidsGoalPlan>> {
    const program: KidsProgram = KIDS_PROGRAMS[level];

    const [progressRes, linksRes] = await Promise.all([
      this.listProgress(studentId, level),
      this.listGoalLinks(studentId),
    ]);
    if (progressRes.error) return fail(progressRes.error);
    if (linksRes.error) return fail(linksRes.error);

    const doneKeys = new Set(progressRes.data);
    const state = computeKidsState(program, doneKeys);
    const drafts = kidsGoalDrafts(state, doneKeys);
    const plan = planKidsGoals(program, drafts, linksRes.data);

    if (isEmptyPlan(plan)) return ok(plan);

    // Le operazioni sono indipendenti fra loro: nessuna dipende dal risultato
    // delle altre, quindi partono insieme.
    //
    // PromiseLike e non Promise: il query builder di Supabase e' "thenable"
    // ma non una Promise vera (gli mancano catch e finally). Promise.all
    // accetta comunque i thenable, quindi basta tipare l'array cosi'.
    const operazioni: PromiseLike<{ error: { message: string } | null }>[] = [];

    if (plan.create.length > 0) {
      const righe = plan.create.map((d) => ({
        student_id: studentId,
        created_by: actorId,
        kids_objective_key: d.objectiveKey,
        title: d.title,
        description: d.description,
        category: d.category,
        sort_order: d.sortOrder,
        status: d.status,
        progress: d.status === 'completed' ? 100 : 0,
        completed_at: d.status === 'completed' ? new Date().toISOString() : null,
      })) as Database['public']['Tables']['goals']['Insert'][];
      operazioni.push(
        this.client
          .from('goals')
          .upsert(righe, {
            onConflict: 'student_id,kids_objective_key',
            ignoreDuplicates: true,
          })
          .then(({ error }) => ({ error }))
      );
    }

    // Adozione: la card col testo giusto c'e' gia' (creata a mano dal
    // catalogo). Le si attacca la chiave e le si allinea l'inquadramento,
    // senza toccarne stato, scadenza o note del maestro.
    for (const { goalId, draft } of plan.adopt) {
      const patch = {
        kids_objective_key: draft.objectiveKey,
        category: draft.category,
        sort_order: draft.sortOrder,
        updated_at: new Date().toISOString(),
      } as Database['public']['Tables']['goals']['Update'];
      operazioni.push(
        this.client
          .from('goals')
          .update(patch)
          .eq('id', goalId)
          .then(({ error }) => ({ error }))
      );
    }

    // Card adottate che erano gia' in "Conclusi": la spunta sulla mappa va
    // messa ORA, altrimenti alla prossima sincronizzazione la card verrebbe
    // riaperta (restatus) cancellando un lavoro davvero fatto.
    const daSpuntare = plan.adopt
      .filter((a) => a.tickBack)
      .map((a) => a.draft.objectiveKey);
    if (daSpuntare.length > 0) {
      operazioni.push(
        this.setObjectives({
          studentId,
          level,
          objectiveKeys: daSpuntare,
          done: true,
          actorId,
        }).then((r) => ({ error: r.error }))
      );
    }

    for (const { goalId, status } of plan.restatus) {
      const concluso = status === 'completed';
      const patch = {
        status,
        progress: concluso ? 100 : 0,
        completed_at: concluso ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      } as Database['public']['Tables']['goals']['Update'];
      operazioni.push(
        this.client
          .from('goals')
          .update(patch)
          .eq('id', goalId)
          .then(({ error }) => ({ error }))
      );
    }

    if (plan.remove.length > 0) {
      operazioni.push(
        this.client
          .from('goals')
          .delete()
          .in('id', plan.remove)
          .then(({ error }) => ({ error }))
      );
    }

    const esiti = await Promise.all(operazioni);
    const primoErrore = esiti.find((e) => e.error !== null);
    if (primoErrore?.error) return fail(primoErrore.error);

    return ok(plan);
  }

  async listGoalLinks(studentId: string): Promise<RepoResult<KidsGoalLink[]>> {
    // Serve anche il titolo delle card LIBERE, non solo di quelle Kids: e' su
    // quello che si riconosce una card creata a mano dal catalogo con lo
    // stesso testo di un obiettivo del libretto (vedi l'adozione).
    const { data, error } = await this.client
      .from('goals')
      .select('id, title, status, kids_objective_key, path_node_id')
      .eq('student_id', studentId);
    if (error) return fail(error);
    return ok((data ?? []) as KidsGoalLink[]);
  }
}
