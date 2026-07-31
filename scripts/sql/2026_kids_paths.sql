-- ═══════════════════════════════════════════════════════════════════════════
--  PERCORSI KIDS — I 12 PASSI DEL DIARIO DEL TENNIS
--  Da eseguire una sola volta nella dashboard Supabase → SQL Editor.
--  Idempotente: si puo' rieseguire senza danni.
-- ═══════════════════════════════════════════════════════════════════════════
--
--  Il CONTENUTO dei tre percorsi (12 passi × 3 livelli, 208 obiettivi) vive
--  nel codice, in lib/kids/curriculum.ts: e' materiale didattico FIT uguale
--  per tutti gli allievi. Sul database finiscono solo:
--
--    kids_path_progress     una riga per ogni obiettivo SPUNTATO
--    kids_level_completions una riga per ogni percorso CONCLUSO
--    kids_level_totals      quanti obiettivi servono per concludere un livello
--
--  NOTA SUL TIPO DEL LIVELLO
--  Nel database il livello NON e' un enum: `profiles.level`,
--  `goal_templates.level` e `paths.difficulty` sono tutte colonne `text`.
--  Qui manteniamo la stessa scelta (text + CHECK) per restare coerenti con lo
--  schema esistente. Il vincolo di dominio vero e proprio sta nel tipo
--  TypeScript `PlayerLevel` (lib/database.types.ts).
--
--  Il passaggio di livello (Delfino → Cerbiatto → Coccodrillo) avviene con
--  la funzione kids_complete_level(), che verifica lato server che tutti gli
--  obiettivi siano stati spuntati prima di promuovere l'allievo.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 0. Helper: l'utente corrente e' un maestro? ────────────────────────────
--
-- SECURITY DEFINER per evitare ricorsione infinita quando la funzione viene
-- richiamata dentro le policy RLS delle tabelle qui sotto.

create or replace function public.is_maestro()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'maestro'
  );
$$;

grant execute on function public.is_maestro() to authenticated;


-- ─── 0-bis. Helper: normalizza un livello sui tre mondi ─────────────────────
--
-- Serve perche' in `profiles.level` possono esserci valori storici
-- ("Principiante", "Intermedio", "Avanzato") o addirittura una classifica FIT
-- ("4.1"). E' la stessa regola di `kidsLevelOf()` in lib/kids/curriculum.ts:
-- tutto cio' che non e' riconosciuto vale DELFINO.

create or replace function public.kids_normalize_level(p_level text)
returns text
language sql
immutable
as $$
  select case
    when upper(coalesce(p_level, '')) in ('DELFINO', 'CERBIATTO', 'COCCODRILLO')
      then upper(p_level)
    else 'DELFINO'
  end;
$$;

grant execute on function public.kids_normalize_level(text) to authenticated;


-- ─── 1. Progressi: una riga = un obiettivo spuntato ─────────────────────────

create table if not exists public.kids_path_progress (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.profiles(id) on delete cascade,
  level         text not null check (level in ('DELFINO', 'CERBIATTO', 'COCCODRILLO')),
  -- Chiave stabile generata da lib/kids/curriculum.ts
  -- es. 'delfino.s1_2.tecnici.colpisco-con-i-piedi-fermi-a-terra-4k2p'
  objective_key text not null,
  completed_at  timestamptz not null default now(),
  -- Chi ha messo la spunta (maestro o allievo stesso).
  checked_by    uuid references public.profiles(id) on delete set null,
  constraint kids_path_progress_unique unique (student_id, level, objective_key)
);

create index if not exists kids_path_progress_student_level_idx
  on public.kids_path_progress (student_id, level);

create index if not exists kids_path_progress_level_idx
  on public.kids_path_progress (level);

comment on table public.kids_path_progress is
  'Percorsi Kids: obiettivi dei 12 passi spuntati da ciascun allievo. La presenza della riga significa "completato".';


-- ─── 2. Percorsi conclusi (e promozione di livello) ─────────────────────────

create table if not exists public.kids_level_completions (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.profiles(id) on delete cascade,
  level        text not null check (level in ('DELFINO', 'CERBIATTO', 'COCCODRILLO')),
  completed_at timestamptz not null default now(),
  -- Livello a cui l'allievo e' stato promosso (null se era gia' l'ultimo).
  promoted_to  text check (promoted_to in ('DELFINO', 'CERBIATTO', 'COCCODRILLO')),
  constraint kids_level_completions_unique unique (student_id, level)
);

create index if not exists kids_level_completions_student_idx
  on public.kids_level_completions (student_id);

comment on table public.kids_level_completions is
  'Percorsi Kids: storico dei percorsi da 12 passi conclusi e delle promozioni di livello.';


