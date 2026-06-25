-- ============================================================================
--  PERCORSI DI OBIETTIVI (Skill Tree) — Iterazione A
--  DAG di obiettivi-tipo + istanza per allievo. Algoritmo esibito: Kahn O(V+E).
--
--  NOTA: gia' applicato sul progetto Supabase via MCP come migrazione
--  `paths_skill_tree_iteration_a` (+ `paths_harden_trigger_search_path`).
--  Questo file e' la copia versionata nel repo. Eseguibile in modo idempotente.
-- ============================================================================

-- ── 1. PERCORSI (template, lato maestro) ─────────────────────────────────────
create table if not exists public.paths (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  difficulty  text not null check (difficulty in ('DELFINO','CERBIATTO','COCCODRILLO')),
  created_by  uuid references public.profiles(id) on delete set null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── 2. NODI del DAG (competenze del percorso) ────────────────────────────────
create table if not exists public.path_nodes (
  id               uuid primary key default gen_random_uuid(),
  path_id          uuid not null references public.paths(id) on delete cascade,
  goal_template_id uuid references public.goal_templates(id) on delete set null,
  title            text not null,
  category         text not null check (category in ('tecnica','tattica','fisico','mente','agonismo')),
  description      text,
  sort_order       int  not null default 0,
  created_at       timestamptz not null default now()
);
create index if not exists path_nodes_path_idx on public.path_nodes (path_id);

-- ── 3. ARCHI del DAG (prerequisiti) ──────────────────────────────────────────
--  Semantica: from_node_id = PREREQUISITO, to_node_id = nodo DIPENDENTE.
create table if not exists public.path_edges (
  id           uuid primary key default gen_random_uuid(),
  path_id      uuid not null references public.paths(id) on delete cascade,
  from_node_id uuid not null references public.path_nodes(id) on delete cascade,
  to_node_id   uuid not null references public.path_nodes(id) on delete cascade,
  created_at   timestamptz not null default now(),
  constraint path_edges_no_self check (from_node_id <> to_node_id),
  constraint path_edges_unique  unique (from_node_id, to_node_id)
);
create index if not exists path_edges_path_idx on public.path_edges (path_id);
create index if not exists path_edges_from_idx on public.path_edges (from_node_id);
create index if not exists path_edges_to_idx   on public.path_edges (to_node_id);

-- ── 4. ISTANZA: percorso attivato per un allievo ─────────────────────────────
create table if not exists public.student_paths (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.profiles(id) on delete cascade,
  path_id      uuid not null references public.paths(id)    on delete cascade,
  activated_at timestamptz not null default now(),
  activated_by uuid references public.profiles(id) on delete set null,
  constraint student_paths_unique unique (student_id, path_id)
);
create index if not exists student_paths_student_idx on public.student_paths (student_id);

-- ── 5. COLLEGAMENTO goals → nodo di percorso ─────────────────────────────────
--  NULL     = obiettivo "libero" del Kanban (comportamento attuale invariato).
--  NOT NULL = obiettivo materializzato da un nodo di percorso.
--  ON DELETE SET NULL: cancellare un nodo NON distrugge il lavoro dell'allievo,
--  l'obiettivo torna semplicemente a essere un obiettivo libero del Kanban.
alter table public.goals
  add column if not exists path_node_id uuid references public.path_nodes(id) on delete set null;
create index if not exists goals_path_node_idx on public.goals (path_node_id);

-- ── 6. Trigger updated_at per paths (riuso del pattern esistente) ────────────
create or replace function public.tg_paths_set_updated_at()
returns trigger language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists trg_paths_updated_at on public.paths;
create trigger trg_paths_updated_at
  before update on public.paths
  for each row execute function public.tg_paths_set_updated_at();

-- ── 7. RLS (legge l'autenticato, scrive il maestro) ──────────────────────────
alter table public.paths         enable row level security;
alter table public.path_nodes    enable row level security;
alter table public.path_edges    enable row level security;
alter table public.student_paths enable row level security;

do $$
declare t text;
begin
  foreach t in array array['paths','path_nodes','path_edges'] loop
    execute format('drop policy if exists "select_%1$s_all" on public.%1$s;', t);
    execute format('create policy "select_%1$s_all" on public.%1$s for select to authenticated using (true);', t);
    execute format('drop policy if exists "write_%1$s_coach" on public.%1$s;', t);
    execute format('create policy "write_%1$s_coach" on public.%1$s for all to authenticated using (public.is_coach(auth.uid())) with check (public.is_coach(auth.uid()));', t);
  end loop;
end $$;

drop policy if exists "select_student_paths" on public.student_paths;
create policy "select_student_paths" on public.student_paths
  for select to authenticated
  using (student_id = auth.uid() or public.is_coach(auth.uid()));

drop policy if exists "write_student_paths_coach" on public.student_paths;
create policy "write_student_paths_coach" on public.student_paths
  for all to authenticated
  using (public.is_coach(auth.uid())) with check (public.is_coach(auth.uid()));
