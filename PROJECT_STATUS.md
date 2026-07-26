# Connect TVC — Project Status & Handoff

Last updated: 2026-07-24 · commit `804b733`

This document is written so a fresh conversation (human or AI) can pick up
this project with zero prior context. If you're Claude reading this at the
start of a new session: read this whole file before touching code.

## What this is

**Connect TVC** is an internal, login-only web app for a church's small-group
("home group") ministry. Two functions in one app:

1. **Map tab** — an interactive map + filterable list of home groups.
   Coordinators can select a specific person ("Finding for") to see groups
   that match their days/area, get automatic drive-time estimates to each,
   and see the person's own location on the map.
2. **Directory tab** — full CRUD for Home Groups and People (the individuals
   being placed into groups), with a searchable/filterable list view, address
   autocomplete, geocoding, and status tracking.

It started from a Claude-Design HTML handoff (a static mockup) and has been
built out into a real Next.js + Supabase + Google Maps app since. The
original working title was "Homeward"; it was rebranded to "Connect TVC"
partway through (see Rebrand section).

## Where it lives

- **Local path:** `C:\Users\dchur\homeward` (the folder name was deliberately
  *not* renamed to match the "Connect TVC" rebrand — only user-facing
  text/branding was changed, not the filesystem path)
- **Dev server:** `npm run dev -- -p 3007`, or via the Claude Code preview
  tool using the launch config named **`connect-tvc`** (defined in both
  `C:\Users\dchur\.claude\launch.json` and the project's own
  `.claude/launch.json`)