-- ─── 3. Totali per livello (usati per validare la promozione) ───────────────
--
-- IMPORTANTE: questi numeri devono restare allineati a lib/kids/curriculum.ts.
-- Il test lib/kids/__tests__/progress.test.ts fallisce apposta se divergono.

create table if not exists public.kids_level_totals (
  level            text primary key check (level in ('DELFINO', 'CERBIATTO', 'COCCODRILLO')),
  total_objectives integer not null check (total_objectives > 0),
  updated_at       timestamptz not null default now()
);

insert into public.kids_level_totals (level, total_objectives) values
  ('DELFINO',     87),
  ('CERBIATTO',   61),
  ('COCCODRILLO', 60)
on conflict (level) do update
  set total_objectives = excluded.total_objectives,
      updated_at       = now();

comment on table public.kids_level_totals is
  'Percorsi Kids: numero di obiettivi necessari per concludere un livello. Deve combaciare con lib/kids/curriculum.ts.';


-- ─── 4. Row Level Security ──────────────────────────────────────────────────

alter table public.kids_path_progress     enable row level security;
alter table public.kids_level_completions enable row level security;
alter table public.kids_level_totals      enable row level security;

-- progressi: l'allievo vede e modifica i propri, il maestro tutti.
drop policy if exists kids_progress_select on public.kids_path_progress;
create policy kids_progress_select on public.kids_path_progress
  for select to authenticated
  using (student_id = auth.uid() or public.is_maestro());

drop policy if exists kids_progress_insert on public.kids_path_progress;
create policy kids_progress_insert on public.kids_path_progress
  for insert to authenticated
  with check (student_id = auth.uid() or public.is_maestro());

drop policy if exists kids_progress_delete on public.kids_path_progress;
create policy kids_progress_delete on public.kids_path_progress
  for delete to authenticated
  using (student_id = auth.uid() or public.is_maestro());

-- completamenti: sola lettura dal client (la scrittura passa dalla RPC).
drop policy if exists kids_completions_select on public.kids_level_completions;
create policy kids_completions_select on public.kids_level_completions
  for select to authenticated
  using (student_id = auth.uid() or public.is_maestro());

-- totali: leggibili da tutti gli utenti autenticati.
drop policy if exists kids_totals_select on public.kids_level_totals;
create policy kids_totals_select on public.kids_level_totals
  for select to authenticated
  using (true);


-- ─── 5. RPC: concludi il percorso e passa al livello successivo ─────────────
--
-- Verifica LATO SERVER che tutti gli obiettivi del livello siano spuntati,
-- registra il completamento e promuove il profilo al livello successivo.
-- Idempotente: richiamarla due volte non fa danni.

create or replace function public.kids_complete_level(
  p_student_id uuid,
  p_level      text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_level    text := public.kids_normalize_level(p_level);
  v_required integer;
  v_done     integer;
  v_next     text;
  v_current  text;
begin
  -- Solo l'allievo stesso o un maestro possono chiudere il percorso.
  if not (p_student_id = auth.uid() or public.is_maestro()) then
    raise exception 'Non autorizzato';
  end if;

  select total_objectives into v_required
  from public.kids_level_totals where level = v_level;

  if v_required is null then
    raise exception 'Totale obiettivi non configurato per il livello %', v_level;
  end if;

  select count(distinct objective_key) into v_done
  from public.kids_path_progress
  where student_id = p_student_id and level = v_level;

  if v_done < v_required then
    raise exception 'Percorso non completato: % obiettivi su %', v_done, v_required;
  end if;

  v_next := case v_level
    when 'DELFINO'   then 'CERBIATTO'
    when 'CERBIATTO' then 'COCCODRILLO'
    else null
  end;

  insert into public.kids_level_completions (student_id, level, promoted_to)
  values (p_student_id, v_level, v_next)
  on conflict (student_id, level) do nothing;

  -- Promuove solo se l'allievo e' ancora fermo sul livello appena concluso:
  -- non si torna mai indietro e non si sovrascrive un livello impostato a
  -- mano dal maestro. Il confronto passa dalla normalizzazione, cosi'
  -- funziona anche sui profili con valori storici ("Principiante", "4.1").
  if v_next is not null then
    select level into v_current from public.profiles where id = p_student_id;
    if public.kids_normalize_level(v_current) = v_level then
      update public.profiles set level = v_next where id = p_student_id;
      return v_next;
    end if;
  end if;

  return coalesce(v_next, v_level);
end;
$$;

grant execute on function public.kids_complete_level(uuid, text) to authenticated;


-- ─── 6. Verifica rapida ─────────────────────────────────────────────────────
-- select * from public.kids_level_totals;
-- select level, count(*) from public.kids_path_progress group by level;
-- select public.kids_normalize_level('Principiante');  -- → DELFINO
