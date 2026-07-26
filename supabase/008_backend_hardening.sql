-- ============================================================
-- Connect TVC — backend hardening: enum-like CHECK constraints,
-- a missing foreign-key index, and dropping schema that's been dead
-- since earlier in the project (the pre-geocoding mock-map columns,
-- the never-adopted public map columns, and the unused join_requests
-- table). Run this in the Supabase SQL editor after 007_person_age.sql.
-- ============================================================

-- ---------- CHECK constraints on enum-like columns ----------
-- The app's TypeScript union types (src/lib/types.ts) give zero runtime
-- protection once a row enters via a migration, a hand-run SQL statement,
-- or any future integration — this project has already hit real drift
-- here (003_person_geo_and_status.sql and 006_group_status_and_area_
-- defaults.sql both had to clean up leftover "Matched"/"Unassigned"/
-- "Active"/"Forming"/"Paused"/"Full" values from an earlier scheme).
-- `drop constraint if exists` first makes this safe to re-run.
--
-- If any of these fail: some rows still hold an old/invalid value.
-- Find them with e.g. `select distinct status from public.groups`
-- and reconcile (see 006's UPDATE statements for the pattern) before
-- re-running this file.

alter table public.groups drop constraint if exists groups_status_check;
alter table public.groups add constraint groups_status_check
  check (status in ('New', 'Open', 'Closed'));

alter table public.groups drop constraint if exists groups_life_check;
alter table public.groups add constraint groups_life_check
  check (life in ('Families', 'Young Adults', 'Everyone', 'Couples', 'Students'));

alter table public.groups drop constraint if exists groups_day_check;
alter table public.groups add constraint groups_day_check
  check (day in ('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'));

alter table public.groups drop constraint if exists groups_format_check;
alter table public.groups add constraint groups_format_check
  check (format in ('In-person', 'Hybrid', 'Online'));

alter table public.groups drop constraint if exists groups_freq_check;
alter table public.groups add constraint groups_freq_check
  check (freq in ('Weekly', 'Every other week', 'Monthly'));

alter table public.people drop constraint if exists people_status_check;
alter table public.people add constraint people_status_check
  check (status in ('New', 'Actively Searching', 'Waitlisted', 'Grouped'));

alter table public.people drop constraint if exists people_life_check;
alter table public.people add constraint people_life_check
  check (life in ('Families', 'Young Adults', 'Everyone', 'Couples', 'Students'));

alter table public.people drop constraint if exists people_time_pref_check;
alter table public.people add constraint people_time_pref_check
  check (time_pref in ('Mornings', 'Afternoons', 'Evenings', 'Flexible'));

alter table public.people drop constraint if exists people_days_check;
alter table public.people add constraint people_days_check
  check (days <@ array['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']::text[]);

-- ---------- index the people.group_id foreign key ----------
-- Standard "always index your FKs" hygiene — cheap now, before this
-- grows toward the scale 005_sample_data_dfw.sql is sized to simulate.
create index if not exists people_group_id_idx on public.people (group_id);

-- ---------- drop dead/orphaned columns on groups ----------
-- x/y: leftover design-mock map coordinates from before real geocoding
-- existed. public_lat/public_lng: only ever read by the public_groups
-- view, which 002_lock_down.sql already dropped when the app went
-- fully-gated (no more public/anonymous map). Confirmed via a full
-- codebase search that nothing reads any of these four anymore —
-- paired app-code changes (types.ts/data.ts/actions.ts) land in the
-- same commit as this migration.
alter table public.groups
  drop column if exists x,
  drop column if exists y,
  drop column if exists public_lat,
  drop column if exists public_lng;

-- ---------- drop the unused join_requests table ----------
-- Its RLS policy exists but no application code has ever queried this
-- table — the "Request to join"/"Message host" buttons that would have
-- used it were removed earlier as permanent no-op stubs. If a real
-- join-request workflow gets built later, re-add it deliberately then.
drop table if exists public.join_requests;