- **Git:** [github.com/theumbravaultlab/connecttvc](https://github.com/theumbravaultlab/connecttvc)
  (`origin`, branch `master`). Real commit history exists (see Git History
  below) — it was entirely uncommitted until a full review caught this
  early on; always commit meaningful chunks of work now.
- **Live in production:** [connecttvc.vercel.app](https://connecttvc.vercel.app),
  deployed via Vercel, connected directly to the GitHub repo.
  **Every push to `master` deploys straight to production — there is no
  staging/preview gate.** The user has said they'll be pushing live changes
  going forward. This means: always run a real `npm run build` (not just
  dev-mode `tsc`/`eslint`, which don't catch everything a production build
  does — this bit us once already, see Known Issues) before pushing
  anything, and always confirm with the user before pushing per the
  standing git-safety rules, since a push here is never a "just testing"
  action.
- **The Supabase project used throughout dev *is* production** (the user's
  explicit call — see "Product direction" above) — sample/seed data will
  be cleared from it when ready for real coordinators, not swapped to a
  separate project. `005_sample_data_dfw.sql` (the destructive bulk
  sample-data insert) has deliberately **never been run** against it for
  exactly this reason — don't run it.
- **Google Maps:** production Map ID created and set
  (`NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`, Vector, no tilt/rotation); the browser
  key's HTTP-referrer restriction now includes `connecttvc.vercel.app`.
- **Vercel project gotcha already hit once:** the project's Framework
  Preset can silently diverge from what a specific "Production" deployment
  was actually built with ("Production Overrides") if the preset was
  wrong on an earlier deploy and only fixed afterward — Vercel doesn't
  retroactively rebuild. Symptom: dashboard shows deployment "Ready" and
  domain "Valid Configuration," yet the live URL 404s on every route. Fix:
  redeploy (with build cache off) after confirming Project Settings →
  Framework Preset is actually "Next.js."

## Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js **16.2.11**, App Router, `src/` dir, Turbopack | Next 16 renamed Middleware → **`proxy.ts`**, `cookies()` is async, error boundaries get `unstable_retry` not `reset`. **Before writing Next-specific code, check `node_modules/next/dist/docs/`** — this project's `AGENTS.md` mandates it, since Next 16 broke a lot of assumptions from training data. |
| UI runtime | React 19 | |
| Styling | Tailwind **v4** | CSS-based `@theme` config in `src/app/globals.css`, no `tailwind.config.js`. Fonts: Fredoka (headings) + Nunito (body) via `next/font/google`. |
| Database/Auth | Supabase (Postgres + Auth + RLS) via `@supabase/ssr` | Project ref `xprooyihkptbiwfmkkjy`. Publishable key only — **never obtain or use the service_role/secret key**, by design (RLS is the enforcement boundary). |
| Maps | Google Maps Platform: **Maps JavaScript API**, **Geocoding API**, **Places API (New)**, **Routes API** — all 4 enabled and working | Via `@vis.gl/react-google-maps` (Google's official React wrapper), not raw JS API calls. |

## Where the config lives

`.env.local` (gitignored, never commit) holds:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=        # publishable key, safe in browser
NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY=  # referrer-restricted, used client-side
GOOGLE_MAPS_SERVER_KEY=               # IP-restricted, server-only (Geocoding/Routes)
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=       # optional; falls back to Google's DEMO_MAP_ID
```
`.env.local.example` documents the shape without real values. If `.env.local`
is absent or missing the Supabase vars, the app runs in **demo mode** —
reads/writes fall back to hardcoded seed data (`src/lib/seed.ts`), nothing
persists, and the auth gate is bypassed. This is intentional and useful for
UI testing without touching the real database.

## Architecture — the decisions that matter

**Fully gated, no public surface.** This pivoted partway through development.
Originally the Map/Finder was meant to be public (anonymous visitors browsing
groups) with a separate authenticated Console. The user changed the
requirement: **everything is behind login now**, admin-provisioned accounts
only (coordinators create accounts for people via the Supabase dashboard;
self-signup must be manually disabled in Supabase Auth settings), password
auth (not magic-link — that was tried first, then explicitly rejected in
favor of email+password). `src/proxy.ts` gates every route except `/login`.
Because of this, the "Finding for" person-matching feature (which reads PII)
is always available to any signed-in user — there's no separate "public"
degraded mode anymore.

**RLS is the real security boundary, not the UI.** `supabase/schema.sql`
defines a `profiles` table with a `role` column and an `is_leader()` helper;
every table's RLS policy requires `is_leader()`. `supabase/002_lock_down.sql`
additionally drops a `public_groups` view and revokes anon grants that were
built for the original public-facing design and are no longer needed — **this
migration has not been confirmed run against the live database**, meaning
that view may still be live and leaking group names/times to anyone with the
publishable key (not sensitive PII, but not intended to be exposed either).

**Area is auto-derived, not manually chosen.** Originally `area` was a fixed
5-value dropdown (Eastside/Downtown/North Hills/Westgate/Midtown — leftover
category labels from the original design mockup). This was changed: `area`
is now derived from the **city component of the geocoded address**, set (a)
client-side immediately when a user picks an address-autocomplete suggestion
(via a Place Details `fetchFields` call), and (b) server-side authoritatively
whenever a record is saved or backfilled (so it self-heals even for
hand-typed addresses). The Finder's area filter dropdown now builds its
option list dynamically from whatever areas are actually present in the data
— there is no fixed list anymore. `src/lib/types.ts` no longer exports
`AREAS`/`Area`. One leftover artifact of the old fixed-area design was found
and fixed: the `blankGroup`/`blankPerson` factories (used when clicking "New
group"/"New person", now in `GroupsListPage.tsx`/`PeopleListPage.tsx`) were
still defaulting `area` to the hardcoded string `"Eastside"` — new records
now start with an empty area (showing the "From address" placeholder) until
a real address is entered.

**"Area" is really "City" — the UI now says so, and the data is
guaranteed to match.** Two more leftover artifacts of the old fixed-area
design were found and fixed:
- `supabase/004_sample_data_dfw.sql`'s bulk sample data had `area` values
  from the *original* 5-value scheme (Eastside/Downtown/etc.) even though
  its `address` column already had real DFW street addresses with the
  correct city — e.g. a group had `area: 'Eastside'` but
  `address: '...Plano, TX 75024'`. This file was since fully regenerated at
  a larger scale (see the next section) with `area` always matching the
  address's city from the start, so this specific inconsistency no longer
  exists in it.
- `src/app/actions.ts`'s `groupToRow`/`personToRow` kept the *old* `area`
  value when an address was cleared to blank (`geo` is null whether the
  address is empty or a non-empty address just failed to geocode — those
  two cases need different handling, and only the address-is-empty one was
  wrong). Now: empty address → empty area; non-empty address whose geocode
  attempt failed → keeps the last-known area (unchanged behavior, since that
  attempt may just be a transient API hiccup).

Also renamed every user-facing "Area"/"Home area" label to "City"/"Home
city" (`GroupForm.tsx`, `PersonForm.tsx`, `tables.tsx`, the Directory list
pages' filters, and the Finder's filter/search copy) so the UI matches what
the field actually holds. The internal field/column name is still `area` —
renaming that would mean a live DB column rename for a purely cosmetic
gain, so only the label changed, not the data model.

**`supabase/004_sample_data_dfw.sql` was regenerated at church-scale, twice
— now v2: 320 groups, 600 people, ⚠️ destructive.** The original 25+100
rows were sized for basic UI testing, not for exercising the matching logic
with any real variety, and even the first church-scale pass (180/450, flat
across 39 equally-weighted cities) still left **35.7% of people with zero
candidate groups** under the Finder's default match rule (exact city AND
day-overlap AND exact life stage) — the geography was too spread out for
that 3-way AND to ever line up. v2 fixes this by *concentrating* rather
than spreading: 10 primary DFW cities (Dallas, Fort Worth, Arlington,
Plano, Frisco, Irving, McKinney, Garland, Grand Prairie, Richardson) get
the bulk of both groups and people — which also happens to be realistic,
since a real church draws disproportionately from nearby suburbs — plus 8
secondary cities and 21 long-tail cities with lighter coverage, same 39
total. Group meeting day and person day-availability (now 3–5 days instead
of 1–3) both draw from the same weeknight-heavy weighting (Tue/Wed/Thu most
common) instead of being independently uniform, and life stage draws from
the same realistic-roster skew (Families/Everyone most common) for both —
deliberately correlated, since that's what actually produces overlap
rather than two independent dice rolls that rarely agree. Generated by a
small script (not checked in — it was a one-off) that also computes the
resulting match-rate distribution and writes it into the SQL file's own
header comment for anyone reading it later. **Result for v2: 16.8% zero
matches, 20.7% exactly one, 62.5% two-or-more (avg 2.80, max 11 for one
person)** — a meaningful chunk of people still have zero strict matches,
which is realistic (not everyone fits an existing group) and useful for
exercising the "matched on" broaden-search chips, but the common case is
now genuinely multiple candidates. Every address embeds its city correctly
(validated with a script — zero mismatches, zero broken rows, zero
dangling `group_id` references across all 920 rows, correct field count on
every single row including the new `placement_details` column below).
**Important:** this file opens with
`delete from public.people; delete from public.groups;` before inserting —
it doesn't just add rows alongside whatever's already there, it wipes and
replaces the *entire* contents of both tables every time it's run. That
was a deliberate choice (this app's own docs already call all current
sample/seed data disposable placeholder content, not real Connect TVC
records) but means running it also removes the original 5+5 rows from
`seed.sql`, and running it twice is safe/idempotent rather than additive.
**Do not run this against a database that has any real coordinator-entered
data in it.**

**Home Groups have a new "Placement Details" field.** Replaces the old
derived "Good to know" line on the Finder's group card (which just guessed
from `childcare`/`topic` — never an explicit, coordinator-editable field).
Added `placement_details` to the `groups` table
(`004_group_placement_details.sql`), a new "Placement details" textarea in
`GroupForm.tsx`'s Basics section, and `GroupCard.tsx` now labels that same
line "Placement details" instead of "Good to know" — with a fallback to
the old childcare/topic-derived guess for any group saved before this
field existed, so older records don't just show blank.

**The Directory tab (formerly "Console") has a searchable, filterable list
view.** Both the Groups and People lists (`GroupsListPage.tsx` /
`PeopleListPage.tsx`) render as a D365-style table instead of a card list,
with a search box plus Status / Life Stage / Area filter dropdowns above it
(the Area options are built dynamically per the pattern above, same as the
Finder). Groups show Name, Meeting Day, Area, Life Stage, Status, and Spots
Available (`capacity - members`); People show Name, Home Area, Life Stage,
and Status. Filters are local to each list page (not persisted across
navigation).

**Directory is fully routed — editing a record is a real page, not a side
panel.** This was a deliberate redesign: a fixed-width side rail couldn't
comfortably fit forms with 6+ sections, which is what prompted the change.
Clicking a row now navigates to `/directory/groups/:id` or
`/directory/people/:id` (`GroupEditPage.tsx` / `PersonEditPage.tsx`) — a
full-width, capped-at-760px page with a back link, the existing form, and
the save/delete bar. `/directory/groups` and `/directory/people` are
themselves real routes too (`(app)/directory/groups/page.tsx` etc.), and the
top-level Map|Directory switch in `AppShell.tsx` is now real `<Link>`s
instead of client tab state — the whole app is deep-linkable and the browser
back button works everywhere. "New group"/"New person" creates the blank
record in shared state immediately (same as before) and then navigates
straight to its real id, so the URL is never a fake placeholder like `/new`.
Groups/people data is fetched once in `(app)/layout.tsx` and shared via
`DirectoryData.tsx`'s React context — since that layout doesn't remount on
client-side navigation between its child routes, in-progress unsaved edits
(which patch the shared context state directly, same as the old design)
survive navigating away and back, and only a hard refresh re-fetches fresh
data from Supabase.

**Groups and People are geocoded in parallel.** Both have `address`, `lat`,
`lng` columns and go through the same `AddressAutocomplete` component →
`geocodeAddress()` (`src/lib/geocode.ts`) → saved on `saveGroup`/`savePerson`.

**Placing new records on the map is now automatic — no more "Place N on
map" button.** That button used to exist on both Directory list pages for
records that had an address before geocoding existed (or were bulk-inserted
via SQL, which is exactly what the sample-data migrations do). It's gone
now: `GroupsListPage.tsx`/`PeopleListPage.tsx` each run a `useEffect` once
per mount that checks for any rows with an address but no lat/lng and, if
it finds any, calls `backfillGroupLocations()`/`backfillPersonLocations()`
in the background automatically — a small status line appears while it
runs and fades out after. The server actions were changed to return the
actual updated `{id, lat, lng, area}` rows (they used to just return a
count), so the client patches its local state directly instead of forcing
a full page reload. This was already effectively true for anything saved
*through the app* (every save already re-geocodes unconditionally); the
change just extends "automatic" to cover legacy/bulk-inserted rows too, the
one case that wasn't already covered. Still loops one Geocoding API call
per row server-side, so a fresh bulk import (like the ~920-row sample
dataset) will take several minutes silently in the background the first
time the Directory is opened after running those migrations — same total
time as before, just no click required.

**Matching now also considers Age and Childcare, not just day/city/life
stage.** Added `Person.age` (`age` column, `007_person_age.sql` — includes
a one-time backfill of plausible ages per life stage for existing rows,
since neither the seed data nor the bulk sample data had one before this).
`src/lib/ageRange.ts` parses a Group's free-text `ageRange` (e.g. `"24–32"`,
or `"All ages"` which always matches) and checks a person's age against it;
an unknown person age never excludes a group. Both Age and "Needs
childcare" (matching `Person.childcareNeeded` against `Group.childcare`,
which existed already but was never actually enforced anywhere) joined the
existing day/city/life-stage set as toggleable "matched on" chips in
`Finder.tsx` — same tap-to-include/exclude pattern, default active. The Age
chip only appears if the person has an age on file; the Childcare chip only
appears if they actually need it (a "must have childcare" filter is
meaningless for someone who doesn't).

**The Finder gained a "Show people" map layer, and the filter area was
decluttered.** Off by default (keeps the map uncluttered, per direct
feedback that it "seems a little cluttered"). When on: if a Home Group is
selected, shows just that group's current roster (`person.group ===
selectedId`) as pins; otherwise shows everyone. Every roster pin is colored
by *that person's own status* (`statusSolid()` in `colors.ts`, reusing the
existing status hues) rather than life stage, and rendered smaller/lower
z-index than the "Finding for" person's pin so the two never compete —
the searched-for person keeps their own distinct elevated marker
regardless of the toggle, so a coordinator can review a group's existing
makeup and still see where their candidate sits relative to it, together.
Toggling "Show people" deliberately does **not** change the map's
auto-zoom/fit behavior (`FinderMap.tsx`'s `FitToPoints` only ever
considers groups + the Finding-for person) — otherwise turning the layer
on or off would yank the viewport around. Separately, the always-visible
Status filter row was merged into the same row as City/Life Stage (was its
own row below) to cut the browse-mode filter area from 4 stacked rows to 3.

**Travel time is a single batched Routes API call, not one-per-group.**
When a person is selected in "Finding for", `getTravelTimesToGroups`
(`src/app/actions.ts`) calls the Routes API's **`computeRouteMatrix`**
endpoint once with one origin (the person) and N destinations (the filtered
groups), not N separate `computeRoutes` calls. Results render as a small
car-icon badge on each group card.

**The map is hard-bounded to the DFW metroplex.** The org (Connect TVC) only
ever operates in Dallas–Fort Worth, so `src/components/finder/FinderMap.tsx`
sets a `restriction` MapOption with `strictBounds: true` — users can zoom in
freely but can never pan/zoom out past the DFW box. Falls back to showing the
full DFW view when nothing is located yet (previously fell back to a
US-wide view, which no longer makes sense for this org).

**Pins never visually overlap.** `spreadOverlaps()` in `FinderMap.tsx`
buckets group+person pins by rounded coordinate (~110m grid) and nudges any
that collide into a small ring around their shared point — purely a
rendering adjustment, never touches stored coordinates.

**Server actions are all auth-gated, even read-only ones**, because Next.js
server actions are reachable via direct POST regardless of the UI — every
action in `src/app/actions.ts` calls `requireLeader()` (which no-ops in demo
mode, throws if configured-but-unauthenticated).

**Data-fetch failures are never silently masked as demo data.**
`src/lib/data.ts`'s `getGroups`/`getPeople` only fall back to seed data when
Supabase isn't configured at all. If it *is* configured but a query fails
(expired session, RLS issue, network problem), it throws — caught by
`src/app/error.tsx`, which shows a clear "couldn't load your data" message
with a retry button, specifically so a coordinator can never mistake a
real failure for legitimately-empty demo data.

## File map

Editing a Group or Person is a real routed page now (`/directory/groups/[id]`,
`/directory/people/[id]`), not a fixed side panel — see the "Directory is
fully routed" section above for why. That means the app shell moved from a
single client-state tab switcher into a Next.js route group:

```
src/
  app/
    actions.ts          — ALL server actions (save/delete/backfill/travel-times), each auth-gated
    error.tsx            — error boundary for data-fetch failures (uses Next 16's unstable_retry)
    layout.tsx            — root layout, fonts, metadata
    login/page.tsx         — email+password sign-in (only public route)
    (app)/                  — route group (no URL segment) for everything behind the tab shell
      layout.tsx              — fetches groups/people + viewer email ONCE, renders <AppShell>
      page.tsx                 — "/" — the Map tab (<Finder>, reading from context)
      directory/
        page.tsx                — "/directory" — redirects to /directory/groups
        groups/
          page.tsx                — "/directory/groups" — searchable/filterable list (table)
          [id]/page.tsx            — "/directory/groups/:id" — full-width edit page
        people/
          page.tsx                — "/directory/people" — searchable/filterable list (table)
          [id]/page.tsx            — "/directory/people/:id" — full-width edit page
      reports/
        page.tsx                — "/reports" — management-facing data visuals (<ReportsPage>)
  components/
    AppShell.tsx            — header + Map|Directory|Reports nav links + <DirectoryDataProvider>,
                               mounts <APIProvider> for Google Maps once for every routed page
    ConfirmDialog.tsx        — themed delete-confirmation modal (replaces window.confirm)
    reports/
      ReportsPage.tsx           — computes aggregates from groups/people, renders every report section
      charts.tsx                — hand-rolled, theme-aware chart primitives (no charting dependency)
    directory/                 — formerly "console"; renamed since "Directory" reads better to
                               coordinators than an internal-tooling word like "Console"
      DirectoryData.tsx        — React context holding groups/people + setters, so an edit on any
                                 route (list or detail) is instantly visible everywhere else,
                                 without keeping every page mounted at once
      DirectoryNav.tsx          — the "Home Groups | People" tab pills, as real <Link>s
      GroupsListPage.tsx / PeopleListPage.tsx — search/filter bar + table (used by the list routes)
      GroupEditPage.tsx / PersonEditPage.tsx  — back link + form + <SaveBar> (used by the [id] routes)
      SaveBar.tsx               — shared sticky delete/save action bar
      tables.tsx                — GroupTable/PersonTable/EmptyState (D365-style list view)
      AddressAutocomplete.tsx — Places autocomplete input; on selection, resolves city via
                                 Place Details and fires onPlaceSelected for area auto-population
      GroupForm.tsx / PersonForm.tsx — the actual edit forms (unchanged; each already renders its
                                 own header, so the edit pages stay thin)
      form-bits.tsx            — shared Field/SectionHeading/BackLink layout helpers
    finder/
      Finder.tsx               — Map tab: filters, "Finding for" search, group list, travel-time fetch
      FinderMap.tsx            — the actual Google Map: DFW bounds, anti-overlap, group/person pins
      GroupCard.tsx            — individual group card in the list (collapsed/expanded)
      PersonSearch.tsx         — typeahead person picker (replaced a plain <select>)
    icons.tsx / ui.tsx       — shared SVG icons and styled primitives (TextInput, StatusPill, etc.)
  lib/
    auth.ts                — getViewerIsLeader() helper
    colors.ts               — oklch-based color system (life-stage hues, status hues)
    data.ts                  — getGroups/getPeople (Supabase-or-seed reads)
    geocode.ts                — server-only: address -> {lat, lng, city} via Geocoding API
    routes.ts                  — server-only: batched drive-time via Routes API computeRouteMatrix
    seed.ts                     — demo-mode fallback data (5 groups + 5 people, fictional)
    supabase/{client,server,config}.ts — Supabase client setup, demo-mode detection
    types.ts                     — all domain types (Group, Person, statuses, etc.)
  proxy.ts                       — Next 16 middleware-equivalent; gates every route except /login
supabase/
  schema.sql                     — full schema + RLS policies (run first, once)
  seed.sql                       — original 5 groups + 5 people sample data (superseded by 005 below)
  002_lock_down.sql              — drops the leftover public-facing view; NOT CONFIRMED RUN
  003_person_geo_and_status.sql  — adds address/lat/lng to people, migrates status values; NOT CONFIRMED RUN
  004_group_placement_details.sql — adds groups.placement_details; NOT CONFIRMED RUN
  005_sample_data_dfw.sql        — ⚠️ DELETEs all groups/people, then inserts 320 groups + 600
                                 people across 39 real DFW cities (v2 — see file header for the
                                 match-rate summary); NOT CONFIRMED RUN. Renumbered from 004 to
                                 005 because it now depends on 004's placement_details column —
                                 if you see references to "004_sample_data_dfw.sql" elsewhere in
                                 this doc's older notes, this is that file.
  006_group_status_and_area_defaults.sql — migrates Group status to New/Open/Closed, drops the
                                 "Eastside" area default; NOT CONFIRMED RUN
  007_person_age.sql             — adds people.age + backfills a plausible age per life stage
                                 for any row that doesn't have one yet; NOT CONFIRMED RUN
  008_backend_hardening.sql      — CHECK constraints on every enum-like column, an index on
                                 people.group_id, drops 4 dead groups columns (x/y/public_lat/
                                 public_lng) + the unused join_requests table; NOT CONFIRMED RUN
```

## Database migrations — must run in this order

```
schema.sql  →  seed.sql  →  002_lock_down.sql  →  003_person_geo_and_status.sql  →  004_group_placement_details.sql  →  005_sample_data_dfw.sql  →  006_group_status_and_area_defaults.sql  →  007_person_age.sql  →  008_backend_hardening.sql
```

As of this handoff, **schema.sql and seed.sql have been run** (confirmed
earlier in the project). **002 through 008 have NOT been confirmed
run** — this is the single most important pending action. 007 is fine to
run anytime after schema.sql technically, but it's listed last because its
backfill is only useful once the sample-data rows it's backfilling
actually exist — run it before 005 and the backfill just does nothing.
Note the order matters more than the numbers alone suggest elsewhere too:
005 (bulk sample data) inserts
a `placement_details` value on every group row, so it will fail outright if
004 hasn't run first to add that column. After running them, geocoding
happens on its own — see "Placing new records on the map is now automatic"
below — since SQL inserts don't trigger the app's geocoding logic on their
own, but the Directory list pages now detect and backfill any
still-ungeocoded rows in the background the first time they're opened.

## Domain model summary

- **Group**: name, day, time, area (auto), host/co-host, life stage, status
  (**New**/**Open**/**Closed** — New=blue, Open=green, Closed=red; redesigned
  from an original 4-value Active/Forming/Paused/Full scheme), format
  (In-person/Hybrid/Online), frequency, capacity/members, childcare, address
  (private), lat/lng, description, etc.
- **Person**: name, contact info, area (auto), address (private), lat/lng,
  available days, time preference, life stage, childcare needed, status,
  assigned group, notes.
- **Person status** (redesigned from an original 3-value Unassigned/
  Matched/Waitlisted scheme): **New** (blue) → **Actively Searching** (amber)
  → **Waitlisted** (orange) → **Grouped** (green). Colors use the same
  oklch-hue system as everything else (`src/lib/colors.ts`).
- Note: `groups.members` is a **manually-entered headcount**, deliberately
  *not* auto-derived from `people` rows assigned to that group — `people`
  only tracks individuals who went through the coordinator placement
  pipeline, not a group's full real-world roster (confirmed by the seed data:
  groups show 8–10 members while only 1–2 `people` rows reference them).
  Auto-deriving would have been actively wrong. A UI tip nudges coordinators
  to update it manually when relevant.

## Dark mode

**Every color in the app was hardcoded — this required a real token
refactor, not just a CSS toggle.** `src/app/globals.css` had *already*
declared a semantic CSS-variable palette (`--ink`, `--muted`, `--faint`,
`--panel-1/2/3`, `--border`, `--divider`, etc.) from early in the project,
but no component had ever actually adopted it — every file used the raw
hex literal directly (`text-[#16324f]` instead of `text-[var(--ink)]`).
Dark mode meant finally closing that gap: catalogued every distinct hex
color used across `src/` (a `grep` turned up ~30, reused very
consistently — e.g. `#16324f` alone appeared 34 times), then bulk-replaced
every one that needs to differ between themes with its `var(--token)`
equivalent, in both Tailwind arbitrary-value classes (`bg-[#f7fafd]` →
`bg-[var(--panel-1)]`) and inline `style` objects. ~203 replacements across
19 files, done with a throwaway script (not checked in) rather than by
hand, then verified with `tsc`/`eslint` and a `grep` sweep confirming zero
of the old hex values remained anywhere they should have changed.

**Deliberately NOT tokenized — left as literals:** `#088df9` (brand blue)
and `#a3cbfc` (brand-blue-light borders) don't change between themes, so
touching their ~58 call sites would have been pure risk for zero visual
change. Every `oklch()` life-stage/status hue in `colors.ts`
(`lifeColors()`, `statusColors()`, `statusSolid()`) was also left alone —
those are self-contained badge/pin colors with their own built-in
light-bg-dark-text or solid-fill-white-text contrast that reads fine
regardless of page theme, which is itself a common, acceptable dark-mode
pattern (not a shortcut). The one genuinely tricky part was `#fff`/white:
it's used for two *different* things in this codebase — card/panel
**surface** backgrounds (must flip dark) and **content** colors like white
text/icons sitting on an already-colored fill such as a blue button or a
status pin (must never flip, or it'd break contrast against a fill that
isn't changing). Each of the ~20 occurrences was checked individually
rather than bulk-replaced; surface ones now use a new `--surface` token,
content ones were left as literal `#fff`.

**New tokens added to `globals.css`:** `--surface`, `--panel-4`,
`--border-accent`, `--brand-blue-dark`, `--amber-border`,
`--scrollbar-thumb` (a few near-duplicate pale-blue shades from the
original design handoff — e.g. `#eaf3fc`, `#e9f2fb`, `#eef2f6` — were
deliberately consolidated onto existing tokens like `--panel-3`/`--divider`
rather than each getting its own dark variant, since they're already
visually indistinguishable in light mode). Dark values are hand-picked to
preserve the *same relative hierarchy* as light mode (page background
darker than card surfaces, so cards still visually "pop" against the
page), not just an automatic inversion.

**Theme resolution order:** an explicit user choice (`ThemeProvider.tsx`,
stored in `localStorage` under `connect-tvc-theme`) beats OS preference,
which beats the light default — implemented as `:root[data-theme="dark"]`
(explicit) → `@media (prefers-color-scheme: dark)` guarded by
`:root:not([data-theme="light"])` (OS default) → plain `:root` (light
fallback) in `globals.css`. No flash on load either way: a
`next/script strategy="beforeInteractive"` snippet in the root layout
restores a *stored* override before hydration (a plain `<script>` tag
doesn't work here — React only renders it as inert markup and warns about
it; `beforeInteractive` is Next's documented mechanism for exactly this
"run before hydration" case). When there's no stored override yet, no JS
runs at all — the `prefers-color-scheme` media query alone renders the
right theme on the very first paint. The toggle button (sun/moon icon,
`AppShell.tsx` header) only ever switches between light/dark explicitly;
there's no third "system" option, matching what was actually asked for.

**Google Maps also switches themes.** `@vis.gl/react-google-maps`'s
`<Map>` component exposes a `colorScheme` prop (`ColorScheme.DARK` /
`ColorScheme.LIGHT`) added in a recent Maps JS API version —
`FinderMap.tsx` reads the current theme via `useTheme()` and passes it
straight through. This is Google-side map tile/UI styling, independent of
the app's own CSS variables. **Not visually confirmed live** — same
constraint as the map generally (see Known Issues): this session's
automated browser can't render the interactive map, so this needs a check
in a real browser.

## Second feature batch: Reports tab, multiselect days, distance sort, pin emphasis, custom delete confirm

**New "Reports" tab** — a third top-level section (`Map | Directory |
Reports`, `AppShell.tsx`) for upper-management-facing visuals, built from
the existing Group/People data with no new dependency. Route:
`(app)/reports/page.tsx` → `src/components/reports/ReportsPage.tsx`, reusing
the shared `DirectoryData` context like every other tab. Chart primitives
(`src/components/reports/charts.tsx`: `StatCard`, `ReportCard`, `HBar`,
`SegmentedBar`, `PairedBarChart`) are hand-rolled with CSS custom properties
rather than a charting library, so they get dark mode and the app's own
design language for free — same philosophy as the existing `CapacityBar`/
`SpotsPill` in `ui.tsx`. Sections: KPI row (total groups/people, % open, %
placed), group status breakdown, capacity utilization (members/capacity
across non-Closed groups), person placement funnel (ordered New → Actively
Searching → Waitlisted → Grouped), childcare supply-vs-demand, supply-vs-
demand by life stage, top 8 cities by groups+people, and a "Needs attention"
panel (closed-group count, new/unactivated-group count, waitlisted count,
plus cities that have people waiting but zero Open group in that city — a
computed geographic-gap signal, not a stored field).

**Multiselect day filter on the Map's browse mode.** `Finder.tsx`'s
non-person-matched day filter was a single-select `day: DayShort | "All"`;
changed to `days: Set<DayShort>` (empty = no restriction), with the pill row
now toggling membership instead of replacing the whole selection, and an
"All" pill that clears the set. This is separate from the person-matched
mode's `activeDays` (already multi-select-like via the "matched on" chips) —
this change only affected plain browsing with no person selected.

**Distance-based sort when the city isn't filtering.** When a "Finding for"
person is selected and their city match is toggled off (`areaActive ===
false` in the "matched on" chips), the group list now sorts by drive time
from that person (`travelTimes[g.id].minutes`, reusing the existing batched
Routes API call — no new API usage), closest first, instead of arbitrary
order. Scoped deliberately to the person-matched case only: there's no
reference point to measure distance from in plain browse mode without adding
browser geolocation, which wasn't part of this ask — flagging this scope
decision here in case city-agnostic browse-mode sorting is wanted later.

**Stronger selected-pin styling on the map.** Both the "Finding for" person
pin (always) and the selected Group pin (when selected) now render a
pulsing radar-style halo behind them (`hw-pulse-ring` / `@keyframes
hw-map-pulse` in `globals.css`), on top of the Group pin's existing
scale+shadow treatment (bumped from 1.16x to 1.32x scale). The status-colored
roster pins (`StatusPersonPin`, shown via "Show people") deliberately do
**not** get this treatment, so the two "this one matters most" pins stay
visually distinct from the general roster layer.

**Delete confirmation is now in-app, not a browser `confirm()` popup.** New
`src/components/ConfirmDialog.tsx` — a themed modal (backdrop click or
Cancel to dismiss, destructive red confirm button, matches `SaveBar`'s
existing red-accent styling). `GroupEditPage.tsx` and `PersonEditPage.tsx`
both now open this dialog on "Delete" instead of calling `window.confirm`
synchronously; the actual delete logic moved into an `onConfirm` handler.

## Map filter pane redesign

**The browse-mode filter pane was cramped and hard to scan, so it was
reorganized.** Direct feedback: "lots of filters and the space does not
seem to be best setup." Previously: 8 always-visible day pills (All +
Mon–Sun) wrapping across 2 lines, then City/Life Stage/Status packed into
one `flex-wrap` row with `min-w-[30%]` each and only `sr-only` labels — no
visible grouping, no indication of how many filters were active, no way to
reset them all at once. Now (`Finder.tsx`):
- **Day filter is a popover**, not always-visible pills. A single "Day"
  trigger button shows a summary ("Any day" / a day name / "N days") and a
  blue border when active; clicking it opens a small panel of the same day
  toggle pills (click-outside or Escape closes it) — a new
  `DaysFilterPopover` component at the bottom of `Finder.tsx`.
- **City/Life Stage/Status moved into a proper 2×2 grid** (Day, City, Life
  stage, Status) with visible uppercase labels above each control instead of
  screen-reader-only ones, so the filter set reads as a clear group at a
  glance instead of an unlabeled row of selects.
- **Active-filter count + "Clear all"** appears above the grid only when at
  least one filter (search text, days, city, life stage, or status) differs
  from its default — one click resets everything, including the search box.
- **Inline clear (×) inside the search input** when it has text, independent
  of "Clear all".
This only touched the browse-mode (no person selected) filter UI — the
person-matched "Finding for" mode's "matched on" chips were untouched.
**Not yet visually confirmed live** (same login constraint as the rest of
this handoff) — verified via `tsc`/`eslint` (clean, same baseline) and
confirming the app still loads/redirects with zero console errors.

## Full UI audit (contrast, typography, structure, layout)

User asked for a full review against UI best practices. Findings and fixes,
worst first:

**Two real WCAG AA contrast failures, fixed at the token level
(`globals.css`, light mode only — dark mode already passed).** Measured via
the standard relative-luminance formula:
- `--faint` was ~2.7:1 against `--surface` (needs 4.5:1 for normal text) —
  darkened `#8aa0b4` → `#5f7992` (~4.5:1). `--muted` was borderline at
  ~4.49:1 — darkened `#5b7a97` → `#4f6b85` (~5.6:1), keeping it visibly
  darker than `--faint` so the two-tier hierarchy survives.
- `--amber-fg` on `--amber-bg` (the "Demo mode" banner, PersonForm's
  placement tip) was ~2.7:1 — darkened `#c78a2e` → `#8a5c1e` (~5.3:1).
Confirmed via computed styles in-browser after the change (light-mode
`:root` values read back exactly as set).

**A real bug: `--shadow-card` was referenced but never defined.**
`login/page.tsx` and `error.tsx` both used `style={{ boxShadow:
"var(--shadow-card)" }}`, but the variable didn't exist anywhere in
`globals.css` — an undefined custom property makes the whole declaration
invalid, so both cards rendered completely flat. Added light (`0 12px 32px
rgba(22,50,79,.14)`) and dark (`0 12px 32px rgba(0,0,0,.55)`) values;
confirmed the resolved `box-shadow` in-browser.

**No focus ring on any form input/select — a real keyboard-accessibility
gap.** Every input/select used `outline-none` + `focus:border-[...]` only
(19 occurrences, 7 files), no ring anywhere in the codebase. Added
`focus:ring-2 focus:ring-[var(--brand-blue)]/30` alongside the border-color
change everywhere that pattern appears, including `ui.tsx`'s shared
`controlClass` (covers every `GroupForm`/`PersonForm` field for free).

**The new map-pin pulse ring had no `prefers-reduced-motion` guard.**
`hw-map-pulse` animates infinitely; added a `@media
(prefers-reduced-motion: reduce)` override in `globals.css` that disables
the animation and shows a static low-opacity ring instead.

**Type scale had fragmented into ~18 distinct pixel sizes.** Consolidated
just the small-text band, where the actual duplication was concentrated —
9.5px/10px → 10px, 10.5px/11px → 11px, 11.5px/12px → 12px, 12.5px/13px →
13px — a mechanical, max-0.5px-shift find/replace across every file.
Larger display/heading sizes (14–28px) were left alone: each is a
deliberately distinct "stat callout" or heading role (StatCard's 28px vs.
the capacity stat's 26px vs. a heading's 21px, etc.), not runaway drift.

**Brand blue was hardcoded as a literal hex in 15+ files** instead of the
`--brand-blue`/`--brand-blue-light` tokens that already existed for this.
Scripted find/replace to `var(--brand-blue)` / `var(--brand-blue-light)`
everywhere except `app/icon.svg` (a standalone favicon asset with no access
to the page's CSS custom properties — must stay a literal) and
`icons.tsx`'s `HomeMark` (the fixed logo mark, same "self-contained brand
color" precedent as the oklch life-stage/status hues from the dark-mode
work). Zero visual change — same resulting color — purely so a future
color tweak is a one-line var edit instead of a codebase-wide find/replace.

**The Directory list filters were inconsistent with the Map's newly-labeled
filter grid, and ~90% duplicated between the two list pages.** Extracted a
new `src/components/directory/ListFilterBar.tsx` (generic over the status
enum, since Group/Person statuses differ) used by both
`GroupsListPage.tsx`/`PeopleListPage.tsx` — visible uppercase labels above
every control (previously `aria-label`-only), and controls standardized to
`py-2` to match the Map's filter grid height (was `py-1.5`). Also
normalized the Map's own "Finding for" label from a stray 12px down to the
same 11px every other filter label uses.

**`GroupForm`/`PersonForm`'s two-up field rows used fragile `flex flex-wrap`
+ `sm:w-[48%]` percentage math.** Switched to `grid grid-cols-1
sm:grid-cols-2 gap-3` (`form-bits.tsx`'s `Field` component's `full` prop is
now just `sm:col-span-2`) for reliable, predictable alignment. Caught one
regression from this while auditing: `PersonForm.tsx`'s amber "Current
members" tip box relied on flexbox's `w-full` to force a line-wrap onto its
own row — in a grid, `w-full` only fills one column track, not the whole
row — added `sm:col-span-2` there directly so it still spans both columns.

**Not yet visually confirmed live** for the Directory/form-specific pieces
(same standing login constraint) — the token-level changes (contrast,
shadow, focus ring, reduced motion) were spot-checked via computed styles
and stylesheet inspection in-browser and read back exactly as set; `tsc`/
`eslint` are clean at the same established baseline throughout.

## Backend hardening pass (schema, actions, geocoding)

User asked for a deep-dive review of the database/backend and to implement
whatever was recommended. What changed:

**New migration `supabase/008_backend_hardening.sql`** (run after
`007_person_age.sql`) — **not yet confirmed run**, same as 002-007:
- **CHECK constraints** on every enum-like column that previously had none
  (`groups.status/life/day/format/freq`, `people.status/life/time_pref/days`)
  — the app's TypeScript union types gave zero runtime protection before
  this; real drift already happened once (003/006 had to clean up leftover
  "Matched"/"Unassigned"/"Active"/"Forming" values from an earlier scheme).
  Each `drop constraint if exists` first, so the migration is safe to re-run.
  **If it fails**, some rows still hold an old/invalid value — find them
  with `select distinct status from public.groups` (etc.) and reconcile
  before re-running.
- **Index on `people.group_id`** (a foreign key that had none — standard
  "always index your FKs" hygiene).
- **Dropped 4 dead columns on `groups`**: `x`/`y` (leftover design-mock map
  coordinates from before real geocoding existed) and `public_lat`/
  `public_lng` (only ever read by the `public_groups` view, which
  `002_lock_down.sql` already dropped when the app went fully-gated).
  Confirmed via a full codebase search that nothing read any of these four
  before removing them from `types.ts`/`data.ts`/`actions.ts`/`seed.ts` in
  the same pass.
- **Dropped the unused `join_requests` table** — its RLS policy existed but
  no application code ever queried it (the "Request to join"/"Message
  host" buttons that would have used it were removed earlier as permanent
  no-op stubs).

**Optimistic concurrency on saves.** `Group`/`Person` gained an
`updatedAt` field (from the `updated_at` column the DB trigger already
maintained but nothing previously read). `saveGroup`/`savePerson`
(`actions.ts`) now fetch the row's current `address`/`lat`/`lng`/
`updated_at` first: if `updated_at` doesn't match what the client last
loaded, the save is rejected with "someone else saved changes to this
record" instead of silently last-write-wins clobbering it. The save
actions return the new `updated_at`, and `GroupEditPage.tsx`/
`PersonEditPage.tsx` patch it into shared state on success — without that,
a *second* save in the same session would false-positive against its own
first save, since the client's in-memory baseline would otherwise never
move forward.

**Skip re-geocoding when the address hasn't changed.** Piggybacks on the
same pre-save row fetch above — re-geocoding unconditionally on every save
was a deliberate "simpler than diffing" choice at this app's volume, kept
as the fallback, but now skipped when the address string is unchanged and
already has a coordinate (a changed address, a brand-new record, or a
previously-failed geocode still retry immediately).

**Batched the geocoding backfill.** `backfillGroupLocations`/
`backfillPersonLocations` used to geocode one row at a time in a plain
sequential loop (up to ~920 rows for the full sample dataset — already
documented as "takes several minutes silently"). Both now share one
`backfillLocations()` helper that processes rows in batches of 15,
geocoding *and* writing each batch in parallel via `Promise.all` — cuts
wall-clock time roughly by the batch size, since the bottleneck is network
round-trips to Google, not the (fast, same-region) database writes.

**Geocoding failures are no longer silent.** `geocode.ts` now logs
(`console.error`) on an HTTP failure, a non-`OK`/non-`ZERO_RESULTS` API
status (with Google's own `error_message`), or a thrown error — enough to
tell "the API key/quota/billing is broken" apart from "this specific
address just doesn't exist," which previously looked identical. Never
logs the API key itself.

**`requireLeader()` renamed to `requireAuth()`**, with a comment explaining
why: it only ever checked "is there a valid session," not the actual
leader/admin role — the real role gate is RLS (`is_leader()` in
`schema.sql`), which already covers this. Not a security fix (every
signed-up user already defaults to `role='leader'`), just an accurate name
instead of one that overpromised what the function guards.

**`getBrowserSupabase()` is now a memoized singleton** (`client.ts`) —
previously created a new client on every call. Only one caller today (the
login page), so harmless in practice, but prevents Supabase's own "Multiple
GoTrueClient instances detected" footgun the moment a second client-side
caller is added.

**Explicitly not changed**, per the review that preceded this: the app
still fetches entire `groups`/`people` tables with no pagination or
server-side filtering. This is a real scaling ceiling if data volume ever
approaches the "3000+ attendee church" scale the sample dataset simulates,
but fixing it properly means reworking the shared-context architecture
this project deliberately built — flagged as a future consideration, not
executed unprompted. For the same reason, no indexes were added on
`status`/`area`/`life`/`day` — they'd be dead weight today since nothing
filters on them server-side yet. Adopting the Supabase CLI for migration
tracking (vs. plain numbered `.sql` files) was also left as a documented
recommendation rather than executed, since it's a tooling/workflow change
that needs the user's own environment setup, not a code change.

**Verification**: `tsc`/`eslint` clean at the same established baseline.
Confirmed live in-browser that the app still loads with zero console
errors after all of the above. **The migration itself is unrun** (same
standing constraint as every other migration in this project) and the
save/conflict/geocode-skip logic hasn't been exercised through a real
signed-in save yet — next person to pick this up should run migration 008
and then do one real save-edit-save cycle to confirm the concurrency check
behaves as expected before trusting it further.

## Product direction (from a Q&A pass with the project owner)

Asked the project owner a round of clarifying questions to surface gaps —
answers, so future sessions don't re-litigate them:
- **Still exploratory** — no committed launch date. Not mid-pilot with real
  coordinators yet.
- **Permissions stay flat** — every signed-in user keeps full access to
  every group/person. No host-only or admin-vs-coordinator tiering wanted.
- **Outreach stays manual** — no in-app automatic emails/notifications
  wanted (e.g. notifying a host or a person when a placement happens).
  Coordinators reach out themselves using the stored contact info.
- **Real data currently lives in Asana.** When this app eventually gets
  real data, it'll be a **bulk CSV import**, not one-by-one UI entry —
  worth remembering if/when an import tool gets built, since the source
  format to map from is an Asana export, not another ChMS's export.
- **Current priority is "keep adding/polishing features"** over stress-
  testing or deployment/infra work.

Two concrete features fell out of this pass and were built the same
session:

**Ranked "might still work" match suggestions (`Finder.tsx`).** The strict
match list and "matched on" toggle chips are untouched — this is additive.
A new collapsible section ("Show N more groups that might work",
collapsed by default) appears below the strict list whenever a person is
selected: every group that fails the strict filter gets scored by how many
of the *currently-active* matched-on criteria (day/city/life stage/age/
childcare — a toggled-off criterion never counts against it, same rule the
strict filter itself uses) it still satisfies, ranked highest-first, capped
at 6. Each suggestion (`SuggestedGroupCard`, a deliberately simpler sibling
of `GroupCard`) shows which criteria it met/missed as small check/x chips.
Selecting one reuses the same `selectedId` state as the strict list — the
selection-clearing effect and the travel-time batch fetch were both
extended to also recognize suggestions as "visible," and the map now
renders a suggestion's pin too if it's the one currently selected (via a
new `mapGroups` memo that unions `displayGroups` with just the selected
suggestion, not all of them, so the map doesn't get cluttered by default).

**PDF export on the Reports page.** An "Export PDF" button calls
`window.print()` rather than pulling in a PDF-generation dependency —
consistent with this app's "no new dependency, hand-build it" pattern
throughout. A print-only header (`hidden print:flex` on ReportsPage's own
root) shows "Connect TVC — Reports · Exported [date] at [time]"
(computed at render time, so re-exporting a stale tab still shows an
accurate stamp) — invisible on screen, only appears in the printed/PDF
output. `AppShell`'s header and top-level tabs get `print:hidden`; the
fixed-viewport `h-dvh`/`overflow-hidden` ancestor chain
((app)/layout.tsx's `<main>`, AppShell's root div, its children wrapper,
ReportsPage's own scroll container) all gained `print:h-auto
print:overflow-visible` (or `print:flex-none`) so the full report prints
instead of just whatever fit in the on-screen viewport. Also added a
`@media print` override in `globals.css` that forces light-theme token
values regardless of the viewer's current dark-mode state — printing a
dark-mode page as-is would either waste ink or (if the printer skips
background colors) leave dark text with nothing to contrast against.

**Not yet visually confirmed live** (same standing constraint) — verified
via `tsc`/`eslint` (clean, same baseline), a live reload with zero console
errors, and confirming the compiled stylesheet actually contains the
`@media print` rule with no syntax errors. The print layout specifically
(page breaks, whether every ancestor's `overflow`/`height` override was
enough to avoid clipping) needs an actual "Export PDF" click in a real
signed-in session to confirm.

## Map search/city filter: dropdown lookups, city now multiselect

User feedback: the browse-mode "Search groups or cities…" box gave no
visible feedback about what was actually matching, and asked for it (and
the City filter) to work like a dropdown lookup, the same idiom as the
"Finding for" person search — plus wanted City to support picking more
than one city at once.

**`GroupCitySearch`** (`Finder.tsx`) — the search input's typed value still
live-filters the list below exactly as before (unchanged), but now also
opens a dropdown of up to 6 matching city names and 6 matching group names
as you type (same click-to-jump idiom as `PersonSearch`), each tagged with
a small label so it's clear which is which. Picking a group selects it
(`setSelectedId`); picking a city adds it to the City filter and clears the
search box. Confirms city search already worked under the hood (`g.area`
was already part of the text-match haystack) — the actual gap was zero
visible feedback, not broken matching.

**City filter is now a searchable multiselect (`CityFilterPopover`).**
Replaced the plain single-select `<select>` with a popover — same trigger-
button idiom as the existing `DaysFilterPopover` (summary label, blue
border when active), but since there are up to ~39 cities (too many for a
flat pill list the way the 7 fixed days work), the popover itself has a
search box on top of the checkbox-style multi-toggle list. Browse-mode
state changed from a single `area: string` to `areas: Set<string>`,
mirroring the `days` pattern exactly — `filtered`'s city check is now
"matches any selected city" (OR), consistent with how the day filter
already worked. **Only touched the Map/Finder** — the Directory list
pages' simpler single-select city filter (`ListFilterBar`) was left alone,
since the request was specifically about "the Finding for section."

Not yet visually confirmed live (same standing constraint) — `tsc`/
`eslint` clean at the established baseline, confirmed on a **freshly
started** dev server (not a reused one) that the page loads with zero
console/server errors.

## Directory → Map: "Find for" deep link, and a Person-card cleanup

**"Find for" button** — a new way to jump straight from the Directory into
the Map's "Finding for" flow for a specific person, from either the People
list row or the person's edit page. Implementation:
- `PersonTable` (`tables.tsx`) gained a 5th column: a small "Find for"
  button per row (`e.stopPropagation()` so it doesn't also trigger the
  row's own click-to-edit) that navigates to `/?person=<id>`.
- `PersonEditPage.tsx`'s header gained the same button next to `BackLink`.
- `Finder.tsx` reads a `?person=` query param once on mount
  (`useSearchParams`) and, if it matches a real person, calls the exact
  same `setPersonId` used when picking someone from `PersonSearch` — so
  landing on the Map this way is indistinguishable from having searched
  for and selected that person there directly. Cleans the URL back to `/`
  afterward (`router.replace`) so a later refresh doesn't keep reapplying
  it. This route is already fully dynamic (the layout reads cookies for
  auth), so `useSearchParams` didn't need a `Suspense` wrapper here — see
  Next's own docs on the prerendering-vs-dynamic distinction if this ever
  moves to a statically-optimized route.

**Removed the duplicated status pill from the Person card
(`PersonForm.tsx`).** The header (avatar + name + "Group · X") used to
also show a colored `StatusPill` — redundant, since that same person's
status is already shown wherever they're looked up (the Finder's "Finding
for" bar/summary card, the People list row) — doubly so now that the new
"Find for" button makes that connection direct. The header is a single
child now, so the now-pointless `justify-between` came off its wrapper too.

Adds one new (expected, same-category) `react-hooks/set-state-in-effect`
lint finding for the `?person=` mount-read effect — this is the same
"sync from an external source once" pattern already accepted at 4 other
call sites in this codebase (`ThemeProvider`'s OS-preference read, three
in `Finder.tsx`), not a new category of issue. Baseline is now 11 problems
(9 errors, 2 warnings), up from 10.

Not yet visually confirmed live (same standing constraint) — `tsc` clean,
confirmed the app still loads with zero console errors both at `/` and at
`/?person=<id>` (redirects to `/login` either way, unauthenticated, but
proves the route doesn't error with the query param present).

## Lint cleanup: zero eslint problems (was an "accepted baseline" of ~10)

User pushback: previous rounds had been tracking a stable "baseline" of
~10 eslint problems (mostly `react-hooks/set-state-in-effect`, a couple of
`react/no-unescaped-entities`, two unused-var warnings) as accepted/
pre-existing rather than fixed. Told explicitly to actually resolve
everything, not document it as tolerated debt — did that, for real, not by
suppressing:

- **`react/no-unescaped-entities`** (`error.tsx`, `PersonForm.tsx`) —
  escaped the apostrophes/quotes (`&apos;`/`&quot;`). Mechanical.
- **Unused imports/props** — removed `FieldLabel` from `GroupForm.tsx`
  (dead import, still used elsewhere via `form-bits.tsx`) and the
  never-referenced `multi` prop from `ui.tsx`'s `DayPills` (only caller
  never passed it).
- **`ThemeProvider.tsx` rewritten on `useSyncExternalStore`** instead of
  `useState` + a mount effect that read `localStorage`/`matchMedia` and
  called `setTheme`. This wasn't a cosmetic change — `useSyncExternalStore`
  is the primitive React actually built for "external, browser-only store
  that differs between server and client": it takes a `getServerSnapshot`
  (returns `"light"`, matching `globals.css`'s pre-hydration default, so
  still zero flash) and synchronously swaps in the real client value right
  after hydration, natively, with no manual effect at all. Also fixes a
  latent same-tab bug the old version had: toggling only ever updated
  React state, not a shared store, so a second `useTheme()` consumer
  elsewhere in the tree wouldn't have picked up the change; `toggleTheme`
  now calls a small `notify()` over a shared listener set.
- **`Finder.tsx`'s 5 `set-state-in-effect` findings, each restructured
  individually** (not disabled):
  - The `?person=` deep-link now resolves **inside `personId`'s lazy
    `useState` initializer** — `searchParams` and `people` are both already
    available synchronously at first render on this fully-dynamic route,
    so there's nothing to do in an effect at all. The URL-cleanup
    (`router.replace("/")`) stayed in a tiny effect, but that effect calls
    no `setState` — `router.replace` is the only side effect it performs,
    which is what effects are actually for.
  - The person-change "matched on" reset and the "clear an invalid
    selection" logic were both converted to **React's documented
    render-time state-adjustment pattern** (calling `setState` directly in
    the render body, guarded by comparing against a tracked "previous
    value" — here `prevPersonId`, and a plain `stillVisible` check for the
    selection) instead of a `useEffect` — this is the exact pattern React's
    own docs recommend replacing "reset state when a prop changes" effects
    with, and it avoids the extra render an effect-based reset causes.
  - `travelTimes` is now **tagged with the person it was fetched for**
    (`{ personId, times }` instead of a bare `Record`), with an
    `effectiveTravelTimes` derived value that only exposes it when the tag
    matches the current person. This let the fetch effect drop its two
    synchronous "reset to `{}`" branches entirely (now a plain early
    `return`) while being *more* correct than before, not less — the old
    version could theoretically show a stale distance from a previous
    person if the new person had coordinates but zero of their matching
    groups did (an edge case the effect-reset version didn't actually
    cover); tagging closes that gap for free.

**Result: `npx eslint src` now exits 0 — zero errors, zero warnings.**
Confirmed on a freshly started dev server (not reused) with zero console
or server errors, and confirmed the light-mode CSS tokens still compute
correctly (`--ink` resolves to the dark-mode value under a
`prefers-color-scheme: dark` environment, as expected, entirely via CSS —
independent of `ThemeProvider`'s own state, which only drives the toggle
icon and the map's `colorScheme` prop). Not yet click-tested live (same
standing login constraint) — specifically, the actual "Find for" deep-link
flow and the theme toggle button both still need a real signed-in pass to
confirm end-to-end, though both were already reasoned through carefully
above and neither changed behavior from before, just *how* it's achieved.

## What's built and verified working

Everything below has been either live-tested through the actual UI/browser,
or verified via direct API calls bypassing the app code (to isolate "is this
my bug or a Google Cloud config issue" — this came up twice, see Known
Issues).

- Full Directory CRUD (groups + people): create, edit, delete (with confirm),
  validation (blank name, capacity < 1), save success/failure states that
  reflect the *actual* server result (this was a real bug, fixed).
- Supabase auth: password sign-in, admin-provisioned accounts, full RLS.
- Responsive layout: real full-viewport app (not a centered mockup card),
  desktop side-by-side Map columns, mobile list/map toggle, all verified via
  `resize_window` + computed-style checks. The Directory's list→edit flow is
  now real page navigation (see Directory-is-fully-routed above), so mobile
  "drill-down" is just normal browser back/forward — nothing bespoke to
  verify there anymore.
- Google Maps: interactive map renders (confirmed via the user's own browser
  — see Known Issues about why my own test browser can't verify this),
  custom teardrop pins with life-stage colors and 2-letter initials,
  DFW bounds restriction, anti-overlap pin spreading, person-silhouette pin
  with initials in the head.
- Geocoding on save (groups and people) — confirmed via direct API calls.
- Places autocomplete on address fields — confirmed end-to-end through the
  real UI (typed an address, got real suggestions, selection filled the
  field and resolved the city).
- Auto-populated area (from geocoded city) — code complete, needs one more
  live pass after the pending SQL migrations run.
- Travel-time routing (batched Routes API call) — confirmed end-to-end
  through the real UI ("12 min" badge appeared on a matching group's card).
- Searchable "Finding for" person picker with status pills shown both while
  searching and once selected — confirmed live (100+ people, typeahead
  works, status pill renders correctly in the dropdown, the compact
  "selected" chip, and the full summary card).
- Bulk DFW sample data (v2): 320 groups + 600 people, real addresses across
  39 DFW-metro cities concentrated toward where a real church would
  actually draw from, deliberately varied statuses/formats/dates/capacity,
  tuned so most people have multiple candidate group matches — file is
  ready (`005_sample_data_dfw.sql`) but not yet run against the live DB.
  Sized to roughly approximate a 3000+-attendee church's group ministry
  rather than just enough rows to click through the UI.
- Accessibility basics: every form label programmatically linked to its
  input (id/htmlFor), aria-pressed on toggle pills, aria-labels on
  icon-only controls.
- "Request to join"/"Message host" buttons removed (were permanently
  non-functional stubs).
- **UI polish round (code-complete, not yet click-tested live — see
  "What's pending" #3):**
  - Removed the "Coordinator" badge from the header; replaced with a live
    status summary (`AppShell.tsx`) — Groups total + Open count, People
    total + a combined New/Actively Searching/Waitlisted "needing
    placement" count. Hidden below the `md` breakpoint to avoid crowding
    the header on mobile.
  - Fixed a real bug in the "Finding for" day filter: `Finder.tsx`'s
    `DAY_FILTERS` array was hardcoded to `["All","Mon","Tue","Wed","Thu","Sun"]`
    — Friday and Saturday were never in the list at all, not a data issue.
  - The "Matched on" chips (day/city/life-stage toggles added in an earlier
    round) now gray out when excluded instead of showing a strikethrough.
  - Renamed "Co-leader" to "Mentor(s)" on the Group form's Leadership
    section — same underlying `coHost`/`co_host` field, just relabeled;
    Host(s) is understood to be whoever's actually in charge.
  - Added an Edit button to both the Group card and the "Finding for"
    person summary card on the Map tab, linking to
    `/directory/groups/:id` / `/directory/people/:id`. `BackLink`
    (`form-bits.tsx`) now uses `router.back()` instead of a fixed
    destination, so editing from the Map returns to the Map (with your
    edits already visible, since they patch shared context state directly)
    instead of always landing on the Directory list — falls back to a
    fixed URL only if there's no in-app history to go back to (e.g. the
    edit URL was opened directly).
  - Added a copy-to-clipboard button next to the contact email on an
    expanded Group card (`GroupCard.tsx`) — swaps to a checkmark for 1.5s
    on click as confirmation.

## What's pending — needs the user specifically

1. **Run the 6 outstanding SQL migrations** (002, 003, 004, 005, 006, 007)
   against the live Supabase database, **in that exact order** — 005 now
   depends on the column 004 adds, see Database Migrations above.
2. Geocoding now happens on its own after that — see "Placing new records
   on the map is now automatic" above — but it's still sequential, one
   Geocoding API call per row, so expect it to run silently for several
   minutes the first time the Directory is opened after those migrations
   (~920 records now: 320 groups + 600 people).
3. **Click through the new Directory routing** (`/directory/groups`,
   `/directory/people`, and clicking into a record) in a real logged-in
   session — this session's automated browser can't sign in (real
   Supabase auth is configured, and entering a password isn't something
   this assistant does), so the new routes/pages are verified via
   `tsc`/`eslint` and code review only, not click-tested live yet. This
   goes for everything built in this handoff's later rounds too: the
   status ribbon, the Edit buttons + back-navigation on the map cards, the
   email copy button, the Placement Details field, the Age/Childcare
   "matched on" chips, the "Show people" map layer, and — especially —
   **dark mode**: the light/dark toggle, the OS-preference auto-detection,
   and the Google Map's own `colorScheme` switch. The CSS-variable
   resolution itself was checked directly (computed style values confirmed
   correct in both directions), but the full visual result across every
   screen has not been eyeballed live. Same goes for the whole second
   feature batch (Reports tab, multiselect day pills, distance sort, the
   new pulsing pin halos, and the in-app delete confirmation modal) — all
   verified via `tsc`/`eslint` plus confirming `/reports` correctly redirects
   an unauthenticated session to `/login` with zero console errors, but not
   click-tested live in a signed-in session.
4. **Visually confirm in their own browser** (not the automated Claude
   Code test browser, which has a rendering quirk — see Known Issues):
   group pins show 2-letter initials, the person pin renders as a
   silhouette with initials in the head, the map is bounded to DFW, pins
   don't overlap, and — new — the map actually re-styles when the theme
   toggle is switched.
5. ~~Decide whether to keep or delete the original 5 fictional seed
   groups/people~~ — resolved: `005_sample_data_dfw.sql` now deletes them
   itself before inserting its own data, so running the migrations in order
   already replaces them. No separate decision needed.
6. Eventually: replace/supplement the ~920 sample DFW records with real
   Connect TVC data.

## Known issues / gotchas for whoever picks this up

- **The Google Map does not render interactively in this session's
  automated test browser** (Claude Code's embedded browser, an Electron
  app) — it silently falls back to a static image and
  `map.getRenderingType()` never leaves `UNINITIALIZED`. This was
  investigated extensively: proved via a raw non-React
  `new google.maps.Map()` call that it's *not* a bug in this app's code,
  and the user's own real browser has confirmed the map genuinely works.
  Current best guess is a referrer-header difference specific to that
  automated browser. **Don't burn time re-diagnosing this** — verify
  map-visual changes by asking the user to check in their own browser, or
  by checking the underlying data/props logic instead of pixels.
- **Next.js 16 broke assumptions from training data.** This project's
  `AGENTS.md` says to check `node_modules/next/dist/docs/` before writing
  Next-specific code. Concrete gotchas hit so far: `middleware.ts` →
  `proxy.ts`; `cookies()` is now async; error boundaries receive
  `unstable_retry`, not the old `reset`; Server Actions are reachable via
  direct POST bypassing your UI, so every action needs its own auth check.
- **`@vis.gl/react-google-maps` exports a component literally named `Map`**,
  which silently shadows JavaScript's built-in `Map` class if imported
  unqualified. This caused a real bug (`new Map()` in anti-overlap dedup
  logic resolving to the React component instead of the JS class). Always
  import it aliased: `import { Map as GoogleMap } from "@vis.gl/react-google-maps"`.
- **The classic `google.maps.places.Autocomplete` widget is unavailable**
  to any Google Cloud project created after March 2025 (this one was).
  Must use the current `AutocompleteSuggestion.fetchAutocompleteSuggestions()`
  API instead — already implemented in `AddressAutocomplete.tsx`.
- **"Places API (New)" is a separate API from core Maps JavaScript API**
  and needed its own enablement pass in Google Cloud Console — don't assume
  enabling one Maps product enables all of them. Same goes for Routes API.
- **Turbopack's dev cache can go stale after many rapid sequential file
  edits**, producing errors that reference already-fixed code. If
  `npm run build` (a full fresh build) passes cleanly but the dev server
  shows contradictory errors, it's almost certainly a stale `.next/` cache
  — delete it and restart, don't assume the code is broken.
- **The Claude Code browser tool's console-message buffer persists across
  `preview_stop`/`preview_start` cycles on the same tab** — if you restart
  the dev server many times while reusing one browser tab, old errors from
  before your fixes can resurface in `read_console_messages`. Open a fresh
  tab to get a true current-state read.
- **Never hold or request the Supabase service_role/secret key.** This
  project deliberately only uses the publishable key; RLS is the actual
  security boundary. If something seems to need elevated DB access, that's
  a sign to ask the user to run it themselves (as with the SQL migrations).

## Git history

```
804b733  Auto-derive area from address, DFW map bounds, pin/UX overhaul
c7e7d99  Add bulk DFW-area sample data for testing (25 groups, 100 people)
5e73f7f  Add person routing, map pin, new status lifecycle, shortened pin labels
3481856  Add Google Places autocomplete to the group address field
43f1e10  Add real Google Maps integration (Phase 3)
c29e145  Fix data-integrity, security-adjacent, and a11y issues from full review
1a600b6  Build Connect TVC: gated coordinator app with Supabase, Map + Console
61a7bba  Initial commit from Create Next App
```
Read the individual commit messages (`git log`) for detailed rationale on
each change — they're written to be self-explanatory.

## Not yet started / possible future phases

- Real "join request" workflow (the finder used to have "Request to join" /
  "Message host" buttons — they were removed since they never did anything;
  a real version would need a `join_requests` flow, which the schema has a
  table for but nothing uses yet).
- Self-service password reset (currently: admin resets via Supabase
  dashboard — an accepted limitation of the admin-provisioned-only model,
  not an oversight).
- Production deployment (this has only run in local dev so far).
