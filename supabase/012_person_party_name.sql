-- ============================================================
-- Connect TVC -- the connected/searchable name for a party of 2+ (e.g.
-- "The Smiths"), separate from `name`/`partner_name` (the two individuals).
-- Coordinators search and see this name headlined instead of one
-- individual's name; matching itself still runs off one shared set of
-- criteria on this same record (see 010_person_party_size.sql).
-- Run this in the Supabase SQL editor after 011_contact_log.sql.
-- ============================================================

alter table public.people add column if not exists party_name text default '';
