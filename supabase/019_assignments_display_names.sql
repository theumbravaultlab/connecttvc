-- ============================================================
-- Connect TVC -- self-service display names, group/party "assigned to"
-- ownership, and a created/updated audit trail on groups + parties.
--
-- 1. profiles currently only lets a user read their OWN row, and has no
--    update policy at all. Adds:
--      - "leaders read all profiles" (select) -- so an Assigned To
--        picker/column can resolve any user's id to a name, same flat-
--        access pattern as every other table's "leaders manage X".
--      - "update own profile" (update) -- so the self-service display-
--        name edit can persist.
--    Note: RLS has no column-level restriction, so this update policy
--    technically also lets a user change their own `role`. Accepted,
--    low-risk tradeoff -- nothing in this app is gated on 'admin' vs
--    'leader' today (is_leader() treats them identically), and access is
--    already flat by design (see PROJECT_STATUS.md "Product direction").
--
-- 2. groups/parties gain:
--    - assigned_to (uuid FK to profiles, ON DELETE SET NULL) -- "who
--      currently owns this," resolved to a name at read time. Purely
--      organizational -- never gates access, same flat-permissions model
--      as everything else in this app.
--    - created_by / updated_by (snapshot text, same convention as
--      contact_log.contacted_by / placement_history.assigned_by) --
--      written by the app: created_by once on insert, updated_by on
--      every save. Existing rows will have both null until next saved;
--      created_by on pre-migration rows can never be reconstructed and
--      will just stay blank -- expected, not a bug.
--    created_at already exists on both tables -- no schema change, it
--    just wasn't surfaced in the app until now.
--
-- Run in the Supabase SQL editor after 018_five_city_expansion.sql.
-- Purely additive -- no drops, no data loss, safe to re-run.
-- ============================================================

-- ---------- 1. profiles: read-all + update-own -------------------
drop policy if exists "leaders read all profiles" on public.profiles;
create policy "leaders read all profiles" on public.profiles
  for select using (public.is_leader());

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ---------- 2. groups: assigned_to + created_by/updated_by --------
alter table public.groups add column if not exists assigned_to uuid references public.profiles (id) on delete set null;
alter table public.groups add column if not exists created_by text;
alter table public.groups add column if not exists updated_by text;

create index if not exists groups_assigned_to_idx on public.groups (assigned_to);

-- ---------- 3. parties: assigned_to + created_by/updated_by -------
alter table public.parties add column if not exists assigned_to uuid references public.profiles (id) on delete set null;
alter table public.parties add column if not exists created_by text;
alter table public.parties add column if not exists updated_by text;

create index if not exists parties_assigned_to_idx on public.parties (assigned_to);
