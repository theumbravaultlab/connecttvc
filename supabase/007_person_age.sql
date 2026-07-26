-- ============================================================
-- Connect TVC — add Person.age, used to match against a Group's
-- free-text age_range (e.g. "24–32") in the Finder's "matched on" chips.
-- Run this in the Supabase SQL editor after schema.sql (and, for the
-- backfill below to have anything to do, after 005_sample_data_dfw.sql).
-- ============================================================

alter table public.people add column if not exists age integer;

-- One-time backfill for existing rows with no age yet (the sample data
-- doesn't set one) — randomized but plausible per life stage, so the new
-- Age filter has real data to work with immediately. Safe to re-run: only
-- ever touches rows that are still null, never overwrites a real answer
-- entered through the app.
update public.people set age = case life
  when 'Students'      then floor(18 + random() * 6)::int   -- 18-23
  when 'Young Adults'   then floor(22 + random() * 11)::int  -- 22-32
  when 'Families'       then floor(28 + random() * 23)::int  -- 28-50
  when 'Couples'        then floor(25 + random() * 31)::int  -- 25-55
  else                        floor(18 + random() * 53)::int -- 18-70 ("Everyone")
end
where age is null;
