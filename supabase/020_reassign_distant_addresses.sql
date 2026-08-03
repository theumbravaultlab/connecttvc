-- ============================================================
-- Connect TVC -- reassign groups/parties whose address is unreasonably far
-- from the actual church, closer to the church's own cluster of nearby
-- towns instead.
--
-- The church Connect TVC operates out of is The Village Church, 2101
-- Justin Rd, Flower Mound, TX 75028-3831 -- geocoded directly via the same
-- Google Geocoding API the app itself uses (not guessed):
--   lat 33.0269509, lng -97.04275800
-- (This is also now a permanent marker on the Map tab -- see
-- FinderMap.tsx's ChurchMarker.)
--
-- Plain SQL can't call Google's Routes API for real drive time, so "more
-- than an hour and a half from the church" is approximated with a
-- straight-line (haversine) distance instead. Chose 45 miles as the cutoff:
-- DFW driving speed averages well under highway speed once local streets
-- and traffic are accounted for, and straight-line distance always
-- undershoots actual drive distance (roads aren't straight), so 45mi
-- straight-line is a conservative stand-in for "~1.5 hours in practice",
-- not a precise conversion. Adjust the threshold below if that
-- approximation turns out too aggressive or too lax once you see the
-- actual rows it flags.
--
-- Only rows that already have coordinates are considered (lat/lng null
-- means never successfully geocoded -- already surfaced separately by the
-- Map's "missing a location" banner, out of scope here). Flagged rows are
-- reassigned to a new, freshly generated address in one of five towns near
-- the church -- Southlake, Coppell, Flower Mound, Double Oak, Highland
-- Village -- spread as evenly as possible (round-robin by id order within
-- each table), with lat/lng reset to null so the app's own existing
-- auto-backfill (GroupsListPage.tsx / PartiesListPage.tsx, on next
-- Directory open) re-geocodes them for real -- same pattern every prior
-- bulk-sample migration already relies on, not a new mechanism.
--
-- Per the project owner's direction: touches BOTH public.groups and
-- public.parties.
--
-- Idempotent-ish, not idempotent: safe to re-run, but a row reassigned by
-- an earlier run now lives near the church and won't be touched again
-- (expected). Ends with a summary query -- read its output after running.
-- ============================================================

do $$
declare
  church_lat constant double precision := 33.0269509;
  church_lng constant double precision := -97.042758;
  threshold_miles constant double precision := 45;
  streets constant text[] := array[
    'Josey Ln', 'Precinct Line Rd', 'Belt Line Rd', 'Mockingbird Ln', 'Custer Rd', 'Broad St',
    'Meadow Creek Dr', 'Elm St', 'Cross Timbers Rd', 'Rufe Snow Dr', 'Preston Rd', 'Parker Rd',
    'Pioneer Pkwy', 'Walnut Hill Ln', 'Virginia Pkwy', 'Spring Creek Pkwy', 'Collins St',
    'Division St', 'Main St', 'Stonebridge Dr', 'Eldorado Pkwy', 'Mason Ave', 'FM 407',
    'Timber Creek Dr', 'Long Prairie Rd'
  ];
  -- (city, zip) pairs, indexed 0-4 for the round-robin assignment below.
  cities constant text[] := array['Southlake', 'Coppell', 'Flower Mound', 'Double Oak', 'Highland Village'];
  zips constant text[] := array['76092', '75019', '75022', '75077', '75077'];
  groups_reassigned int;
  parties_reassigned int;
begin
  -- ---------- groups ----------
  with distant as (
    select
      id,
      ((row_number() over (order by id) - 1) % 5)::int as city_idx
    from public.groups
    where lat is not null and lng is not null
      and 3959 * acos(least(1, greatest(-1,
            cos(radians(church_lat)) * cos(radians(lat)) * cos(radians(lng) - radians(church_lng))
            + sin(radians(church_lat)) * sin(radians(lat))
          ))) > threshold_miles
  )
  update public.groups g
  set
    address = ((floor(random() * 9799) + 100)::int)::text || ' '
      || streets[1 + floor(random() * array_length(streets, 1))::int] || ', '
      || cities[d.city_idx + 1] || ', TX ' || zips[d.city_idx + 1],
    area = cities[d.city_idx + 1],
    lat = null,
    lng = null
  from distant d
  where g.id = d.id;
  get diagnostics groups_reassigned = row_count;

  -- ---------- parties ----------
  with distant as (
    select
      id,
      ((row_number() over (order by id) - 1) % 5)::int as city_idx
    from public.parties
    where lat is not null and lng is not null
      and 3959 * acos(least(1, greatest(-1,
            cos(radians(church_lat)) * cos(radians(lat)) * cos(radians(lng) - radians(church_lng))
            + sin(radians(church_lat)) * sin(radians(lat))
          ))) > threshold_miles
  )
  update public.parties p
  set
    address = ((floor(random() * 9799) + 100)::int)::text || ' '
      || streets[1 + floor(random() * array_length(streets, 1))::int] || ', '
      || cities[d.city_idx + 1] || ', TX ' || zips[d.city_idx + 1],
    area = cities[d.city_idx + 1],
    lat = null,
    lng = null
  from distant d
  where p.id = d.id;
  get diagnostics parties_reassigned = row_count;

  raise notice 'Reassigned % group(s) and % part(y/ies) to Southlake/Coppell/Flower Mound/Double Oak/Highland Village (>%mi straight-line from the church). Open the Directory (Groups then Parties list) once to trigger the existing auto-backfill and re-geocode them.',
    groups_reassigned, parties_reassigned, threshold_miles;
end $$;

-- ---------- verify: every row this migration touched now has lat/lng
-- reset to null and is waiting on the app's own auto-backfill. Note this
-- can also include any older, unrelated ungeocoded rows (e.g. a bad
-- address that never geocoded) -- it isn't scoped to just this run, unlike
-- the RAISE NOTICE above.
select 'groups' as table_name, count(*) as rows_pending_regeocode
from public.groups where lat is null and address <> ''
union all
select 'parties', count(*)
from public.parties where lat is null and address <> '';
