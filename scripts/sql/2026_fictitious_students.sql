-- Allievi "fittizi": profili creati direttamente dal maestro per allievi minori
-- che non hanno email/password. Non esistono in auth.users.

-- 1) Aggiunge una colonna che marca i profili fittizi
alter table public.profiles
  add column if not exists is_fictitious boolean not null default false;

-- 2) Rimuove il vincolo FK profiles.id -> auth.users.id, perché i profili
--    fittizi vivono solo in public.profiles. Per i profili reali, l'allineamento
--    con auth.users è comunque garantito dal trigger handle_new_user che usa
--    NEW.id come id del profilo.
alter table public.profiles
  drop constraint if exists profiles_id_fkey;

-- 3) Default per id: i profili reali vengono inseriti dal trigger con NEW.id;
--    per i profili fittizi generiamo un nuovo UUID lato DB.
alter table public.profiles
  alter column id set default gen_random_uuid();

-- 4) Politica RLS: il maestro può inserire profili fittizi (allievi approvati,
--    senza email, marcati is_fictitious=true).
drop policy if exists coach_insert_fictitious_profile on public.profiles;
create policy coach_insert_fictitious_profile on public.profiles
  for insert to authenticated
  with check (
    public.is_coach(auth.uid())
    and is_fictitious = true
    and role = 'allievo'
  );

-- 5) Politica RLS: il maestro può eliminare i profili fittizi (utile per la
--    pulizia futura). I profili reali restano protetti.
drop policy if exists coach_delete_fictitious_profile on public.profiles;
create policy coach_delete_fictitious_profile on public.profiles
  for delete to authenticated
  using (
    public.is_coach(auth.uid()) and is_fictitious = true
  );
