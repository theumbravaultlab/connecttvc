-- ============================================================
-- Connect TVC -- couples/households searching together stay one
-- Person record instead of two. party_size is how many spots they
-- need (default 1); partner_name is a plain-text name for whoever
-- they're searching with (e.g. "the Smiths" -> partner_name "Sarah
-- Smith" on John's record, party_size 2).
-- Run this in the Supabase SQL editor after 008_backend_hardening.sql.
-- ============================================================

alter table public.people add column if not exists party_size integer not null default 1;
alter table public.people add column if not exists partner_name text default '';

alter table public.people drop constraint if exists people_party_size_check;
alter table public.people add constraint people_party_size_check check (party_size >= 1);
