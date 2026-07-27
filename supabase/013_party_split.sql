-- ============================================================
-- Connect TVC -- Party/Person split. Every person now belongs to exactly
-- one Party record, and the Party (not the Person) holds everything used
-- for matching/search/placement: location, availability, life stage, age,
-- childcare need, status, assigned group, and notes. Person becomes a
-- lightweight identity record (name/email/phone) that just links to its
-- Party -- this is what lets a coordinator search "The Griers" or
-- "Will Grier" and land on the same party either way, with every member
-- (including Will) visible on it.
--
-- Reuses each existing people.id as the new parties.id for that row, so
-- contact_log's existing person_id values keep working through a plain
-- column rename instead of needing any data remapping.
--
-- IMPORTANT: any existing row with a non-empty partner_name (from
-- 010_person_party_size.sql's plain-text "who they're searching with"
-- field) gets a real second people row created for it before that column
-- is dropped -- otherwise the partner's name would just be lost, not
-- migrated. Double-check the Supabase table editor after running this.
--
-- Run this in the Supabase SQL editor after 012_person_party_name.sql.
-- ============================================================

-- ---------- 1. create the parties table ----------------------
create table if not exists public.parties (
  id text primary key default gen_random_uuid()::text,
  party_name text default '',
  area text not null default '',
  address text default '',            -- PRIVATE: home address (for routing/map)
  age integer,                        -- matched against groups.age_range in the Finder
  days text[] not null default '{}',
  time_pref text not null default 'Flexible',
  life text not null default 'Everyone',
  interests text default '',
  childcare_needed boolean not null default false,
  accessibility text default '—',
  status text not null default 'New', -- New | Actively Searching | Waitlisted | Grouped
  group_id text references public.groups (id) on delete set null,
  joined text default '',
  notes text default '',
  lat double precision,               -- PRIVATE: geocoded point
  lng double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- 2. backfill: one party per existing person --------
insert into public.parties
  (id, party_name, area, address, age, days, time_pref, life, interests,
   childcare_needed, accessibility, status, group_id, joined, notes,
   lat, lng, created_at, updated_at)
select
  id, party_name, area, address, age, days, time_pref, life, interests,
  childcare_needed, accessibility, status, group_id, joined, notes,
  lat, lng, created_at, updated_at
from public.people
on conflict (id) do nothing;

-- ---------- 3. link people -> parties --------------------------
alter table public.people add column if not exists party_id
  text references public.parties (id) on delete cascade;

update public.people set party_id = id where party_id is null;

-- ---------- 4. preserve any plain-text partner as a real person -
-- Must run before partner_name is dropped below.
insert into public.people (id, party_id, name, email, phone, created_at, updated_at)
select gen_random_uuid()::text, party_id, partner_name, '', '', now(), now()
from public.people
where coalesce(trim(partner_name), '') <> '';

alter table public.people alter column party_id set not null;

-- ---------- 5. drop the columns that moved to parties -----------
alter table public.people
  drop column if exists area,
  drop column if exists address,
  drop column if exists age,
  drop column if exists days,
  drop column if exists time_pref,
  drop column if exists life,
  drop column if exists interests,
  drop column if exists childcare_needed,
  drop column if exists accessibility,
  drop column if exists status,
  drop column if exists group_id,
  drop column if exists joined,
  drop column if exists notes,
  drop column if exists party_size,
  drop column if exists partner_name,
  drop column if exists party_name,
  drop column if exists lat,
  drop column if exists lng;

-- ---------- 6. CHECK constraints + indexes + RLS on parties ------
alter table public.parties drop constraint if exists parties_status_check;
alter table public.parties add constraint parties_status_check
  check (status in ('New', 'Actively Searching', 'Waitlisted', 'Grouped'));

alter table public.parties drop constraint if exists parties_life_check;
alter table public.parties add constraint parties_life_check
  check (life in ('Families', 'Young Adults', 'Everyone', 'Couples', 'Students'));

alter table public.parties drop constraint if exists parties_time_pref_check;
alter table public.parties add constraint parties_time_pref_check
  check (time_pref in ('Mornings', 'Afternoons', 'Evenings', 'Flexible'));

alter table public.parties drop constraint if exists parties_days_check;
alter table public.parties add constraint parties_days_check
  check (days <@ array['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']::text[]);

create index if not exists parties_group_id_idx on public.parties (group_id);
create index if not exists people_party_id_idx on public.people (party_id);

alter table public.parties enable row level security;

drop policy if exists "leaders manage parties" on public.parties;
create policy "leaders manage parties" on public.parties
  for all using (public.is_leader()) with check (public.is_leader());

drop trigger if exists parties_touch on public.parties;
create trigger parties_touch before update on public.parties
  for each row execute function public.touch_updated_at();

-- ---------- 7. contact log now attaches to the party -------------
alter table public.contact_log rename column person_id to party_id;

alter table public.contact_log drop constraint if exists contact_log_person_id_fkey;
alter table public.contact_log add constraint contact_log_party_id_fkey
  foreign key (party_id) references public.parties (id) on delete cascade;

drop index if exists contact_log_person_id_idx;
create index if not exists contact_log_party_id_idx on public.contact_log (party_id);
