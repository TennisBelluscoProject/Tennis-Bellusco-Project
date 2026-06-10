/**
 * Path repository — Supabase implementation.
 * Provides `IPathRepository`. Vedi repositories/types.ts per il contratto.
 *
 * Incapsula nomi tabella (paths/path_nodes/path_edges), query e RPC. L'algoritmo
 * di validazione (Kahn) NON vive qui: resta in lib/paths/topo.ts e viene
 * chiamato dal consumer prima di `saveGraph`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Path } from '../database.types';
import type {
  IPathRepository,
  PathGraph,
  PathNodeDraft,
  RepoResult,
} from './types';
import { ok, fail } from './errors';

type Client = SupabaseClient<Database>;

export class SupabasePathRepository implements IPathRepository {
  constructor(private readonly client: Client) {}

  async list(): Promise<RepoResult<Path[]>> {
    const { data, error } = await this.client
      .from('paths')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return fail(error);
    return ok((data ?? []) as Path[]);
  }

  async getById(id: string): Promise<RepoResult<Path | null>> {
    const { data, error } = await this.client
      .from('paths')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return ok(null);
      return fail(error);
    }
    return ok(data as Path);
  }

  async create({
    createdBy,
    data,
  }: {
    createdBy: string;
    data: Partial<Path>;
  }): Promise<RepoResult<Path>> {
    const row = {
      ...data,
      created_by: createdBy,
    } as Database['public']['Tables']['paths']['Insert'];
    const { data: inserted, error } = await this.client
      .from('paths')
      .insert(row)
      .select('*')
      .single();
    if (error) return fail(error);
    return ok(inserted as Path);
  }

  async update(id: string, patch: Partial<Path>): Promise<RepoResult<Path>> {
    const { data, error } = await this.client
      .from('paths')
      .update(patch as Database['public']['Tables']['paths']['Update'])
      .eq('id', id)
      .select('*')
      .single();
    if (error) return fail(error);
    return ok(data as Path);
  }

  async delete(id: string): Promise<RepoResult<void>> {
    const { error } = await this.client.from('paths').delete().eq('id', id);
    if (error) return fail(error);
    return ok(undefined);
  }

  async getGraph(pathId: string): Promise<RepoResult<PathGraph>> {
    const [nodesRes, edgesRes] = await Promise.all([
      this.client.from('path_nodes').select('*').eq('path_id', pathId).order('sort_order'),
      this.client.from('path_edges').select('*').eq('path_id', pathId),
    ]);
    if (nodesRes.error) return fail(nodesRes.error);
    if (edgesRes.error) return fail(edgesRes.error);
    return ok({
      nodes: (nodesRes.data ?? []) as PathGraph['nodes'],
      edges: (edgesRes.data ?? []) as PathGraph['edges'],
    });
  }

  async saveGraph(
    pathId: string,
    nodes: PathNodeDraft[],
    edges: { from: string; to: string }[]
  ): Promise<RepoResult<void>> {
    // RPC transazionale: sostituisce nodi e archi del percorso in un colpo solo.
    const { error } = await this.client.rpc('save_path_graph', {
      p_path_id: pathId,
      p_nodes: nodes as unknown as Record<string, unknown>[],
      p_edges: edges as unknown as Record<string, unknown>[],
    });
    if (error) return fail(error);
    return ok(undefined);
  }
}
