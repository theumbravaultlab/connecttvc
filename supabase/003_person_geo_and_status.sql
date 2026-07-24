-- ============================================================
-- Connect TVC — add address/geo to people, migrate to the new
-- 4-stage status lifecycle (New / Actively Searching / Waitlisted /
-- Grouped). Run this in the Supabase SQL editor after schema.sql.
-- ============================================================

alter table public.people add column if not exists address text default '';
alter table public.people add column if not exists lat double precision;
alter table public.people add column if not exists lng double precision;

alter table public.people alter column status set default 'New';

-- Migrate existing rows from the old 3-status scheme.
-- 'Waitlisted' is unchanged (already valid in the new scheme).
update public.people set status = 'Grouped' where status = 'Matched';
-- 'Unassigned' is ambiguous between "New" and "Actively Searching" — we
-- default to 'New' (the safer assumption); reclassify manually as needed.
update public.people set status = 'New' where status = 'Unassigned';
