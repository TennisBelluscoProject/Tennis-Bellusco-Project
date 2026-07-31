-- ═══════════════════════════════════════════════════════════════════════════
--  GRUPPI DI LEZIONE
--  Da eseguire una sola volta nella dashboard Supabase → SQL Editor.
--  Idempotente: si puo' rieseguire senza danni.
-- ═══════════════════════════════════════════════════════════════════════════
--
--  DECISIONE ARCHITETTURALE (ADR-5-1)
--  ----------------------------------
--  Un Gruppo NON e' una nuova entita' con tabelle proprie: e' una riga di
--  `public.profiles` con `is_group = true`.
--
--  Motivo: tutto cio' che un gruppo deve fare (obiettivi in kanban, percorsi
--  a tappe, 12 passi Kids) e' gia' modellato su `profiles.id`:
--
--      goals.student_id            → profiles.id
--      student_paths.student_id    → profiles.id
--      kids_path_progress.student_id → profiles.id
--
--  Trattare il gruppo come un "soggetto allenabile" ci regala l'intero
--  stack — repository, Kanban, PathTreeView, RPC activate_path /
--  deactivate_path / kids_* — senza duplicare una riga di codice. La
--  alternativa (tabelle `group_goals`, `group_paths`, ...) avrebbe voluto
--  dire clonare 4 tabelle, 4 repository e 6 componenti React per ottenere
--  esattamente lo stesso comportamento.
--
--  Un gruppo e' quindi un caso particolare del profilo "gestito dal maestro"
--  gia' esistente (`is_fictitious = true`): niente account, niente login,
--  creato e cancellato dal maestro. Ereditando `is_fictitious` eredita anche
--  le policy RLS di insert/update/delete gia' in vigore per gli allievi
--  fittizi: questa migrazione NON tocca le policy di `profiles`.
--
--  PREZZO DA PAGARE: ogni query che elenca gli allievi deve ora escludere i
--  gruppi con `is_group = false`. I punti toccati nel codice sono:
--      lib/repositories/profile.repository.ts  (listApprovedStudents,
--                                               listPendingStudents)
--      app/coach/CoachMobileDashboard.tsx      (le due query dirette)
--  Tutto il resto passa da li'.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 0. Helper: l'utente corrente e' un maestro? ────────────────────────────
--
-- Gia' creato da 2026_kids_paths.sql. Ripetuto qui per rendere la migrazione
-- autonoma (create or replace = nessun effetto se e' identica).

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


-- ─── 1. Il flag che distingue un gruppo da una persona ──────────────────────

alter table public.profiles
  add column if not exists is_group boolean not null default false;

comment on column public.profiles.is_group is
  'true = questa riga rappresenta un GRUPPO di lezione, non una persona. I gruppi hanno sempre anche is_fictitious = true e role = ''allievo'': cosi'' ereditano le policy RLS dei profili gestiti dal maestro e possono avere obiettivi e percorsi come un allievo qualsiasi.';

-- Indice parziale: le liste allievi filtrano `is_group = false` a ogni
-- caricamento, ed e' il filtro piu' selettivo (i gruppi sono poche decine
-- contro ~300 allievi).
create index if not exists profiles_is_group_idx
  on public.profiles (is_group)
  where is_group = true;


-- ─── 1-bis. Invariante: un gruppo e' sempre un profilo gestito ──────────────
--
-- Impedisce che un account reale (con login) venga trasformato in gruppo per
-- errore: un gruppo senza `is_fictitious` sfuggirebbe alle policy di
-- cancellazione e resterebbe orfano.

alter table public.profiles
  drop constraint if exists profiles_group_is_managed;

alter table public.profiles
  add constraint profiles_group_is_managed
  check (is_group = false or is_fictitious = true)
  not valid;

-- `not valid` = non ricontrolla le righe gia' presenti (nessuna ha is_group
-- true, il default e' false), ma vale da subito su insert e update.


-- ─── 2. Partecipanti del gruppo ─────────────────────────────────────────────
--
-- Un partecipante puo' essere:
--   a) un allievo GIA' a sistema  → student_id valorizzato (il nome si legge
--      sempre dal suo profilo, cosi' resta allineato se cambia)
--   b) un nome LIBERO             → display_name valorizzato (per chi non ha
--      ancora un profilo; il maestro non deve creare un account solo per
--      mettere un bambino in un gruppo)
--
-- Il vincolo garantisce che almeno uno dei due ci sia.

