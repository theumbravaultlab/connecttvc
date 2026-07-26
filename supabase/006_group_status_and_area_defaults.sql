-- ============================================================
-- Connect TVC — simplify Home Group status to a 3-stage scheme
-- (New / Open / Closed) and drop the leftover "Eastside" area
-- default now that area is fully derived from the address's city.
-- Run this in the Supabase SQL editor after 005_sample_data_dfw.sql.
-- ============================================================

-- Migrate existing rows from the old 4-status scheme.
update public.groups set status = 'Open'   where status = 'Active';
update public.groups set status = 'New'    where status = 'Forming';
update public.groups set status = 'Closed' where status in ('Paused', 'Full');

alter table public.groups alter column status set default 'New';
alter table public.groups alter column area   set default '';
alter table public.people alter column area   set default '';
