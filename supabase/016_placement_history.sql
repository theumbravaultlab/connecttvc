-- ============================================================
-- Connect TVC -- placement history: track every group a party has been
-- assigned to over time, not just the current one.
--
-- `parties.group_id` only ever held the *current* assignment -- if a
-- coordinator moved a party from one group to another, there was no
-- record the first assignment ever happened. This adds an append-only
-- `placement_history` table: the app writes a row here whenever
-- saveParty() actually changes a party's assigned group (see
-- recordGroupChange() in src/app/actions.ts) -- never hand-entered.
--
-- `group_name_snapshot` deliberately duplicates the group's name at
-- assignment time (rather than only joining live through group_id) so
-- the history stays readable even if that group is later renamed or
-- deleted (group_id -> SET NULL on group delete, same as parties.group_id).
--
-- Run this in the Supabase SQL editor after 015_soft_delete.sql.
-- ============================================================

create table if not exists public.placement_history (
  id uuid primary key default gen_random_uuid(),
  party_id text not null references public.parties (id) on delete cascade,
  group_id text references public.groups (id) on delete set null,
  group_name_snapshot text not null default '',
  assigned_at timestamptz not null default now(),
  assigned_by text,
  unassigned_at timestamptz  -- null while this is the party's current group
);

create index if not exists placement_history_party_id_idx on public.placement_history (party_id);
create index if not exists placement_history_group_id_idx on public.placement_history (group_id);

alter table public.placement_history enable row level security;

drop policy if exists "leaders manage placement history" on public.placement_history;
create policy "leaders manage placement history" on public.placement_history
  for all using (public.is_leader()) with check (public.is_leader());
