-- ============================================================
-- Connect TVC — add "Placement Details" to Home Groups.
-- A new, explicit data point (separate from the free-text `description`)
-- shown on the Finder's group card as "Placement Details" — replaces the
-- old derived "Good to know" line (which just guessed from childcare/topic).
-- Run this in the Supabase SQL editor after schema.sql.
-- ============================================================

alter table public.groups add column if not exists placement_details text default '';
