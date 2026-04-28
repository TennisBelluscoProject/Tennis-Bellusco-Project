-- Catalogo Obiettivi (Goal Templates)
-- Eseguire una sola volta sul progetto Supabase.

create table if not exists public.goal_templates (
  id          uuid primary key default gen_random_uuid(),
  category    text not null check (category in ('tecnica','tattica','fisico','mente','agonismo')),
  level       text not null check (level in ('Principiante','Intermedio','Avanzato')),
  title       text not null,
  description text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  sort_order  int not null default 0
);

create index if not exists goal_templates_level_idx    on public.goal_templates (level);
create index if not exists goal_templates_category_idx on public.goal_templates (category);

-- Trigger to keep updated_at fresh
create or replace function public.tg_goal_templates_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_goal_templates_updated_at on public.goal_templates;
create trigger trg_goal_templates_updated_at
  before update on public.goal_templates
  for each row execute function public.tg_goal_templates_set_updated_at();

-- RLS: tutti i profili autenticati leggono, solo i maestri scrivono
alter table public.goal_templates enable row level security;

drop policy if exists "Tutti possono leggere i template" on public.goal_templates;
create policy "Tutti possono leggere i template"
  on public.goal_templates for select
  using (true);

drop policy if exists "Solo il maestro può inserire template" on public.goal_templates;
create policy "Solo il maestro può inserire template"
  on public.goal_templates for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'maestro')
  );

drop policy if exists "Solo il maestro può aggiornare template" on public.goal_templates;
create policy "Solo il maestro può aggiornare template"
  on public.goal_templates for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'maestro')
  );

drop policy if exists "Solo il maestro può eliminare template" on public.goal_templates;
create policy "Solo il maestro può eliminare template"
  on public.goal_templates for delete
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'maestro')
  );
