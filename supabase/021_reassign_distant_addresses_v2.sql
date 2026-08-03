-- ============================================================
-- Connect TVC -- second pass at reassigning groups/parties too far from
-- the church, with a lower (more aggressive) distance threshold.
--
-- 020_reassign_distant_addresses.sql (already run) used a 45mi
-- straight-line cutoff. After running it, the project owner reported the
-- map still showing too many groups clustered down in south/southwest
-- Arlington, Grand Prairie, Duncanville, and south Fort Worth — all
-- roughly 25-35mi straight-line from the church, comfortably under the
-- old 45mi cutoff even though DFW traffic realistically makes that drive
-- well over an hour.
--
-- IMPORTANT: 020 also used the WRONG church coordinates (lat 33.0269509,
-- lng -97.04275800) -- a plain address-string geocode of "2101 Justin Rd"
-- that landed ~3-4 miles south of the real church, in a residential
-- subdivision, not on the church's own parcel. Corrected here (and in
-- FinderMap.tsx's ChurchMarker) via a place_id-based geocode lookup
-- against the church's actual verified Google listing (Place ID
-- ChIJb9yJVYUyTIYRfKyLSizCkR4, matches Yelp/Waze/Facebook, tagged
-- `types: ["church", "place_of_worship", ...]`): lat 33.0704973, lng
-- -97.0601721. A 3-4mi anchor-point error doesn't meaningfully change
-- which rows clear a 45mi/25mi bar, so 020's already-reassigned rows
-- don't need to be redone -- but this pass uses the corrected point.
--
-- This is the exact same script as 020, with ONE number changed:
-- threshold_miles 45 -> 25. Everything else (target towns, round-robin
-- distribution, address generation, resetting lat/lng so the app's
-- existing auto-backfill re-geocodes them) is identical -- see 020's
-- header comment for the full reasoning on the approach. A new numbered
-- file rather than editing 020 in place, per this project's own
-- convention of never rewriting an already-run migration (014's "left in
-- place as a historical record" precedent).
--
-- Safe to run even though 020 already ran: rows 020 already moved are now
-- near the church (well under 25mi) and won't be re-selected; this pass
-- only catches whatever was between 25mi and 45mi that 020's threshold
-- was too lax to catch, plus (redundantly but harmlessly) anything still
-- beyond 45mi that somehow wasn't touched before.
--
-- Touches BOTH public.groups and public.parties, per the project owner's
-- direction on 020.
-- ============================================================

do $$
declare
  church_lat constant double precision := 33.0704973;
  church_lng constant double precision := -97.0601721;
  threshold_miles constant double precision := 25;
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
