-- ═══════════════════════════════════════════════════════════════════════════
--  PERCORSI KIDS → SEZIONE OBIETTIVI
--  Da eseguire una sola volta nella dashboard Supabase → SQL Editor.
--  Idempotente: si puo' rieseguire senza danni.
--  Richiede che 2026_kids_paths.sql sia gia' stato eseguito.
-- ═══════════════════════════════════════════════════════════════════════════
--
--  COSA FA
--  Collega ogni obiettivo dei 12 passi a una card della sezione Obiettivi,
--  esattamente come i Percorsi "liberi" collegano i loro nodi tramite
--  `goals.path_node_id`. Qui il legame non puo' essere una FK, perche' gli
--  obiettivi dei 12 passi NON sono righe di tabella: vivono nel codice
--  (lib/kids/curriculum.ts) e sono identificati da una chiave stabile. Quindi
--  il legame e' la chiave stessa, in `goals.kids_objective_key`.
--
--    goals.path_node_id        NOT NULL → obiettivo di un Percorso libero
--    goals.kids_objective_key  NOT NULL → obiettivo di un percorso Kids
--    entrambi NULL                      → obiettivo "libero" del Kanban
--
--  DUE RAPPRESENTAZIONI, UNA VERITA'
--  La spunta di un obiettivo Kids vive in `kids_path_progress` (la presenza
--  della riga = completato); lo stato della card vive in `goals.status`. Sono
--  due facce della stessa cosa e devono restare allineate SEMPRE, anche se
--  l'utente agisce dal Kanban invece che dalla mappa. Per questo la
--  sincronizzazione sta qui, in due trigger, e non nel client: qualunque
--  scrittura, da qualunque schermata, tiene le due tabelle d'accordo.
--
--    mappa  → Kanban : spunto l'obiettivo   → la card va in "Conclusi"
--    Kanban → mappa  : sposto in "Conclusi" → l'obiettivo risulta spuntato
--
--  I due trigger NON si richiamano a vicenda all'infinito: ognuno scrive solo
--  quando il valore cambia davvero, quindi il secondo passaggio non trova
--  nulla da fare e la catena si ferma. Vedi le note sotto.
--
--  QUALI OBIETTIVI COMPAIONO
--  Solo quelli dei passi SBLOCCATI: e' il client (lib/kids/goals.ts) a
--  materializzare le card quando una pagina del libretto si apre, come fa
--  PlayerView per i nodi sbloccati dei Percorsi liberi. Gli obiettivi dei
--  passi ancora chiusi non esistono come card.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. Il legame ───────────────────────────────────────────────────────────

alter table public.goals
  add column if not exists kids_objective_key text;

comment on column public.goals.kids_objective_key is
  'Percorsi Kids: chiave stabile dell''obiettivo dei 12 passi (lib/kids/curriculum.ts) che ha materializzato questa card. NULL = obiettivo non Kids.';

-- Un obiettivo Kids = UNA sola card per allievo.
--
-- L'indice NON e' parziale di proposito: PostgREST non permette di aggiungere
-- un predicato alla clausola ON CONFLICT, quindi un indice parziale non
-- verrebbe mai riconosciuto come target dell'upsert e la materializzazione
-- fallirebbe con "no unique or exclusion constraint matching". Non serve che
-- lo sia: in Postgres due NULL sono distinti fra loro, percio' le migliaia di
-- righe con `kids_objective_key` NULL (gli obiettivi liberi) non si scontrano
-- mai fra loro.
create unique index if not exists goals_kids_objective_unique
  on public.goals (student_id, kids_objective_key);

-- Usato dai trigger per trovare la card partendo dalla spunta.
create index if not exists goals_kids_objective_key_idx
  on public.goals (kids_objective_key)
  where kids_objective_key is not null;


-- ─── 2. Il livello si ricava dalla chiave ───────────────────────────────────
--
-- Le chiavi hanno forma '<slug>.<tappa>.<area>.<slug-titolo>-<hash>', quindi
-- il primo segmento e' il percorso: 'delfino.s1_2.tecnici.…' → DELFINO.
-- Riusa kids_normalize_level() di 2026_kids_paths.sql.

create or replace function public.kids_level_from_key(p_key text)
returns text
language sql
immutable
set search_path = public
as $$
  select public.kids_normalize_level(split_part(coalesce(p_key, ''), '.', 1));
$$;

grant execute on function public.kids_level_from_key(text) to authenticated;


