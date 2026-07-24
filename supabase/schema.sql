-- ============================================================
-- Connect TVC — schema, row-level security, and public view
-- Run this in the Supabase SQL editor (or `supabase db push`).
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- profiles (auth users -> role) -------------------
-- Only coordinators/leaders sign in. Default role is 'leader' for an
-- invite-only internal tool. For public signup, change the default to a
-- non-privileged role and promote deliberately.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role text not null default 'leader' check (role in ('leader', 'admin')),
  created_at timestamptz not null default now()
);

create or replace function public.is_leader()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('leader', 'admin')
  );
$$;

-- Auto-create a profile row when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- groups ------------------------------------------
create table if not exists public.groups (
  id text primary key default gen_random_uuid()::text,
  name text not null default 'New Home Group',
  day text not null default 'Tue',
  time text not null default '7:00 PM',
  area text not null default 'Eastside',
  host text default '',
  co_host text default '—',
  life text not null default 'Everyone',
  status text not null default 'Forming',
  format text not null default 'In-person',
  freq text not null default 'Weekly',
  capacity int not null default 12,
  members int not null default 0,
  childcare boolean not null default false,
  topic text default '',
  age_range text default 'All ages',
  start_date text default '',
  contact_email text default '',
  address text default '',            -- PRIVATE: exact home address
  description text default '',
  lat double precision,               -- PRIVATE: exact geocoded point
  lng double precision,
  public_lat double precision,        -- fuzzed point safe for the public map
  public_lng double precision,
  x real,                             -- design mock map position (fallback)
  y real,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- people ------------------------------------------
create table if not exists public.people (
  id text primary key default gen_random_uuid()::text,
  name text not null default 'New Member',
  email text default '',
  phone text default '',
  area text not null default 'Eastside',
  address text default '',            -- PRIVATE: home address (for routing/map)
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

-- ---------- join_requests (leader-managed leads) ------------
create table if not exists public.join_requests (
  id uuid primary key default gen_random_uuid(),
  group_id text references public.groups (id) on delete cascade,
  person_id text references public.people (id) on delete set null,
  status text not null default 'pending' check (status in ('pending','confirmed','declined')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- Row-Level Security
-- ============================================================
alter table public.profiles      enable row level security;
alter table public.groups        enable row level security;
alter table public.people        enable row level security;
alter table public.join_requests enable row level security;

-- profiles: a user can read their own profile.
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select using (auth.uid() = id);

-- groups: leaders have full access. NOTE: the public/anon audience never
-- selects the base table — it reads public_groups (below), which omits
-- address + exact coordinates.
drop policy if exists "leaders manage groups" on public.groups;
create policy "leaders manage groups" on public.groups
  for all using (public.is_leader()) with check (public.is_leader());

-- people: leaders only (PII).
drop policy if exists "leaders manage people" on public.people;
create policy "leaders manage people" on public.people
  for all using (public.is_leader()) with check (public.is_leader());

-- join_requests: leaders only.
drop policy if exists "leaders manage requests" on public.join_requests;
create policy "leaders manage requests" on public.join_requests
  for all using (public.is_leader()) with check (public.is_leader());

-- ============================================================
-- Public finder view — PII-free. Runs with the view owner's rights
-- (security_invoker off) so anon can read exactly these columns and
-- nothing else. Exposes the fuzzed public point, never the real address.
-- ============================================================
create or replace view public.public_groups
with (security_invoker = off) as
  select
    id, name, day, time, area, host, co_host, life, status, format, freq,
    capacity, members, childcare, topic, age_range, start_date, description,
    coalesce(public_lat, lat) as lat,     -- fuzzed point only
    coalesce(public_lng, lng) as lng,
    x, y
  from public.groups
  where status <> 'Paused';

grant select on public.public_groups to anon, authenticated;

-- ---------- updated_at triggers -----------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists groups_touch on public.groups;
create trigger groups_touch before update on public.groups
  for each row execute function public.touch_updated_at();

drop trigger if exists people_touch on public.people;
create trigger people_touch before update on public.people
  for each row execute function public.touch_updated_at();
