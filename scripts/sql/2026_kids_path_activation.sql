-- ═══════════════════════════════════════════════════════════════════════════
--  IL PERCORSO KIDS NON SI ATTIVA PIU' DA SOLO
--  Gia' applicata al progetto Supabase come migrazione
--  `kids_path_manual_activation`. Idempotente: si puo' rieseguire.
--  Richiede 2026_kids_paths.sql e 2026_kids_goals.sql.
-- ═══════════════════════════════════════════════════════════════════════════
--
--  IL PROBLEMA
--  Il percorso si DEDUCEVA da `profiles.level` con fallback a DELFINO
--  (kidsLevelOf), per cui ogni allievo risultava dentro a un percorso senza
--  che nessuno lo avesse deciso.
--
--  PERCHE' UNA COLONNA NUOVA E NON `profiles.level`
--  Perche' `level` e' gia' occupato: CreateStudentForm ci scrive la
--  classificazione del maestro — Principiante / Intermedio / Avanzato — che e'
--  un vocabolario DIVERSO dai tre percorsi del Diario. Riusarlo avrebbe voluto
--  dire sovrascrivere un dato suo ogni volta che assegna un percorso.
--
--    kids_path_level NULL        -> nessun percorso Kids attivo (default)
--    kids_path_level valorizzato -> percorso attivo, ed e' quello indicato
--
--  Una colonna sola dice SE il percorso e' attivo e QUALE e': i due dati non
--  possono divergere.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. La colonna ──────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists kids_path_level text,
  add column if not exists kids_path_set_at timestamptz,
  add column if not exists kids_path_set_by uuid references public.profiles(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_kids_path_level_check'
  ) then
    alter table public.profiles
      add constraint profiles_kids_path_level_check
      check (kids_path_level is null
             or kids_path_level in ('DELFINO', 'CERBIATTO', 'COCCODRILLO'));
  end if;
end $$;

comment on column public.profiles.kids_path_level is
  'Percorso Kids attivo per l''allievo. NULL = nessun percorso attivo. Lo decide il maestro: non si deduce piu'' da profiles.level.';


-- ─── 2. Backfill ────────────────────────────────────────────────────────────
--
-- Chi ha GIA' delle spunte tiene il suo percorso attivo, altrimenti la
-- modifica gli farebbe sparire dalla vista il lavoro fatto. Il percorso e'
-- quello indicato da `level` se e' uno dei tre (caso di chi era gia' stato
-- promosso), altrimenti quello su cui ha effettivamente spuntato di piu'.
-- Tutti gli altri restano a NULL: nessun percorso, come richiesto.

update public.profiles p
   set kids_path_level = coalesce(
         nullif(case when p.level in ('DELFINO','CERBIATTO','COCCODRILLO')
                     then p.level else null end, ''),
         (select k.level
            from public.kids_path_progress k
           where k.student_id = p.id
           group by k.level
           order by count(*) desc
           limit 1)
       ),
       kids_path_set_at = now()
 where p.role = 'allievo'
   and p.kids_path_level is null
   and exists (select 1 from public.kids_path_progress k where k.student_id = p.id);


-- ─── 3. La promozione scrive la colonna nuova ───────────────────────────────
--
-- Unica differenza rispetto a prima: si legge e si scrive `kids_path_level`
-- invece di `level`, e non si promuove chi non e' piu' su quel percorso (il
-- maestro potrebbe averglielo disattivato nel frattempo: non si riaccende da
-- solo).

create or replace function public.kids_complete_level(p_student_id uuid, p_level text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_level    text := public.kids_normalize_level(p_level);
  v_required integer;
  v_done     integer;
  v_next     text;
  v_current  text;
begin
  if not (p_student_id = auth.uid() or public.is_maestro()) then
    raise exception 'Non autorizzato';
  end if;

  select total_objectives into v_required from public.kids_level_totals where level = v_level;
  if v_required is null then
    raise exception 'Totale obiettivi non configurato per il livello %', v_level;
  end if;

  select count(distinct objective_key) into v_done
  from public.kids_path_progress where student_id = p_student_id and level = v_level;

  if v_done < v_required then
    raise exception 'Percorso non completato: % obiettivi su %', v_done, v_required;
  end if;

  v_next := case v_level when 'DELFINO' then 'CERBIATTO' when 'CERBIATTO' then 'COCCODRILLO' else null end;

  insert into public.kids_level_completions (student_id, level, promoted_to)
  values (p_student_id, v_level, v_next)
  on conflict (student_id, level) do nothing;

  if v_next is not null then
    select kids_path_level into v_current from public.profiles where id = p_student_id;
    if v_current = v_level then
      update public.profiles
         set kids_path_level = v_next,
             kids_path_set_at = now()
       where id = p_student_id;
      return v_next;
    end if;
  end if;

  return coalesce(v_next, v_level);
end;
$function$;


-- ─── 4. Verifica ────────────────────────────────────────────────────────────
-- select full_name, level as livello_maestro, kids_path_level as percorso_kids
--   from public.profiles where role = 'allievo' order by kids_path_level nulls last;
