-- ═══════════════════════════════════════════════════════════════════════════
--  DISATTIVARE IL PERCORSO KIDS = AZZERARE L'ALLIEVO
--  Gia' applicata al progetto Supabase come migrazione
--  `kids_reset_student_on_deactivate`. Idempotente.
--  Richiede 2026_kids_paths.sql, 2026_kids_goals.sql, 2026_kids_path_activation.sql.
-- ═══════════════════════════════════════════════════════════════════════════
--
--  Prima la disattivazione era una messa in pausa: toglieva le card ancora
--  aperte ma lasciava spunte, livelli conclusi e card gia' completate. Il
--  risultato era un allievo senza percorso attivo che si portava comunque
--  dietro tutto lo storico, e riattivandolo si ritrovava a meta' strada.
--
--  Ora azzera davvero. Riattivare riparte da zero.
--
--  PERCHE' UNA FUNZIONE E NON TRE DELETE DAL CLIENT
--  Perche' e' distruttiva: o si cancella tutto o non si cancella niente. Un
--  azzeramento a meta' (per un errore di rete sulla seconda delete)
--  lascerebbe l'allievo con le spunte ma senza card, o viceversa — proprio il
--  tipo di incoerenza che i trigger di 2026_kids_goals.sql servono a evitare.
--  Dentro una funzione le quattro istruzioni sono una transazione sola.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.kids_reset_student(p_student_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- Solo il maestro: l'allievo non puo' cancellarsi il proprio percorso.
  if not public.is_maestro() then
    raise exception 'Non autorizzato';
  end if;

  -- Prima le card, poi le spunte: cosi' il trigger kids_progress_goal_sync
  -- non trova piu' nulla da riallineare e non fa lavoro inutile.
  delete from public.goals
   where student_id = p_student_id
     and kids_objective_key is not null;

  delete from public.kids_path_progress where student_id = p_student_id;
  delete from public.kids_level_completions where student_id = p_student_id;

  update public.profiles
     set kids_path_level  = null,
         kids_path_set_at = now(),
         kids_path_set_by = auth.uid()
   where id = p_student_id;
end;
$function$;

revoke all on function public.kids_reset_student(uuid) from public, anon;
grant execute on function public.kids_reset_student(uuid) to authenticated;


-- ─── Pulizia degli allievi disattivati con la logica vecchia ────────────────
--
-- Chi e' stato disattivato PRIMA di questa migrazione e' rimasto con spunte,
-- livelli conclusi e card concluse pur non avendo piu' un percorso attivo.
-- Questo blocco li riporta allo stato coerente. NON e' stato eseguito in
-- automatico: cancella dati veri, quindi va lanciato consapevolmente.
--
-- Per vedere prima chi verrebbe toccato:
--
--   select p.full_name,
--          (select count(*) from public.goals g
--            where g.student_id = p.id and g.kids_objective_key is not null) as card_kids,
--          (select count(*) from public.kids_path_progress k
--            where k.student_id = p.id) as spunte
--     from public.profiles p
--    where p.role = 'allievo' and p.kids_path_level is null;
--
-- E poi, per pulire:
--
--   delete from public.goals g
--    using public.profiles p
--    where g.student_id = p.id
--      and p.kids_path_level is null
--      and g.kids_objective_key is not null;
--
--   delete from public.kids_path_progress k
--    using public.profiles p
--    where k.student_id = p.id and p.kids_path_level is null;
--
--   delete from public.kids_level_completions c
--    using public.profiles p
--    where c.student_id = p.id and p.kids_path_level is null;
