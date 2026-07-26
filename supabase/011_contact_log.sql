-- ============================================================
-- Connect TVC -- outreach/contact log. Append-only: every time a
-- coordinator reaches out to a person looking for a group, they log it
-- here rather than overwriting a single "last contacted" field. That way
-- two coordinators working the same list can both see the full history
-- and avoid double-messaging someone. contacted_by is auto-attributed
-- server-side from the signed-in coordinator's email, never hand-typed.
-- Run this in the Supabase SQL editor after 010_person_party_size.sql.
-- ============================================================

create table if not exists public.contact_log (
  id uuid primary key default gen_random_uuid(),
  person_id text not null references public.people (id) on delete cascade,
  contacted_by text,
  note text default '',
  created_at timestamptz not null default now()
);

create index if not exists contact_log_person_id_idx on public.contact_log (person_id);

alter table public.contact_log enable row level security;

drop policy if exists "leaders manage contact log" on public.contact_log;
create policy "leaders manage contact log" on public.contact_log
  for all using (public.is_leader()) with check (public.is_leader());
