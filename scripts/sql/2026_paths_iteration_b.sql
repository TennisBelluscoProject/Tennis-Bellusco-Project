-- ============================================================================
--  PERCORSI DI OBIETTIVI (Skill Tree) — Iterazione B
--  RPC transazionali per attivazione / disattivazione / salvataggio del grafo.
--
--  NOTA: gia' applicato sul progetto Supabase via MCP (migrazioni
--  `paths_iteration_b_rpc` e successive). Questo file e' la COPIA VERSIONATA
--  nel repo, allineata allo stato REALE del database (giugno 2026).
--  Eseguibile in modo idempotente.
--
--  ⚠ DIFFERENZA rispetto a 2026_paths.sql (Iterazione A): la FK
--  goals.path_node_id e' oggi **ON DELETE CASCADE** (non SET NULL).
--  Eliminare un nodo/percorso elimina anche gli obiettivi materializzati:
--  e' il comportamento atteso da "Disattiva percorso" e dall'eliminazione
--  di un percorso dal catalogo.
-- ============================================================================

-- ── 0. FK goals → path_nodes con CASCADE (stato attuale) ─────────────────────
alter table public.goals
  drop constraint if exists goals_path_node_id_fkey;
alter table public.goals
  add constraint goals_path_node_id_fkey
  foreign key (path_node_id) references public.path_nodes(id) on delete cascade;

-- ── 1. Indice anti-duplicati: un goal per (allievo, nodo) ────────────────────
create unique index if not exists goals_student_pathnode_uidx
  on public.goals (student_id, path_node_id)
  where path_node_id is not null;

-- ── 2. RPC: attiva un percorso per un allievo ────────────────────────────────
--  Crea (idempotente) la riga student_paths e materializza ogni nodo non
--  ancora materializzato come goal `planned`. Solo maestri.
create or replace function public.activate_path(p_path_id uuid, p_student_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_student_path_id uuid;
begin
  if not public.is_coach(auth.uid()) then
    raise exception 'not authorized';
  end if;

  insert into public.student_paths (student_id, path_id, activated_by)
  values (p_student_id, p_path_id, auth.uid())
  on conflict (student_id, path_id)
    do update set activated_at = public.student_paths.activated_at
  returning id into v_student_path_id;

  insert into public.goals
    (student_id, category, title, description, status, progress, created_by, path_node_id, sort_order)
  select
    p_student_id,
    pn.category::public.goal_category,
    pn.title,
    pn.description,
    'planned'::public.goal_status,
    0,
    auth.uid(),
    pn.id,
    pn.sort_order
  from public.path_nodes pn
  where pn.path_id = p_path_id
    and not exists (
      select 1 from public.goals g
      where g.student_id = p_student_id and g.path_node_id = pn.id
    );

  return v_student_path_id;
end;
$$;

-- ── 3. RPC: disattiva un percorso per un allievo ─────────────────────────────
--  Rimuove l'istanza student_paths e CANCELLA tutti i goal materializzati da
--  quel percorso per quell'allievo. Gli obiettivi liberi (path_node_id null)
--  non vengono toccati. Solo maestri.
create or replace function public.deactivate_path(p_path_id uuid, p_student_id uuid)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  if not public.is_coach(auth.uid()) then
    raise exception 'not authorized';
  end if;

  delete from public.goals
  where student_id = p_student_id
    and path_node_id in (
      select id from public.path_nodes where path_id = p_path_id
    );

  delete from public.student_paths
  where student_id = p_student_id and path_id = p_path_id;
end;
$$;

-- ── 4. RPC: salva (sostituisce) il grafo del percorso ────────────────────────
--  Upsert dei nodi per id (i goal dei nodi mantenuti restano collegati);
--  i nodi rimossi vengono cancellati (e i relativi goal vanno via in cascata,
--  vedi FK al punto 0). Gli archi vengono sostituiti integralmente.
--  Il chiamante DEVE aver gia' validato l'aciclicita' (Kahn, lib/paths/topo.ts).
create or replace function public.save_path_graph(p_path_id uuid, p_nodes jsonb, p_edges jsonb)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  if not public.is_coach(auth.uid()) then
    raise exception 'not authorized';
  end if;

  delete from public.path_edges where path_id = p_path_id;

  -- Nodi rimossi: cancellati (i relativi goal vanno via in cascata).
  delete from public.path_nodes
  where path_id = p_path_id
    and id not in (
      select (n->>'id')::uuid
      from jsonb_array_elements(coalesce(p_nodes, '[]'::jsonb)) as n
    );

  -- Nodi nuovi o mantenuti: upsert per id (i goal dei mantenuti restano collegati).
  insert into public.path_nodes
    (id, path_id, goal_template_id, title, category, description, sort_order)
  select
    (n->>'id')::uuid,
    p_path_id,
    nullif(n->>'goal_template_id','')::uuid,
    n->>'title',
    n->>'category',
    nullif(n->>'description',''),
    coalesce((n->>'sort_order')::int, 0)
  from jsonb_array_elements(coalesce(p_nodes, '[]'::jsonb)) as n
  on conflict (id) do update set
    goal_template_id = excluded.goal_template_id,
    title            = excluded.title,
    category         = excluded.category,
    description      = excluded.description,
    sort_order       = excluded.sort_order;

  insert into public.path_edges (path_id, from_node_id, to_node_id)
  select p_path_id, (e->>'from')::uuid, (e->>'to')::uuid
  from jsonb_array_elements(coalesce(p_edges, '[]'::jsonb)) as e;
end;
$$;

-- ── 5. Grants: esecuzione solo per utenti autenticati ────────────────────────
revoke execute on function public.activate_path(uuid, uuid) from public;
revoke execute on function public.deactivate_path(uuid, uuid) from public;
revoke execute on function public.save_path_graph(uuid, jsonb, jsonb) from public;
grant execute on function public.activate_path(uuid, uuid) to authenticated;
grant execute on function public.deactivate_path(uuid, uuid) to authenticated;
grant execute on function public.save_path_graph(uuid, jsonb, jsonb) to authenticated;