create table if not exists public.group_members (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.profiles(id) on delete cascade,
  student_id   uuid references public.profiles(id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now(),
  constraint group_members_has_identity check (
    student_id is not null
    or nullif(btrim(coalesce(display_name, '')), '') is not null
  )
);

-- Un allievo non puo' comparire due volte nello stesso gruppo. Indice
-- PARZIALE: sui nomi liberi (student_id null) il vincolo non si applica —
-- due "Marco" nello stesso gruppo sono legittimi.
create unique index if not exists group_members_group_student_uidx
  on public.group_members (group_id, student_id)
  where student_id is not null;

create index if not exists group_members_group_idx
  on public.group_members (group_id);

create index if not exists group_members_student_idx
  on public.group_members (student_id)
  where student_id is not null;

comment on table public.group_members is
  'Composizione dei gruppi di lezione. Ogni riga e'' un partecipante: o un allievo a sistema (student_id) o un nome libero (display_name).';


-- ─── 2-bis. Guardia referenziale ────────────────────────────────────────────
--
-- Le FK puntano entrambe a `profiles`, ma i due ruoli non sono
-- intercambiabili: `group_id` deve essere un gruppo, `student_id` una
-- persona. Non e' esprimibile con una CHECK (servono altre righe), quindi
-- serve un trigger.

create or replace function public.group_members_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_group boolean;
begin
  select is_group into v_is_group from public.profiles where id = new.group_id;
  if v_is_group is null then
    raise exception 'Gruppo inesistente';
  end if;
  if not v_is_group then
    raise exception 'group_id deve puntare a un profilo con is_group = true';
  end if;

  if new.student_id is not null then
    select is_group into v_is_group from public.profiles where id = new.student_id;
    if v_is_group is null then
      raise exception 'Allievo inesistente';
    end if;
    if v_is_group then
      raise exception 'Un gruppo non puo'' essere membro di un altro gruppo';
    end if;
  end if;

  -- Normalizza: stringa vuota → null, cosi' la CHECK non viene aggirata con
  -- un display_name fatto di soli spazi.
  new.display_name := nullif(btrim(coalesce(new.display_name, '')), '');

  return new;
end;
$$;

drop trigger if exists group_members_guard_trg on public.group_members;
create trigger group_members_guard_trg
  before insert or update on public.group_members
  for each row execute function public.group_members_guard();

-- La guardia serve solo al trigger: senza questa revoca comparirebbe fra le
-- RPC raggiungibili da PostgREST (segnalata dal linter di Supabase).
revoke execute on function public.group_members_guard() from anon, authenticated, public;


-- ─── 3. Row Level Security ──────────────────────────────────────────────────
--
-- Scrittura: solo il maestro. I gruppi sono uno strumento didattico suo.
-- Lettura: il maestro vede tutto; un allievo vede le righe che lo riguardano
-- (serve a dirgli "sei nel gruppo X", senza aprirgli gli obiettivi del
-- gruppo — quelli restano protetti dalle policy di `goals`).

alter table public.group_members enable row level security;

drop policy if exists group_members_select on public.group_members;
create policy group_members_select on public.group_members
  for select to authenticated
  using (student_id = auth.uid() or public.is_maestro());

drop policy if exists group_members_insert on public.group_members;
create policy group_members_insert on public.group_members
  for insert to authenticated
  with check (public.is_maestro());

drop policy if exists group_members_update on public.group_members;
create policy group_members_update on public.group_members
  for update to authenticated
  using (public.is_maestro())
  with check (public.is_maestro());

drop policy if exists group_members_delete on public.group_members;
create policy group_members_delete on public.group_members
  for delete to authenticated
  using (public.is_maestro());


-- ─── 4. Verifica rapida ─────────────────────────────────────────────────────
--
-- STATO: gia' applicata al progetto zcvmfqmrljhckilqhipq il 31/07/2026, come
-- migrazioni `gruppi_di_lezione` e `gruppi_revoke_guard_execute`. Il file
-- resta qui come documentazione e per ricostruire l'ambiente da zero.
--
-- select id, full_name, is_group, is_fictitious from public.profiles where is_group;
-- select g.full_name as gruppo, coalesce(p.full_name, m.display_name) as membro
--   from public.group_members m
--   join public.profiles g on g.id = m.group_id
--   left join public.profiles p on p.id = m.student_id
--   order by gruppo, membro;
