-- ============================================================
-- Connect TVC -- soft delete for parties and people.
--
-- Deleting a party or person used to be a real, permanent `DELETE` --
-- one misclick and a real person's contact info and match history was
-- gone with no recovery path. This adds `deleted_at`/`deleted_by`
-- columns instead: deletes become an UPDATE that marks the row deleted
-- and who deleted it, the app filters deleted rows out of every list,
-- but the data itself is still sitting in the table -- recoverable today
-- by clearing `deleted_at` directly in the Supabase table editor (no
-- in-app restore UI yet, that's a natural follow-on if it's ever needed).
--
-- Scoped to parties/people only (not groups) -- those are the tables that
-- hold real people's PII and placement history; groups stay a hard delete.
--
-- Run this in the Supabase SQL editor after 014_bulk_sample_data.sql (or
-- whichever migration you're currently on -- this one has no dependency
-- on 014 specifically, just needs the `parties`/`people` tables from 013).
-- ============================================================

alter table public.parties add column if not exists deleted_at timestamptz;
alter table public.parties add column if not exists deleted_by text;

alter table public.people add column if not exists deleted_at timestamptz;
alter table public.people add column if not exists deleted_by text;

create index if not exists parties_deleted_at_idx on public.parties (deleted_at);
create index if not exists people_deleted_at_idx on public.people (deleted_at);