-- ─── 3. Kanban → mappa ──────────────────────────────────────────────────────
--
-- Solo su UPDATE della colonna `status`, mai su INSERT: la materializzazione
-- delle card crea le righe con lo stato GIA' allineato alla spunta, e un
-- trigger sull'insert rischierebbe di cancellare una spunta buona nel caso in
-- cui una card venga adottata (vedi lib/kids/goals.ts).
--
-- SECURITY DEFINER: la funzione scrive su kids_path_progress, che ha RLS.
-- Chi arriva qui ha gia' superato la policy di UPDATE su `goals` per quella
-- riga, e scriviamo esclusivamente sull'allievo di quella riga.

create or replace function public.kids_goal_status_to_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kids_objective_key is null then
    return null;
  end if;

  if new.status is not distinct from old.status then
    return null;
  end if;

  if new.status = 'completed' then
    insert into public.kids_path_progress (student_id, level, objective_key, checked_by)
    values (
      new.student_id,
      public.kids_level_from_key(new.kids_objective_key),
      new.kids_objective_key,
      auth.uid()
    )
    on conflict (student_id, level, objective_key) do nothing;
    -- Se la spunta c'era gia', ON CONFLICT DO NOTHING non inserisce nulla e
    -- il trigger del punto 4 non scatta: la catena si chiude qui.
  else
    delete from public.kids_path_progress
     where student_id    = new.student_id
       and objective_key = new.kids_objective_key;
  end if;

  return null;
end;
$$;

drop trigger if exists kids_goal_status_sync on public.goals;
create trigger kids_goal_status_sync
  after update of status on public.goals
  for each row
  execute function public.kids_goal_status_to_progress();


-- ─── 4. Mappa → Kanban ──────────────────────────────────────────────────────
--
-- La clausola finale di ogni UPDATE (`status <> 'completed'` / `= 'completed'`)
-- non e' un'ottimizzazione: e' cio' che spezza la ricorsione. Se la card e'
-- gia' nello stato giusto l'UPDATE tocca zero righe, il trigger del punto 3
-- non scatta e ci si ferma.

create or replace function public.kids_progress_to_goal_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.goals
       set status       = 'completed',
           progress     = 100,
           completed_at = coalesce(completed_at, now()),
           updated_at   = now()
     where student_id         = new.student_id
       and kids_objective_key = new.objective_key
       and status            <> 'completed';
    return null;
  end if;

  -- DELETE: la spunta e' stata tolta, la card torna "in programma".
  update public.goals
     set status       = 'planned',
         progress     = 0,
         completed_at = null,
         updated_at   = now()
   where student_id         = old.student_id
     and kids_objective_key = old.objective_key
     and status             = 'completed';
  return null;
end;
$$;

drop trigger if exists kids_progress_goal_sync on public.kids_path_progress;
create trigger kids_progress_goal_sync
  after insert or delete on public.kids_path_progress
  for each row
  execute function public.kids_progress_to_goal_status();


-- ─── 4-bis. Le funzioni-trigger non sono API ────────────────────────────────
--
-- In Postgres ogni funzione nasce eseguibile da PUBLIC, e tutto cio' che sta
-- nello schema `public` finisce esposto da PostgREST su /rest/v1/rpc/. Queste
-- due sono SECURITY DEFINER, quindi vanno chiuse. I trigger continuano a
-- scattare: il permesso di EXECUTE viene verificato quando il trigger viene
-- CREATO, non a ogni scatto.

revoke all on function public.kids_goal_status_to_progress() from public, anon, authenticated;
revoke all on function public.kids_progress_to_goal_status() from public, anon, authenticated;


-- ─── 5. Riallineamento delle spunte gia' esistenti ──────────────────────────
--
-- Chi ha gia' spuntato obiettivi prima di questa migrazione non ha ancora le
-- card: verranno create dal client al primo caricamento, con lo stato giusto.
-- Qui sistemiamo solo il caso opposto (card presenti e spunta mancante), che
-- non dovrebbe capitare ma costa poco verificare.

insert into public.kids_path_progress (student_id, level, objective_key)
select g.student_id,
       public.kids_level_from_key(g.kids_objective_key),
       g.kids_objective_key
  from public.goals g
 where g.kids_objective_key is not null
   and g.status = 'completed'
on conflict (student_id, level, objective_key) do nothing;


-- ─── 6. Verifica rapida ─────────────────────────────────────────────────────
-- select count(*) from public.goals where kids_objective_key is not null;
-- select status, count(*) from public.goals
--   where kids_objective_key is not null group by status;
