# Connect TVC — Project Status & Handoff

Last updated: 2026-08-03 · commit `7e4af87` (map polish round + fixes: legend, deselect-on-outside-click, show-people cycle, church marker (position corrected), `020`/`021_reassign_distant_addresses*.sql` — see "Map polish round" section below; per-criterion match checklist on group cards is pending commit, see "Per-criterion match checklist" section below)

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
    AppShell.tsx            — header (incl. AccountMenu, the name/avatar block) + Map|Directory|
                               Reports nav links + <DirectoryDataProvider>, mounts <APIProvider>
                               for Google Maps once for every routed page
    EditDisplayNameModal.tsx — lets a signed-in coordinator set their own display name; same
                               overlay/panel pattern as ConfirmDialog.tsx
    ConfirmDialog.tsx        — themed delete-confirmation modal (replaces window.confirm)
    reports/
      ReportsPage.tsx           — computes aggregates from groups/people, renders every report section
      charts.tsx                — hand-rolled, theme-aware chart primitives (no charting dependency)
    directory/                 — formerly "console"; renamed since "Directory" reads better to
                               coordinators than an internal-tooling word like "Console". Since
                               the Party/Person split, this is Groups + Parties (not "People") —
                               see that section below for the people -> parties rename.
      DirectoryData.tsx        — React context holding groups/parties/people + setters, so an edit
                                 on any route (list or detail) is instantly visible everywhere
                                 else, without keeping every page mounted at once
      DirectoryNav.tsx          — the "Home Groups | Parties" tab pills, as real <Link>s
      GroupsListPage.tsx / PartiesListPage.tsx — search/filter bar + table (used by the list
                                 routes). PartiesListPage's table also lists each individual
                                 member as its own clickable row under any party of 2+ — see the
                                 "Parties list now surfaces individual members" section below.
      GroupEditPage.tsx / PartyEditPage.tsx  — back link + form + <SaveBar> (used by the [id] routes)
      SaveBar.tsx               — shared sticky delete/save action bar
      tables.tsx                — GroupTable/PartyTable/EmptyState (D365-style list view)
      AddressAutocomplete.tsx — Places autocomplete input; on selection, resolves city via
                                 Place Details and fires onPlaceSelected for area auto-population
      GroupForm.tsx / PartyForm.tsx — the actual edit forms (each already renders its own header,
                                 so the edit pages stay thin). PartyForm.tsx's Members section
                                 edits linked Person rows inline (name/email/phone only — see
                                 Party/Person split below for why); Remove is disabled on a
                                 party's last remaining member (see the soft-delete section below).
      ContactLog.tsx            — append-only outreach history for a party, auto-attributed to
                                 the signed-in coordinator (see "New outreach/contact log" below)
      PlacementHistory.tsx      — read-only, auto-generated log of every group a party has been
                                 assigned to over time (see "Soft delete + placement history" below)
      EntityPicker.tsx          — generic searchable single-select combobox (extracted from the old
                                 one-off AssignedGroupPicker); drives "Assigned group" and every
                                 new "Assigned to" (coordinator) picker on both forms
      AdminFooter.tsx           — read-only "Created/Last updated, by whom" footer on Group/Party
                                 edit pages only (see "Coordinator identity..." below)
      form-bits.tsx            — shared Field/SectionHeading/BackLink layout helpers
    finder/
      Finder.tsx               — Map tab: filters, "Finding for" search, group list, travel-time fetch
      FinderMap.tsx            — the actual Google Map: DFW bounds, anti-overlap, group/person pins
      GroupCard.tsx            — individual group card in the list (collapsed/expanded)
      PartySearch.tsx         — typeahead party picker (matches by party name or any member's name)
    icons.tsx / ui.tsx       — shared SVG icons and styled primitives (TextInput, StatusPill, etc.)
  lib/
    auth.ts                — getViewerEmail()/getViewerIsLeader() helpers
    colors.ts               — oklch-based color system (life-stage hues, status hues)
    data.ts                  — getGroups/getParties/getPeople (Supabase-or-seed reads); parties
                                 and people reads filter out soft-deleted rows (deleted_at is null)
    geocode.ts                — server-only: address -> {lat, lng, city} via Geocoding API
    routes.ts                  — server-only: batched drive-time via Routes API computeRouteMatrix
    seed.ts                     — demo-mode fallback data (5 groups, 5 parties, 6 people, fictional)
    supabase/{client,server,config}.ts — Supabase client setup, demo-mode detection
    types.ts                     — all domain types (Group, Party, Person, ContactLogEntry,
                                 PlacementHistoryEntry, statuses, etc.)
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
                                 public_lng) + the unused join_requests table; CONFIRMED RUN
  009_couple_host_naming.sql     — renames the 320 sample groups' host/name to a married-couple
                                 convention + adds one example group (g321, "The Churns");
                                 NOT YET RUN — see the dependency note below, this one only
                                 does anything useful once 005 has actually run
  010_person_party_size.sql      — adds people.party_size (default 1) + people.partner_name, for
                                 couples/households searching together as one Person record;
                                 CONFIRMED RUN
  011_contact_log.sql            — new contact_log table (append-only outreach history per
                                 person, leader-only RLS); CONFIRMED RUN
  012_person_party_name.sql      — adds people.party_name, the connected/searchable name for a
                                 party of 2+ (e.g. "The Smiths"); CONFIRMED RUN
  013_party_split.sql            — the big one: introduces a real `parties` table and moves every
                                 matching/status/placement field off `people` onto it; `people`
                                 becomes just name/email/phone + a party_id link. Preserves any
                                 existing plain-text `partner_name` as a real second person row
                                 before dropping that column. NOT CONFIRMED RUN — see the new
                                 "Party/Person split" section below before running this one.
  014_bulk_sample_data.sql       — generated (not hand-written) by scripts/generate-sample-data.mjs;
                                 wipes groups/parties/people/contact_log and inserts 100 groups +
                                 350 parties (200 solo, 150 two-person) + 500 people. Requires
                                 013 already applied (needs the parties table). NOT CONFIRMED RUN
                                 — re-run the generator any time for a fresh random batch instead
                                 of reusing this exact file.
  015_soft_delete.sql            — adds deleted_at/deleted_by to parties + people; deleteParty/
                                 deletePerson now soft-delete (UPDATE, not DELETE) instead of
                                 permanently destroying real people's data on a misclick. NOT
                                 CONFIRMED RUN — see "Soft delete + placement history" below.
  016_placement_history.sql      — new placement_history table: an append-only log of every group
                                 a party has been assigned to over time, written automatically
                                 whenever saveParty() changes a party's group. Requires 013 (the
                                 parties table). CONFIRMED RUN.
  017_bulk_sample_data_v2.sql    — generated (not hand-written) by scripts/generate-sample-data.mjs;
                                 wipes placement_history/contact_log/people/parties/groups and
                                 inserts 125 groups + 500 parties (200 solo, 300 two-person couples
                                 sharing a surname) + 800 people, plus a realistic subset of
                                 contact_log/placement_history rows. Supersedes 014 (left in place
                                 as a historical record, not run again). Requires 013 and 016.
                                 See "Fresh sample data (v2): 125 groups, 500 parties, 800 people"
                                 below for the match-rate summary and generation approach.
  018_five_city_expansion.sql    — generated (not hand-written) by scripts/generate-city-expansion.mjs;
                                 PURELY ADDITIVE (no deletes) — adds 25 groups + 50 parties (20
                                 solo, 30 couples, 80 people) split evenly across 5 groups + 10
                                 parties in each of Flower Mound, Corinth, Coppell, Carrollton,
                                 and Grapevine. Continues the id sequence from 017 (g126-g150,
                                 p201-p220, cp301-cp330); new group names checked against 017's
                                 125 to guarantee no collisions. Requires 017 already run with its
                                 ids intact. See "Five-city expansion" below.
  019_assignments_display_names.sql — adds "leaders read all profiles" +
                                 "update own profile" RLS policies (profiles previously only
                                 allowed reading your own row, with no update policy at all), plus
                                 assigned_to (uuid FK to profiles, ON DELETE SET NULL) and
                                 created_by/updated_by (text snapshots) on both groups and parties.
                                 NOT CONFIRMED RUN. See "Coordinator identity, assignment,
                                 sort/filter, and audit trail" below.
  020_reassign_distant_addresses.sql — reassigns any group/party more than ~45mi
                                 (straight-line proxy for ~1.5hr drive) from the actual
                                 church (2101 Justin Rd, Flower Mound) to Southlake/Coppell/
                                 Flower Mound/Double Oak/Highland Village, resets lat/lng to
                                 null so the app's existing auto-backfill re-geocodes them.
                                 Data-cleanup script, not additive — safe to re-run but not
                                 idempotent-by-design. CONFIRMED RUN — but 45mi wasn't
                                 aggressive enough (see 021 below).
  021_reassign_distant_addresses_v2.sql — same script as 020, threshold lowered
                                 45mi -> 25mi after the project owner reported the map
                                 still showing too many groups clustered in south/
                                 southwest Arlington, Grand Prairie, Duncanville, and
                                 south Fort Worth post-020. Safe to run even though 020
                                 already ran — see its own header. NOT RUN.
```

## Database migrations — must run in this order

```
schema.sql  →  seed.sql  →  002_lock_down.sql  →  003_person_geo_and_status.sql  →  004_group_placement_details.sql  →  005_sample_data_dfw.sql  →  006_group_status_and_area_defaults.sql  →  007_person_age.sql  →  008_backend_hardening.sql  →  009_couple_host_naming.sql  →  010_person_party_size.sql  →  011_contact_log.sql  →  012_person_party_name.sql  →  013_party_split.sql  →  014_bulk_sample_data.sql (superseded, don't run)  →  015_soft_delete.sql  →  016_placement_history.sql  →  017_bulk_sample_data_v2.sql (optional)  →  018_five_city_expansion.sql (optional, additive)  →  019_assignments_display_names.sql  →  020_reassign_distant_addresses.sql (confirmed run, superseded by 021)  →  021_reassign_distant_addresses_v2.sql (optional cleanup, requires 017/018 already geocoded)
```

**Current live/production status: schema.sql, seed.sql, 002, 003, 004,
006, 007, 008, 010, 011, and 012 are all confirmed run. `005_sample_data_dfw.sql`
has deliberately never been run** — that's the explicit call the project
owner made when going live (see "Product direction" and the go-live section
above): production only has the original ~5+5 seed.sql rows, not the
320-group/600-person fake DFW dataset, and 005 stays unrun until real data
or a deliberate decision to demo with sample data. `013_party_split.sql`
must have been run at some point (015/016 both alter/depend on the
`parties` table and were confirmed run without error), though no session
explicitly logged running it — worth confirming directly in the Supabase
table editor next time this doc is updated, rather than assuming. `015_soft_delete.sql`
and `016_placement_history.sql` are **confirmed run** (2026-07-27).
`017_bulk_sample_data_v2.sql` has also been run (2026-07-27) — production
currently has the full 125-group/500-party/800-person v2 dataset live.
`018_five_city_expansion.sql` is a fresh, **purely additive** optional
batch (no deletes) — run it any time more sample households in those 5
specific cities are wanted; unlike 005/014/017 it never wipes existing
data, so it's lower-risk, but it still shouldn't be run once real
coordinator-entered data exists (it's still fictional sample data).
`019_assignments_display_names.sql` is **not yet confirmed run** — it adds
two new RLS policies on `profiles` plus `assigned_to`/`created_by`/
`updated_by` columns on `groups`/`parties`; the app code that depends on
it (the header display-name editor, every "Assigned to" field/column/
filter, and the new "Record info" footer) is already live in this commit,
so run this one promptly — those features will silently no-op or error
against a real Supabase project until it's applied. See "Coordinator
identity, assignment, sort/filter, and audit trail" below.
`020_reassign_distant_addresses.sql` is **confirmed run** (2026-08-03) —
but its 45mi threshold left a visible cluster in south/southwest Arlington,
Grand Prairie, Duncanville, and south Fort Worth, so `021_reassign_distant_addresses_v2.sql`
(same script, threshold lowered to 25mi) exists as a follow-up and is
**not yet run**. Neither is a schema change, so nothing in the app depends
on them; run 021 whenever the remaining far-flung sample-data addresses
are worth tidying up further. See "Map polish round" below for what they
do and why 45mi (then 25mi) was chosen.

**This directly affects `009_couple_host_naming.sql`: its 320 `UPDATE ...
WHERE id = 'gN'` statements target ids that only exist once 005 has been
run.** With 005 unrun, running 009 today would silently no-op all 320
updates (no matching rows) and only the final `INSERT` (the new "The
Churns" example, `g321`) would actually do anything. If the intent is to
see the full renamed sample dataset, run `005` immediately before `009`.
If it's just the one example group that's wanted right now, running 009
alone (without 005) is actually fine as-is.

007 is fine to run anytime after schema.sql technically, but it's listed
before 005 in the numbering only because its backfill is merely a no-op
until the sample-data rows it's backfilling actually exist — running it
before or after 005 is equally safe either way. Note the order matters
more than the numbers alone suggest elsewhere too: 005 (bulk sample data)
inserts a `placement_details` value on every group row, so it will fail
outright if 004 hasn't run first to add that column. After running them,
geocoding happens on its own — see "Placing new records on the map is now
automatic" below — since SQL inserts don't trigger the app's geocoding
logic on their own, but the Directory list pages now detect and backfill
any still-ungeocoded rows in the background the first time they're opened.

## Domain model summary

**Superseded for Person/matching by the "Party/Person split" section
further below** — `Person` no longer carries area/address/life stage/
status/etc.; that all moved to a new `Party` record. Left below as-is for
the Group half, which didn't change, and as a record of the model's
history for Person/status.

- **Group**: name, day, time, area (auto), host/co-host, life stage, status
  (**New**/**Open**/**Closed** — New=blue, Open=green, Closed=red; redesigned
  from an original 4-value Active/Forming/Paused/Full scheme), format
  (In-person/Hybrid/Online), frequency, capacity/members, childcare, address
  (private), lat/lng, description, etc.
- **Party** (was: Person): name/contact info now lives on the linked
  `Person` row(s) instead; the Party itself holds area (auto), address
  (private), lat/lng, available days, time preference, life stage,
  childcare needed, status, assigned group, notes — everything "Finding
  for" matches against, once per household regardless of member count.
- **Party status** (formerly Person status; redesigned from an original
  3-value Unassigned/Matched/Waitlisted scheme): **New** (blue) →
  **Actively Searching** (amber) → **Waitlisted** (orange) → **Grouped**
  (green). Colors use the same oklch-hue system as everything else
  (`src/lib/colors.ts`).
- Note: `groups.members` is a **manually-entered headcount**, deliberately
  *not* auto-derived from `parties` rows assigned to that group — `parties`
  only tracks households that went through the coordinator placement
  pipeline, not a group's full real-world roster (confirmed by the seed data:
  groups show 8–10 members while only 1–2 `parties` rows reference them).
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

## Post-launch round: Finder polish, group↔person sync, couple-host naming

First batch of feedback since going live. Five items:

1. **Removed the duplicate status pill from the Finder's "Finding for" summary
   card** (`Finder.tsx`) — it's already shown right above in `PersonSearch`'s
   compact "selected" view; this is a different spot than the Person-card
   fix from the earlier round (that one was `PersonForm.tsx`'s header, on
   the Directory page — this is the Map page's own summary card).
2. **`GroupCitySearch` now opens on focus/click** with a browsable list
   (up to 50 each) even before typing, same as `PersonSearch` — it
   previously required typing before showing anything at all. Added an
   All/Groups/Cities scope toggle (pill row at the top of the dropdown,
   defaults to All) to narrow which section(s) show.
3. **Assigning a Person's group now auto-sets status to "Grouped"; clearing
   it back to Unassigned auto-reverts to "Actively Searching"**
   (`PersonForm.tsx`) — both directions, still just a starting point,
   freely overridable via the Status field right above it.
4. **`GroupForm.tsx` gained an "Assigned people" section** — every Person
   whose `group` matches this group's id, shown as a clickable row (avatar,
   name, status pill) that jumps to that person's edit page. Required
   threading `people` down through `GroupEditPage.tsx` (previously only
   `PersonForm`/`PersonEditPage` needed it).
5. **New migration `supabase/009_couple_host_naming.sql`** — renames all
   320 existing sample groups to a "married-couple hosts" convention:
   `host` becomes `"<Male> <Surname> and <Female> <Surname>"`, `name`
   becomes `"The <PluralSurname>"` (correct pluralization: `s`/`x`/`z`/
   `ch`/`sh` endings get `"es"`, everything else — including names ending
   in `y`, e.g. "The Kennedys" not "Kennedies" — just gets `"s"`). Only
   `host`/`name` change; mentor, address, status, meeting day/time,
   capacity, etc. are untouched on the 320 existing rows. Also inserts one
   new example row (`g321`, "The Churns") using the exact fields given:
   Darren & Samantha Churn, 3200 Mason Ave Corinth TX 76210, Closed,
   Mondays 6:30 PM. Generated by a one-off Node script (not checked in,
   same convention as the original 005 generator) — confirmed all 320
   generated names are unique before writing the file. **User confirmed
   running this migration** shortly after it was written (whether `005`
   was also run first, making the 320 renames actually take effect rather
   than no-op, isn't confirmed either way — worth checking directly in
   the Directory if that matters).

Verified: `tsc` clean, `eslint` clean (0 problems, same as the post-cleanup
baseline), a full production build succeeds with the same route list as
before. Not yet click-tested live — same standing constraint.

**Hotfix, same round: `groups.co_host` renamed to `groups.mentor` directly
in the Supabase table editor** (the user's own action, a live schema
change on production — not something initiated through a migration file).
This would have broken every Group save in production (the deployed code
still referenced the old column name) until the app code caught up.
Renamed throughout: `types.ts` (`Group.coHost` → `Group.mentor`),
`data.ts`/`actions.ts` (the `co_host` ↔ `coHost` mapping), `GroupForm.tsx`,
`GroupsListPage.tsx`'s `blankGroup` factory, `seed.ts`, and every SQL file
that referenced the column (`schema.sql`, `seed.sql`,
`005_sample_data_dfw.sql`, `009_couple_host_naming.sql`) — kept for
consistency/any future run, even though `schema.sql`'s own `public_groups`
view referencing it is already dead code (dropped by `002_lock_down.sql`
regardless). Confirmed zero remaining `co_host`/`coHost` references
anywhere in the codebase (a historical mention in this doc's earlier
"Mentor(s)" section aside — that's an accurate record of what was true
*then*, not touched). Re-verified `tsc`/`eslint`/build clean after this fix
specifically, not just as part of the batch above.

## Map pin color + label update (life-stage-or-gray, surname-based shorthand)

Two changes to `FinderMap.tsx`, the second iterating on the first after
discussing the tradeoff directly with the user:

**Group pins: life-stage color while actionable, flat gray once Closed.**
First pass tried pure status-coloring (New/Open/Closed) to match the rest
of the app — but flagged to the user that with most groups landing on
"Open," that collapses the map to one dominant hue and makes individual
pins *harder* to tell apart while scanning, the opposite of the goal.
Landed instead on a split, new `groupPinColor()` in `colors.ts`: life-stage
color (the original 5-hue scheme) for New/Open groups — full
differentiation exactly where it's useful, i.e. the groups actually worth
comparing — and a flat, low-chroma gray (`oklch(0.65 0.02 250)`,
deliberately near-neutral so it reads as "muted" against every vivid
life-stage hue) for Closed groups, so the ones you can't place anyone in
recede at a glance without needing to click in. `GroupCard.tsx`'s own
life-stage stripe (a different, list-side component) untouched throughout.

**Person pins stay status-colored** (the "Finding for" `PersonPin` and the
"Show people" roster pins) — a deliberately different call than groups:
you're never looking at hundreds of person pins simultaneously needing
type-differentiation the way you are with groups, and "who in this roster
still needs placement" is genuinely the most useful thing status-color
can tell you there. `PersonPin` still reads as visually distinct from a
roster pin via its larger size, pulsing halo, and top z-index, not a
fixed color.

**Group pin shorthand now strips "The " and uses the surname's first two
letters.** Most groups are named "The `<Surname>`" as of
`009_couple_host_naming.sql` — the existing `initialsOf()` scheme (first
letter of first word + first letter of last word) collapsed almost all of
them to `"T"` + one letter, a 26-way collision across the whole dataset
(e.g. "The Bennetts" and "The Boyds" would've looked identical-ish at a
glance). New `groupPinLabel()` strips a leading "The " and uses the first
two letters of the last remaining word instead ("The Bennetts" → "BE",
"The Boyds" → "BO" — uppercased for visual consistency with every other
pin label, not mixed-case). Falls back to the ordinary `initialsOf()`
scheme for any group not using the "The X" convention.

Verified: `tsc`/`eslint` clean (0 problems), full production build
succeeds. Not yet visually confirmed live — same standing constraint.

## Hotfix: new/edited records weren't showing on the Map until a reload

User report: added a new Home Group (and separately a Person) with a real
address, and neither one appeared on the Map. Root cause found in
`actions.ts`, not a geocoding failure: `saveGroup`/`savePerson` correctly
geocode the address and write the resulting `area`/`lat`/`lng` to the
database — but only ever returned `updated_at` back to the caller. The
*database* row was right the whole time; the *page you were looking at*
never found out, since the Map reads from the shared in-memory
`DirectoryData` copy, which still held the old (empty) location until a
full reload re-fetched from the server.

Fixed by having both actions return the `area`/`lat`/`lng` they actually
wrote (reusing the row object already built for the upsert — no extra
DB round-trip), and having `GroupEditPage.tsx`/`PersonEditPage.tsx` patch
all three into shared state on success, the same way they already did for
`updatedAt`. A newly geocoded record now shows on the Map immediately
after saving, no reload needed.

Separately, this session also turned up two real Supabase gotchas worth
remembering for next time something "isn't found" that should exist:
- **A column added via a manual `ALTER TABLE`/table-editor edit doesn't
  always show up to the app right away** — PostgREST (the auto-generated
  REST API layer) caches the schema and can lag behind a direct DDL
  change. Fix: `NOTIFY pgrst, 'reload schema';` in the SQL Editor.
  `placement_details` hit exactly this ("Could not find the
  'placement_details' column... in the schema cache") — though in that
  specific case the real issue was simpler: `004_group_placement_details.sql`
  had never actually been run at all, so the column was genuinely missing,
  not just stale-cached. Confirmed now added and working.
- **`description` and `placement_details` are two separate, deliberately
  distinct columns**, not one renamed into the other — worth restating
  here since it came up as a real point of confusion. `description` is
  the group's public-facing blurb (`Group.desc`); `placement_details` is
  the separate practical-logistics field added later this session
  (`Group.placementDetails`, shown on the Finder card). Renaming one into
  the other would break whichever one got renamed away.

Verified: `tsc`/`eslint` clean (0 problems), full production build
succeeds. Not yet click-tested live with a real save — same standing
constraint — but the root cause (a plain missing return value) is
unambiguous, not a guess.

## Feature batch: spots-open coloring, group auto-close, group lookup, matching labels, party size, outreach log

Seven-item batch from the project owner, gathered via a clarifying-questions
pass on three open design calls (un-full revert behavior, outreach tracking
granularity, couples/household structure):

1. **`spotsBadge()` (`src/lib/colors.ts`) now takes the group's `status`.**
   "Spots open" is gray whenever the group is full *or* `Closed`; still
   green for Open/New with room. `SpotsPill` (`ui.tsx`) and `GroupCard.tsx`/
   `GroupForm.tsx` pass `status` through.
2. **A group auto-closes when it becomes full.** In `GroupForm.tsx`, editing
   "Max capacity" or "Current members" to make `capacity === members` also
   sets `status: "Closed"` in the same patch. Deliberately **does not**
   auto-revert if it later becomes un-full — by then it may be closed for
   an unrelated reason, so reopening stays a manual Status-field decision
   (same asymmetric-revert idiom as the Grouped/Actively-Searching sync).
3. **Assigned Group on the Person form is now a searchable dropdown**
   (`AssignedGroupPicker`, bottom of `PersonForm.tsx`) — same
   outside-click/Escape-close idiom as the Map's group/city search — plus a
   "View" button that navigates straight to that group's edit page once one
   is selected.
4. **Removed the stale amber tip that used to sit under Assigned Group** —
   no longer relevant, per the project owner.
5. **Matching-relevant fields are now labeled on both cards.** `FieldLabel`
   (`ui.tsx`) gained a `matching?: boolean` prop rendering a blue "Matching"
   pill (distinct from the existing amber `tag` pill); `Field`
   (`form-bits.tsx`) forwards it. Flagged fields: Group's Meeting day, City,
   Life stage, Age range, Childcare available; Person's Available days,
   Home city, Life stage, Age, Childcare needed.
6. **Party size / partner name, for couples/households searching together**
   (e.g. "John and Sarah, the Smiths" need 2 spots, searched as one unit).
   Deliberately **one `Person` record**, not two linked records — simpler,
   and a match only ever needs evaluating once per party. Added
   `Person.partySize` (number, default 1) and `Person.partnerName` (plain
   text), threaded through `types.ts` → `data.ts`'s `rowToPerson` →
   `actions.ts`'s `personToRow` → a new "Household" section in
   `PersonForm.tsx`. Migration: `supabase/010_person_party_size.sql`
   (`people.party_size int not null default 1`, `people.partner_name text`,
   plus a `party_size >= 1` check). Surfaced wherever a person's summary
   shows via a new `PartyTag` component (`ui.tsx`, "Party of N" pill, hidden
   when `partySize <= 1`): `PersonTable.tsx`, `PersonSearch.tsx` (both the
   selected chip and the dropdown rows), and Finder's "Finding for" summary
   card.
7. **New outreach/contact log, to avoid double-messaging people.** Chosen
   design: an **append-only log**, not a single overwritable
   "last contacted" field — entries are timestamped and
   auto-attributed to the signed-in coordinator server-side (via the
   existing `getViewerEmail()` helper), never hand-typed, so the log stays
   trustworthy across multiple coordinators working the same list.
   - Migration: `supabase/011_contact_log.sql` — new `contact_log` table
     (`person_id` FK on delete cascade, `contacted_by`, `note`,
     `created_at`, indexed on `person_id`), leader-only RLS matching the
     `groups`/`people` policy pattern.
   - New server actions in `actions.ts`: `getContactLog(personId)` (most
     recent first) and `addContactLogEntry(personId, note)` (auto-attributes
     `contacted_by`).
   - New `src/components/directory/ContactLog.tsx` — rendered under a new
     "Outreach" section at the bottom of `PersonForm.tsx`. Shows a
     "Last reached out ... by ... — 'note'" banner up top (the actual
     double-messaging safeguard — visible without scrolling the log), an
     add-entry row (optional note + "Log outreach" button), and the full
     history below. Fetch errors (e.g. migration not yet run) surface as an
     inline banner instead of an infinite spinner.

Migrations 010 and 011 have since been confirmed run against production.

Verified: `tsc`/`eslint` clean (0 problems), full production build
succeeds. Not yet click-tested live — same standing constraint.

## Party structure follow-up: a distinct "party name" for search

**Superseded by the "Party/Person split" section further below** — after
this round shipped, the project owner kept pushing on the couples/
households question and landed on a real linked-record model instead
(`Person.partyName`/`displayName`/`partyDetail` described here no longer
exist). Left in place as a record of how the thinking evolved.

Continued brainstorming with the project owner on couples/households
searching together (task 7 from the batch above): with everything living on
one master `Person` record, what should coordinators actually search for —
an individual's name, or the connected pair? Landed on: the party gets its
own explicit name, used as the primary search key and headline everywhere,
while `name`/`partnerName` stay individual-level detail. Confirmed
explicitly that matching itself should keep running off **one shared set of
criteria** for the whole party (age, life stage, days, city, childcare) —
not two individually-reconciled sets — which the existing architecture
already gave for free.

- **New `Person.partyName` field** (e.g. "The Smiths") — separate from
  `name` (the primary individual) and `partnerName` (the other individual).
  Migration: `supabase/012_person_party_name.sql`
  (`people.party_name text default ''`). Threaded through `types.ts` →
  `data.ts`'s `rowToPerson` → `actions.ts`'s `personToRow` → a new "Party
  name" field (full-width, tag "What shows up in search for a party of 2+")
  in `PersonForm.tsx`'s Household section.
- **Two new helpers in `types.ts`**: `displayName(person)` — returns
  `partyName` when `partySize > 1` and it's set, otherwise falls back to
  `name` — is now what's headlined and searched everywhere a person summary
  appears; `partyDetail(person)` — returns `"John Smith & Sarah Smith"` for
  a party of 2+ (null for a solo record) so the actual individuals are
  still visible right under the (possibly non-individual) display name.
- **Updated to use `displayName`/`partyDetail`** instead of raw `person.name`:
  `PersonForm.tsx` (header + avatar initials), `PersonTable.tsx` (name cell
  + a new subline showing `partyDetail`), `PersonSearch.tsx` (matching,
  sorting, the selected chip, and dropdown rows — search now also matches
  against `partnerName`), `Finder.tsx`'s "Finding for" summary card (adds a
  bold `partyDetail` line so it's unambiguous this is a party of 2 and who
  they are), `GroupForm.tsx`'s assigned-people roster, and `FinderMap.tsx`'s
  person-pin initials/title/tooltip (both the "Finding for" pin and the
  smaller status pins shown via "Show people").
- **`PeopleListPage.tsx`'s directory search** now matches against
  `displayName`, `name`, and `partnerName` together, so searching either
  "Smith" or "The Smiths" finds the same party record.

`012_person_party_name.sql` is **not yet confirmed run** — until it is,
`partyName` reads/writes as `""` and every display falls back to `name`,
same as before this round (no broken state, just no party name yet).

Verified: `tsc`/`eslint` clean (0 problems), full production build
succeeds. Not click-tested live — the app requires a real coordinator login
(no seed/demo fallback since Supabase is configured), so this round's UI
changes were verified by code review + the build pipeline only, same
standing constraint as every other round.

## Party/Person split: a real linked-record model for couples/households

The project owner kept pushing on the couples/households question from the
section above and landed somewhere structurally different: "a record for
the Party and then connect two person records to it... I could search for
'party or person'... find Will Grier and see he is associated with the
Griers party and the other person in his party." That's a real relational
model, not fields bolted onto one record — worth a design conversation
before touching code, since it's the third iteration on this same question
this session. Landed on, after weighing three options (universal Party vs.
Party-only-for-2+ vs. a primary/secondary Person with no new table) and the
project owner explicitly choosing the first: **every party gets a real
`Party` record, even a solo searcher (a "party of one")** — one model
everywhere, no branching in the app between "has a party" and "doesn't."

**New data model** (`src/lib/types.ts`):
- **`Party`** now holds everything that used to live on `Person` *except*
  name/email/phone: `partyName`, `area`, `address`, `lat`/`lng`, `days`,
  `timePref`, `life`, `age`, `interests`, `childcareNeeded`,
  `accessibility`, `status` (renamed `PartyStatus`/`PARTY_STATUSES`),
  `group`, `joined`, `notes`, `updatedAt`. No stored party size — it's
  **derived** as `members.length` (the actual count of linked `Person`
  rows), not a separate number that can drift from reality.
- **`Person`** is now just individual identity: `id`, `partyId` (FK, not
  null), `name`, `email`, `phone`, `updatedAt`. `partnerName`/`partySize`/
  `partyName` are gone from it entirely — superseded by real linked rows.
- **`displayName`/`partyDetail` replaced by `partyDisplayName(party,
  members)`/`partyMemberNames(members)`** — same idea (headline name, then
  a "who's actually in this party" subline), just operating on a party +
  its member list instead of one overloaded record.
- **`contact_log.party_id`** (renamed from `person_id`) — outreach is
  logged once per household regardless of which member you actually
  contacted, which was always the point of the log.

**Migration `supabase/013_party_split.sql`** — the biggest migration this
project has run: creates `parties`, backfills one party per existing person
(reusing each person's own `id` as its party's `id`, so `contact_log`'s
existing values keep working through a plain column rename), **preserves
any existing plain-text `partner_name` as a real second `people` row**
before dropping that column (otherwise a partner's name would just be
lost, not migrated), then drops the moved columns from `people` and adds
`people.party_id`. Also moves the CHECK constraints and the FK index from
`people` to `parties`. **Not yet confirmed run** — this one is a bigger
deal than prior migrations (real column drops), so check the Supabase
table editor after running it.

**App layer**: `data.ts` gained `getParties()`/`rowToParty` (mirrors
`getGroups`/`getPeople`); `getPeople()` now returns the slim shape.
`actions.ts` gained `saveParty`/`deleteParty` (same geocode-on-save pattern
as `saveGroup`, since Party now owns the address); `savePerson` got
*simpler* — no more geocoding, just a conflict check plus an upsert of
name/email/phone/party_id. `DirectoryData.tsx`'s shared context gained
`parties`/`setParties` alongside `groups`/`people`, fetched once in
`(app)/layout.tsx` the same way as everything else.

**Directory pages, renamed and restructured** (same `*ListPage`/
`*EditPage`/`*Form` pattern used for Groups):
- `PeopleListPage.tsx` → `PartiesListPage.tsx`, `PersonEditPage.tsx` →
  `PartyEditPage.tsx`, `PersonSearch.tsx` → `PartySearch.tsx`,
  `PersonTable` → `PartyTable` (in `tables.tsx`). Routes moved from
  `/directory/people/**` to `/directory/parties/**`; `DirectoryNav.tsx`'s
  tab is now "Parties"; the Finder's deep-link query param is now `?party=`.
- `PersonForm.tsx` → `PartyForm.tsx`: same Location/Fit/Assignment/Outreach
  sections as before (now reading `party.*`), but the old "Household"
  section (party size/partner name text fields) is replaced by a real
  **"Members" section** — a list of the party's linked `Person` rows
  (inline Name/Email/Phone), "+ Add member", and a per-row "Remove"
  (reusing the existing `ConfirmDialog`). A new member is staged locally
  (client-generated `new-<timestamp>` id, same idiom as "New Group") and
  only actually persisted when the page's single Save button is clicked —
  `PartyEditPage.tsx`'s `handleSave` calls `saveParty` and
  `Promise.all(members.map(savePerson))` together in one action. Removing
  an already-persisted member calls `deletePerson` immediately (confirmed),
  same as every other delete in this app; removing a not-yet-saved staged
  member just drops it from local state. "New party" now creates a blank
  Party **and** one blank linked Person in the same click, so it still
  lands you on an editable name field immediately.
- `PartySearch.tsx` matches a party by its own name *or* any member's
  name, landing on the party either way — the exact "find Will Grier, see
  he's part of the Griers party, see the other person in it" behavior
  asked for. Headline is `partyDisplayName`; the member-names subline is
  now always shown (not just when an explicit party name is set).

**Finder/Map**: `Finder.tsx`'s matching state (`personId`/`person` →
`partyId`/`party`) and every matching read (`days`, `area`, `life`, `age`,
`childcareNeeded`, `lat`/`lng` for drive times) now come from `Party`
instead of `Person` — the ranked "might still work" suggestions logic
itself didn't need to change, just its field source. `FinderMap.tsx`'s
`PersonPin`/`StatusPersonPin` are now `PartyPin`/`StatusPartyPin`, each
taking `{ party, members }` for initials/title/status-color.
`GroupForm.tsx`'s "Assigned people" roster is now "Assigned parties",
reading `parties.filter(pt => pt.group === group.id)`.

**Reports/AppShell**: `ReportsPage.tsx`'s per-status/childcare/life-stage/
city aggregates and `AppShell.tsx`'s header stats now iterate `parties`
instead of `people` (labels updated to match: "Total parties", "Parties
placed", etc.).

**Seed data** (`seed.ts`): `SEED_PARTIES` (5 parties) + a slim
`SEED_PEOPLE` (6 people) — the "John Smith / partnerName Sarah Smith /
partyName The Smiths" example from the prior round becomes one real party
("The Smiths") with two linked Person rows (John Smith, Sarah Smith).

Verified: `tsc`/`eslint` clean (0 problems), full production build
succeeds (routes confirm `/directory/parties` and `/directory/parties/[id]`
exist, old `/directory/people/**` is gone). Not click-tested live — same
standing login-gated constraint as every round this session.

## Parties list now surfaces individual members, not just households

Follow-up request after the Party/Person split shipped: browsing the
Directory only ever showed one row per Party — a party of 2+ collapsed to
a single row with member names as a small subline, with no way to click
directly on an individual or see their contact info without opening the
party's edit page first. Confirmed with the project owner (multi-question
pass): keep one unified list (not a separate People tab), show each
member of a 2+ party as its own clickable row (name + email/phone only,
no duplicated status/city columns since those live on the Party), and a
solo party still renders as just the one row — no redundant party-row +
member-row pair for a household of one.

- **`PartyTable`** (`tables.tsx`) now renders, for every party with 2+
  members, its existing aggregate row followed by one lightweight row per
  member — small avatar, name, and `email · phone` (or "No contact info on
  file"), indented and on a muted background so they read as nested under
  their party. Clicking a member row navigates to the same party edit page
  as clicking the party row itself (`/directory/parties/:id`), consistent
  with the confirmed design: editing always happens at the party level,
  since name/email/phone are the only fields that are actually
  per-member — everything else (address, availability, status, etc.) is
  shared and edited once for the whole household.
- **`PartiesListPage.tsx`**'s footer count now reads "X of Y parties · Z
  people" (summed member count across the currently filtered parties)
  instead of just a party count.

Confirmed the backend needed no changes for this — `parties`/`people`
already modeled exactly this shape (Party owns shared/matching fields,
Person is lean identity-only) per `013_party_split.sql`.

Verified: `tsc`/`eslint` clean, full production build succeeds. Not
click-tested live — same standing login-gated constraint.

## Soft delete + placement history

A follow-up architecture review (three questions: is the Party/Person
split still the right structure, what's missing vs. best practice, add
the gaps) surfaced two real, non-cosmetic gaps and one guard, all three
implemented:

1. **The last-member removal guard.** `PartyForm.tsx`'s member "Remove"
   was previously always clickable, even on a party's only member —
   confirming it would `deletePerson()` immediately (no Save-gate), while
   the "a party needs at least one member" check only ever ran on Save,
   leaving an orphaned, empty Party row in the database with no client-
   side way to prevent it. Now guarded **twice**: the Remove button is
   disabled (with an explanatory tooltip) on a party's last member in
   `PartyForm.tsx`, and `deletePerson()` (`actions.ts`) independently
   re-checks server-side (counting only non-deleted members) and rejects
   the delete if it would leave the party with zero — server-side because
   Server Actions are reachable via direct POST regardless of what the UI
   allows, same reasoning as every other auth check in this file.
2. **Soft delete for parties and people** (`015_soft_delete.sql`, **NOT
   CONFIRMED RUN**). `deleteParty`/`deletePerson` used to be permanent
   `DELETE`s — a misclick meant a real person's contact info and match
   history was gone with no recovery path. Both now add `deleted_at`/
   `deleted_by` columns and turn the delete into an `UPDATE` instead;
   `data.ts`'s `getParties`/`getPeople` filter `deleted_at is null` so
   soft-deleted rows disappear from every list exactly as before. Since
   the DB can no longer hard-cascade a soft delete, `deleteParty` now
   explicitly also soft-deletes every linked Person row itself, mirroring
   what `on delete cascade` used to do automatically. `contact_log` and
   `placement_history` rows are deliberately left untouched by a party
   delete — the party row itself still exists (just marked deleted), so
   its history stays intact right alongside it. Scoped to parties/people
   only, not groups — those are the tables holding real people's PII and
   placement history; groups stay a plain hard delete. **Recovery today
   is manual** (clear `deleted_at` directly in the Supabase table
   editor) — there's no in-app trash/restore view yet; a natural follow-on
   if it's ever actually needed, not built preemptively.
3. **Placement history** (`016_placement_history.sql`, **NOT CONFIRMED
   RUN**, depends on 013's `parties` table). `parties.group_id` only ever
   held the *current* assignment — no record that a party was ever in a
   *different* group before. New `placement_history` table: one row per
   assignment, `assigned_at`/`unassigned_at` (null while current),
   auto-attributed `assigned_by`, and a `group_name_snapshot` taken at
   assignment time (deliberately duplicated rather than only joined live
   through `group_id`) so the history stays readable even if that group
   is later renamed or deleted. Written automatically by a new
   `recordGroupChange()` helper (`actions.ts`), called from `saveParty()`
   whenever the saved `party.group` actually differs from what was
   already in the database — closes out the previously-open assignment
   (if any) and opens a new one (if the new group isn't null). Never
   hand-entered, same "auto-attributed, trustworthy" philosophy as the
   contact log. A history-write failure is caught and logged
   (`console.error`) rather than failing the party save itself — an
   audit-trail hiccup shouldn't block a real save. New read-only
   `PlacementHistory.tsx` component (mirrors `ContactLog.tsx`'s
   structure) renders the log under a new "Placement history" section in
   `PartyForm.tsx`, between Assignment and Outreach.

Explicitly scoped out, per the review that preceded this: no in-app
restore/trash UI for soft-deleted records, and no Reports-page
integration for placement history (e.g. "average time in a group") —
both reasonable follow-ons, neither built without being asked for.

Verified: `tsc`/`eslint` clean (0 problems), full production build
succeeds, confirmed a fresh page load has zero console errors. **Since
this doc was last updated, 015 and 016 have been confirmed run in
production** — the guard, soft-delete, and placement-history write paths
are live but still haven't had a real save/delete cycle click-tested in a
signed-in session.

## Fresh sample data (v2): 125 groups, 500 parties, 800 people

Requested a full scrub-and-regenerate of sample data at different, larger
numbers than the original DFW dataset — 125 Home Groups, 500 parties (300
of them two-person couples sharing a surname, 200 solo), 800 people total
— "a good example of what will actually be seen and how to use the
system." Extended `scripts/generate-sample-data.mjs` (the same generator
that produced `014_bulk_sample_data.sql`) rather than writing a one-off
SQL file by hand, and re-ran it to produce `017_bulk_sample_data_v2.sql`.

**Confirmed with the project owner up front:** "500 total unique parties
and people, 300 of which are parties with 2 people" meant 500 parties
total (300 couples + 200 solo → 800 Person rows), not 500 Person rows —
worth remembering if a future request uses similar phrasing, since the
two readings differ by 300 people.

**Match-rate tuning had to be pushed further than the original dataset.**
125 groups spread across 5 life stages is a meaningfully sparser pool
than the original 320-group dataset (roughly half the groups-to-parties
ratio), so the same tuning knobs that got that dataset to 16.8%
zero-match weren't enough here — a first pass at equivalent settings
landed at 45% zero-match. Iterated on three knobs together until landing
at a comparable **22.0% zero, 12.6% one, 65.4% two-or-more (avg 3.07, max
10)**:
- **Geography concentrated harder**: 4 primary DFW cities (Dallas, Fort
  Worth, Arlington, Plano) instead of the original 10, weighted 40:1
  against the long tail (was ~8:1) — see `CITY_POOL` in the generator.
- **Life stage skewed harder toward Families/Everyone** (8 of 13 weighted
  slots, up from 6 of 11).
- **Party day-availability widened to 4–6 days** (was 3–5 in the original
  dataset's own v1→v2 tuning pass), still drawn from the same
  weeknight-heavy weighting as group meeting days so the two stay
  correlated rather than independently random.

The exact match-rate distribution is computed by the generator itself and
written into `017_bulk_sample_data_v2.sql`'s own header comment, same
convention as the original `005_sample_data_dfw.sql`.

**New: the generator also seeds contact_log and placement_history rows**,
so those two features (both added earlier this session) have real demo
data to show instead of being empty on a fresh dataset — the request was
explicit about wanting "a good example of... how to use the system," and
an empty outreach log or placement history doesn't demonstrate either
feature exists:
- **~35% of parties** get 1–3 contact_log entries (outreach notes,
  attributed to one of 4 fictional coordinator emails, timestamped 1–180
  days ago).
- **Every currently-`Grouped` party** gets a "current" placement_history
  entry (its actual assigned group, `unassigned_at` null).
- **~15% of those** also get a closed-out prior entry for a *different*
  group, chronologically before the current one — so Placement History
  visibly shows a party that moved between groups, not just a single
  static assignment.
- **~10% of not-currently-grouped parties** get a closed-out prior entry
  even though they have no current group — a party that was placed once,
  left, and is back on the market.

**Group names are guaranteed unique** (125 real Home Groups need distinct
names) via picking surnames without replacement from a deduplicated,
~155-entry surname pool (`groupSurnames = shuffled(LAST_NAMES).slice(0,
NUM_GROUPS)`) — the original generator picked group surnames with plain
`rand()`, which would have produced duplicate "The Smiths"-style group
names well before reaching 125. Party/couple surnames still use plain
`rand()` freely (duplicates across different households are normal and
expected, unlike group names).

`014_bulk_sample_data.sql` is left in place as a historical record but
superseded — the migration order table above marks it "don't run."
`017_bulk_sample_data_v2.sql` **has since been run against production**
(2026-07-27, confirmed live in the app: header shows 125 Groups/500
Parties) — it's a destructive full reset (same `delete from ...`
convention as every prior bulk-sample migration), so any future re-run
should only happen when a fresh test batch is actually wanted, never once
real coordinator-entered data exists.

Verified: generated file's row counts spot-checked directly (125/500/800
across groups/parties/people, all row-count and semicolon-termination
sanity checks pass), all 125 group names confirmed unique via a direct
grep-for-duplicates pass on the output file, `tsc`/`eslint` clean.
Confirmed live in production after the user ran it — Directory, Reports,
and the Map all reflect the new counts correctly.

## Five-city expansion: 25 more groups, 50 more parties (additive, no deletes)

Follow-up request: add more Home Groups and Parties concentrated in five
specific DFW cities — Flower Mound, Corinth, Coppell, Carrollton, and
Grapevine — 5 groups and 10 parties (kept at the same 2:3 solo:couple
ratio as 017, so 4 solo + 6 couples) per city. Unlike every previous
bulk-sample migration, this one is explicitly **not** a wipe-and-replace —
confirmed directly with the user mid-build that it only adds rows,
never deletes anything already in production.

New script `scripts/generate-city-expansion.mjs` (checked in, parameterized
by city list + counts/city, so it's reusable for a future different set of
cities) writes `supabase/018_five_city_expansion.sql`:
- **Purely additive** — the output file contains only `insert` statements,
  no `delete from ...` at all, the first bulk-sample migration in this
  project to work that way.
- **Continues the existing id sequence** rather than starting over: reads
  017's own id range (groups g1-g125, solo parties p1-p200, couple
  parties cp1-cp300) and starts the new batch at g126/p201/cp301, so
  there's no risk of colliding with rows 017 already inserted.
- **Group names checked against 017's 125 existing names** before picking
  new ones — reads 017_bulk_sample_data_v2.sql back in, extracts every
  group name already used, and only draws new group surnames from what's
  left in the surname pool (topped up with ~24 extra surnames specifically
  so the remaining pool would comfortably cover the 25 newly needed,
  after 017 had already used 125 of the original ~155).
- Two of the five cities — **Corinth and Coppell — didn't exist anywhere
  in 017's dataset at all**; this migration is the first sample data to
  place anything there. (Flower Mound, Carrollton, and Grapevine were
  already present in 017's weighted city pool, so those three gain
  additional groups/parties alongside what's already there.)
- **Match-rate check is scoped honestly**: the header comment reports the
  new 25 groups vs. new 50 parties match rate on their own (40.0% zero,
  40.0% one, 20.0% two-or-more — thinner than 017's, since 5 groups per
  city is a much sparser pool than 017's 125 across 5 life stages) —
  explicitly *not* cross-checked against the existing 125/500 from 017,
  which would need parsing that entire file's contents. Once actually
  loaded into the app, real match results will be better than this
  isolated number suggests, since e.g. a Flower Mound party can also
  match against any pre-existing Flower Mound group from 017.

Verified: row counts confirmed exactly (25 groups/50 parties/80 people),
zero internal duplicate group names, zero collisions against 017's 125
existing names, id ranges confirmed contiguous and non-overlapping
(g126-g150/p201-p220/cp301-cp330), exactly 5 groups per city confirmed,
file terminates cleanly. Not yet run against the database — that's the
user's own action.

## Hotfix: the "missing a location" map banner didn't say which group

User report, found live in production (018 hadn't even been run yet — this
was one of the original 125 groups from 017 whose address genuinely
doesn't geocode): the Map's "1 group missing a location" banner
(`FinderMap.tsx`) only ever showed a count, with no way to tell which
group it was or do anything about it short of opening every group one by
one.

Fixed: the banner now names every group that's missing a location, and
each name is a clickable link (`router.push` to `/directory/groups/:id`)
straight to that group's edit page, so fixing a bad address is one click
away instead of a manual hunt. Changed `missing` (a bare count) to
`missingGroups` (the actual `Group[]`) so the name/id data was already
sitting right there — no new query needed.

Verified: `tsc`/`eslint` clean, full production build succeeds. Not
click-tested live — same standing login-gated constraint as the rest of
this project; the dev server also requires a real sign-in this session
couldn't perform, and the Browser pane wasn't displaying frames when
checked. The actual group with the bad address hasn't been identified or
fixed yet — that's the next step once this ships, using the new link.

## Coordinator identity, assignment, sort/filter, and audit trail

Five-part request, planned via plan mode (Explore + Plan agents) given the
scope — schema changes, a new RLS policy letting coordinators read each
other's profiles, and cross-cutting UI work. Confirmed up front with the
project owner: `assigned_to` is **organizational only, never an
access-control mechanism** — every leader still sees/edits everything,
consistent with this project's flat-permissions decision (see "Product
direction" above). All five build on the same new plumbing:

**Migration `supabase/019_assignments_display_names.sql`** (NOT CONFIRMED
RUN) — additive only, no drops. Adds two RLS policies on `profiles`
("leaders read all profiles" for select, "update own profile" for update
— previously a user could only read their *own* row and couldn't update
it at all) plus `assigned_to` (uuid FK to `profiles`, `on delete set
null`) and `created_by`/`updated_by` (text) on both `groups` and
`parties`. Noted directly in the migration file: the update-own-profile
policy has no column-level restriction, so it technically also lets a
user change their own `role` — accepted as low-risk since nothing in this
app is gated on `'admin'` vs `'leader'` today.

**Two deliberately different "who did this" patterns**, matching what
already existed: audit fields (`contact_log.contacted_by`,
`placement_history.assigned_by`, and the new `created_by`/`updated_by`)
stay **snapshot text** — the coordinator's display name *at the time of
the action*, written via a new `getViewerDisplayName()` helper
(`src/lib/auth.ts`, prefers `profiles.full_name`, falls back to email)
that replaced `getViewerEmail()` at all 4 existing snapshot-write call
sites in `actions.ts`. Renaming yourself later doesn't rewrite history.
`assigned_to`, in contrast, is a **live foreign key** — a "who currently
owns this" relationship resolved to a name at read time, so a rename
shows up everywhere immediately.

1. **Self-service display name.** Clicking the name or avatar in
   `AppShell.tsx`'s header (now a new `AccountMenu` sub-component) opens
   `EditDisplayNameModal.tsx` (same overlay pattern as `ConfirmDialog.tsx`).
   Saves via a new `updateOwnDisplayName()` action, relying entirely on
   the new RLS policy — no service-role bypass. `profiles` is now fetched
   once in `(app)/layout.tsx` (`getProfiles()`) and lives in
   `DirectoryData`'s shared context alongside groups/parties/people, same
   pattern as everything else, so the header updates instantly on save.
2. **Assigned To on Groups and Parties.** New field on both edit forms
   (`GroupForm.tsx` under Leadership, `PartyForm.tsx` under Assignment)
   via a generic `EntityPicker.tsx` — extracted from the old one-off
   `AssignedGroupPicker` in `PartyForm.tsx` (same searchable-combobox
   behavior, now reused for "pick a group" *and* "pick a coordinator").
   Both `GroupTable`/`PartyTable` (`tables.tsx`) gained a display-only
   "Assigned To" column — confirmed with the project owner this should
   **not** be inline-editable in the list, consistent with every other
   column (click the row to edit on the record page instead).
3. **Sort and filter every list column.** `tables.tsx` gained a shared
   `SortableHeader` — every real column in both tables is now clickable
   (chevron flips for asc/desc); Meeting Day sorts Mon→Sun via `DAYS`
   index rather than alphabetically. `ListFilterBar.tsx` gained one new
   optional `extraFilters` prop (an array of `{label, value, onChange,
   options}` descriptors) rather than a full genericization of the
   existing Status/Life/City selects — deliberately the lighter change,
   since only 2 pages consume this component and flattening the 3
   working, strongly-typed filters into untyped strings would cost type
   safety for no real benefit. Groups gained Day + Assigned To filters;
   Parties gained Assigned To (no per-party meeting day to filter on).
4. **Assign Parties to a Group from the Group's own page.** `GroupForm.tsx`'s
   previously read-only "Assigned parties" roster gained a search-to-add
   box (`AddPartyToGroup`, a local component — deliberately not
   `EntityPicker`, since this needs to stay open across multiple adds
   rather than collapsing to one persistent selection) and a Remove button
   per roster row. Both call new `assignParty`/`unassignParty` handlers in
   `GroupEditPage.tsx` that persist **immediately** via the real
   `saveParty()` action — not deferred to the Group page's own Save
   button, since this mutates a different record than the one being
   edited (same "immediate cross-record action" precedent as
   `PartyEditPage.tsx`'s `removeMember`). Going through the real
   `saveParty()` means `recordGroupChange()` fires automatically, so a
   `placement_history` entry is written for free — and the Grouped ⇄
   Actively Searching status auto-transition mirrors exactly what
   `PartyForm.tsx`'s own picker already does, so the result is identical
   regardless of which side initiates the assignment.
5. **"Record info" admin footer.** New `AdminFooter.tsx` — read-only,
   shows "Created [date] by [name]" / "Last updated [date] by [name]",
   omitting either line if its timestamp is missing (new record). Added
   to `GroupForm.tsx` and `PartyForm.tsx` only, per the project owner's
   explicit scoping — **not** added anywhere in the Person/Members UI,
   since People are edited inline within a Party's Members list and have
   no page of their own for a footer to live on.

`groupToRow`/`partyToRow` (`actions.ts`) now take a third `audit: {
actorName, isNew }` param: `updated_by` is always set, but `created_by` is
only included in the returned row object when `isNew` — Supabase's
`.upsert()` only touches columns present in the payload, so omitting
`created_by` on an update leaves whatever's already in the DB untouched
instead of overwriting it with the current saver's name every time.
`isNew` is just `existing === null`, already computed via the pre-existing
`loadExistingGeo()` conflict check, so no extra query was needed.
Deliberately **not** touched: `backfillGroupLocations`/
`backfillPartyLocations` don't stamp `updated_by` — those are automatic
geocode fill-ins, not a deliberate content edit by the viewing coordinator.

Verified: `tsc`/`eslint` clean, full production build succeeds, demo/no-
Supabase mode still boots (confirmed `SEED_GROUPS`/`SEED_PARTIES` compile
with the new required `assignedTo: null` field, and `getProfiles()`/
`getViewerProfile()` no-op to `[]`/`null` exactly like their existing
siblings). One real lint finding surfaced and was fixed properly (not
suppressed), consistent with this project's zero-eslint-problems standard:
`EditDisplayNameModal.tsx`'s "reset the input when the modal reopens"
logic was rewritten from a `useEffect` + `setState` into React's
documented render-time state-adjustment pattern (comparing against a
tracked `prevOpen`), the same fix already applied to several spots in
`Finder.tsx` in an earlier round. **Not click-tested live** — same
standing login-gated constraint as everything else in this project; this
round specifically still needs, once 019 is run: confirming the RLS
update policy actually lets a save through, confirming the "Assigned to"
picker/column/filter round-trips correctly, confirming Day sorts Mon→Sun
and not alphabetically, and confirming a Group-initiated party assignment
shows up correctly on that party's own Placement History.

**Follow-up, same round: timestamps are now pinned to Central time.** Every
date/time display in the app (outreach log, placement history, the new
record-info footer, the Reports PDF export header) called `toLocaleString`/
`toLocaleDateString` with no `timeZone` option, so each rendered in
whichever timezone the *viewer's own device* happened to be set to — a
coordinator in a different timezone than their teammates would see a
different "when" for the exact same event. New `src/lib/format.ts`
consolidates all 4 call sites into `formatDateTime()`/`formatDate()`/
`formatExportedAt()`, each hardcoded to `America/Chicago` (DST-aware, so
CDT in summer and CST in winter automatically) — this org only ever
operates in DFW, so every timestamp should read the same regardless of who
or where the viewer is. Every formatted date/time now also ends in " CT"
so it's visually unambiguous which zone is shown. Verified directly (not
just by reading the code): a known UTC timestamp in July resolved 5 hours
back (CDT) and the same clock time in January resolved 6 hours back (CST).

**Follow-up, same round: "Created On" added to both Directory lists, and
default sort confirmed as Name A→Z.** `GroupTable`/`PartyTable`
(`tables.tsx`) gained a `createdAt` sortable column (using the new
`formatDate()` from `src/lib/format.ts`), plus each list page's sort
comparator gained a matching `createdAt` case — ISO 8601 strings sort
correctly as plain strings, so no date parsing needed. A record that's
never been saved has no `createdAt` yet and sorts first, shown as "—" in
the column. Confirmed both list pages' default sort state was already
`sortField: "name"`, `sortDir: "asc"` from when sorting was first built —
no change needed there, just confirmed as the explicit, intentional
default per this request.

## Map polish round: legend, deselect-on-outside-click, show-people cycle, church marker, address cleanup SQL

Six-item batch from the project owner, delegated with "add these in the
order deemed best." Clarifying questions were asked up front on the three
genuinely ambiguous design calls (show-people scoping, SQL table scope, SQL
distance-threshold approximation) rather than guessing; the project owner
picked the recommended option on all three.

1. **Day-exclusion "matched on" logic — already correct, no change made.**
   The ask was: deactivating every day chip in "Matched on" should mean
   "any day works," not "no day works." Code review of `Finder.tsx`'s
   `filtered` (party-matched branch) found `if (activeDays.size > 0 &&
   !activeDays.has(g.day)) return false;` — when every day chip is
   deactivated, `activeDays.size` is 0, the whole clause short-circuits
   false, and the day criterion drops out of the filter entirely (matches
   any day). The `suggestions` scoring has the same guard. Verified this
   was already the shipped behavior (clean `git status`, nothing
   uncommitted) rather than assuming — flagging here so a future session
   doesn't re-litigate it.
2. **Life-stage color legend above the map.** New `LifeStageLegend()` in
   `FinderMap.tsx` — a centered, pointer-events-none pill overlay pinned to
   the top of the map (`absolute left-1/2 top-3 -translate-x-1/2`), one
   swatch (from `lifeColors(stage).solid`) + name per `LIFE_STAGES` entry.
   Deliberately excludes the Closed-group flat gray, since that's a status
   color, not a life stage. `pointer-events-none` so clicks in the gaps
   between legend pills still reach the map underneath (needed for #4).
3. **"Show people" is now a 4-state cycle on one button, not a boolean.**
   New `PeopleLayerMode` type (`"off" | "unassigned" | "assigned" |
   "all"`) and `nextPeopleLayerMode()` helper in `src/lib/types.ts`.
   `Finder.tsx`'s `peopleLayer` state replaces the old `showAllPeople`
   boolean; the single map button cycles off → unassigned → assigned → all
   → off on each click. Confirmed with the project owner: **global, not
   scoped to a selected group** — `statusParties` now reads `party.group
   === null` (unassigned) / `!== null` (assigned) / everyone (all) across
   the whole dataset, regardless of what's selected on the map. This
   replaces the old behavior where the toggle narrowed to just the
   selected group's roster.
4. **Clicking anything other than a group pin/card now deselects.** New
   `onDeselect` prop threaded through `FinderMap.tsx`: wired to the
   `<Map>` component's own `onClick` (background clicks — confirmed
   `@vis.gl/react-google-maps`'s `MapEventProps` exposes this, and that
   marker clicks don't bubble into it, so this doesn't fight with
   `GroupPin`'s own `onSelect`), plus `PartyPin`, `StatusPartyPin`, and the
   new `ChurchMarker` (#5) each gained an `onClick={onDeselect}`. On the
   list side, the scroll container in `Finder.tsx` gained an `onClick`
   that deselects unless the click lands inside `[data-card]` (added to
   `GroupCard.tsx` and the inline `SuggestedGroupCard`) or an interactive
   control (`button, a, input, select`) — checked via `closest()` rather
   than a bare `target === currentTarget` check, so it correctly catches
   clicks on padding/gaps regardless of DOM nesting, without swallowing
   clicks on things like the "show N more groups" toggle.
5. **Permanent "The Village Church" marker.** New `ChurchMarker` in
   `FinderMap.tsx` at the org's actual real-world meeting address — 2101
   Justin Rd, Flower Mound, TX 75028-3831. Renders the same `HomeMark`
   house glyph used in the header, scaled up. Always rendered (browse mode
   and "Finding for" mode alike); deliberately excluded from `fitPoints`
   so it's a fixed landmark that never pulls the auto-zoom toward it.
   **Coordinates were wrong in the initial version — see the corrected
   value and full story in the follow-up below** (a plain address geocode
   landed ~3-4mi off; the church marker now uses `lat 33.0704973, lng
   -97.0601721`, verified against the church's actual Google Place
   listing). Initial version also used 44px + a `boxShadow` ring; fixed in
   a follow-up (see below) after the project
   owner reported a visible white square around it.
6. **New `supabase/020_reassign_distant_addresses.sql`** — reassigns any
   Group or Party whose address is unreasonably far from the church closer
   to five towns near it (Southlake, Coppell, Flower Mound, Double Oak,
   Highland Village), confirmed in scope with the project owner: **both**
   `groups` and `parties`. Plain SQL can't call the Routes API for real
   drive time, so "more than 1.5 hours" is approximated with straight-line
   (haversine) distance from the church's coordinates — **45 miles**,
   the project owner's confirmed choice among the options offered (a
   deliberately conservative stand-in, since straight-line distance always
   undershoots real DFW driving distance/time). Flagged rows get a freshly
   generated address in one of the five towns (round-robin by id order,
   reusing the same street-name pool `generate-city-expansion.mjs` already
   uses) and have `lat`/`lng` reset to `null` — **not re-geocoded by the
   SQL itself**, since Postgres can't call Google's Geocoding API; this
   deliberately piggybacks on the app's existing auto-backfill
   (`backfillGroupLocations`/`backfillPartyLocations`, already triggered
   automatically on next Directory open) rather than building a new
   mechanism. Reports exactly how many rows it reassigned via `RAISE
   NOTICE` (using `GET DIAGNOSTICS ... row_count`, not a follow-up count
   query, so the number is scoped to just this run and doesn't conflate
   with any older, unrelated ungeocoded rows). Only rows that already have
   coordinates are considered — a row with no location yet is already
   surfaced separately by the Map's "missing a location" banner, out of
   scope here. **Not yet run** — same "the project owner runs it, not this
   assistant" convention as every prior migration/cleanup script in this
   project.

Verified: `tsc` and `eslint` both clean, full production build succeeds
(`npm run build`), dev server loads with zero console/server errors and
correctly redirects unauthenticated to `/login`. **Not click-tested live**
— same standing constraint as every round in this project: this app
requires a real Supabase sign-in, which this assistant can't perform.
Committed as `e7160c9` and pushed straight to `master` per the project
owner's standing push authorization.

**Follow-up, same round: church marker shape fix, and a second address-
reassignment pass.** Two pieces of feedback after the project owner
actually looked at the live map:

- **Church marker had a visible white square around it.** The `boxShadow:
  "... 0 0 0 3px #fff"` ring followed the SVG's rectangular *bounding box*,
  not the icon's own rounded shape (the rounding is baked into the SVG's
  `<rect rx="9">`, which `box-shadow` doesn't know about) — so it rendered
  as a literal square box around the icon rather than hugging its rounded
  corners. Switched to `filter: drop-shadow(...)` (follows the actual
  alpha shape, same pattern `PartyPin`/`StatusPartyPin` already use) and
  sized down 44px → 34px per the project owner's request. Pushed as
  `7217c83`.
- **"Too many home groups down south" — 020's 45mi threshold wasn't
  aggressive enough.** The project owner had already run `020` and could
  see the actual result: a cluster still sitting in south/southwest
  Arlington, Grand Prairie, Duncanville, and south Fort Worth — all
  roughly 25–35mi straight-line from the church, comfortably under 020's
  45mi cutoff even though that drive is realistically well over 1.5 hours
  in DFW traffic. Rather than edit the already-run `020` in place, wrote
  `supabase/021_reassign_distant_addresses_v2.sql` — same script, same
  target towns, threshold lowered to **25mi**. Confirmed with the project
  owner that lowering the threshold (vs. explicitly listing southern city
  names to sweep) was the preferred approach. **Not yet run.**
- **Church marker was genuinely in the wrong spot — found and fixed.** The
  project owner flagged "the village is not in the correct location on the
  map." First investigation pass (re-running the forward geocode, then
  reverse-geocoding the hardcoded coordinates back to an address) found
  both confirming `location_type: "ROOFTOP"` and the same formatted
  address, and was wrongly reported here as "verified correct" — that
  conclusion was wrong, and the mistake is worth naming: matching the
  *address string* isn't the same as matching the *actual named place*.
  The project owner then sent a screenshot of exactly where the pin
  rendered — a residential subdivision off Cross Timbers Rd, nowhere near
  a church campus — which prompted a different check: web search turned up
  The Village Church's actual verified listings (Yelp, Waze, Facebook, all
  agree), with Google Place ID `ChIJb9yJVYUyTIYRfKyLSizCkR4`. A
  `place_id`-based Geocoding API lookup (not an address-string lookup) for
  that exact place ID returned `types: ["church", "place_of_worship",
  "point_of_interest", ...]` and coordinates ~3-4 miles north of the
  original ones. **Root cause**: plain address-string geocoding can return
  `location_type: "ROOFTOP"` for a high-confidence point along that street
  and address-number range without it actually being the named business's
  own parcel — "ROOFTOP" is a precision tier, not a guarantee it found the
  specific POI you meant. A `place_id` lookup (once you have the right
  place ID from an independent source) is the more reliable check for a
  known real-world landmark. Corrected in both `FinderMap.tsx`'s
  `CHURCH_POSITION` (now `lat 33.0704973, lng -97.0601721`) and
  `021_reassign_distant_addresses_v2.sql`'s `church_lat`/`church_lng`
  (not yet run, so no bad data was written from the wrong anchor).
  `020_reassign_distant_addresses.sql` (already run) still has the old,
  slightly-off coordinates in its file — left as-is per this project's
  "never rewrite an already-run migration" convention; a ~3-4mi
  anchor-point error doesn't meaningfully change which rows clear a 45mi
  bar, so its already-reassigned rows don't need redoing.

**Follow-up, same round: the reassignment scripts also don't self-
geocode.** After running `020`, the project owner saw the Map's "missing a
location" banner (50 groups) plus the SQL's own summary query (50
groups/177 parties `rows_pending_regeocode`) and read that as an error.
It isn't one — it's the intended handoff documented in both scripts'
headers: the SQL can't call Google's Geocoding API, so it deliberately
resets `lat`/`lng` to `null` and leaves the actual re-geocoding to the
app's existing auto-backfill. The gap: that backfill only fires from
`GroupsListPage.tsx`/`PartiesListPage.tsx`'s own mount effects — the Map
page never triggers it. Clarified for the project owner: visit Directory →
Home Groups, then Directory → Parties, once each, to kick off
`backfillGroupLocations()`/`backfillPartyLocations()` in the background
(177 parties in batches of 15 will take a minute or two), then check the
Map again. No code change — this was a workflow/expectations gap, not a
bug.

## Per-criterion match checklist on group cards

Follow-up to a screenshot of the existing "might work" suggestion chips
(`✓ Families`, `✓ Age`, `✓ Childcare`, `✗ Double Oak`). The project owner
wanted two things, confirmed via clarifying questions before building:
this checklist shown on **every** match card, not just imperfect
suggestions (so a full/strict match visibly confirms "everything looks
good" too); and each chip's label upgraded to show the actual matched/
mismatched **value**, not just the bare criterion name — e.g. a Friday
match should read "Day: Friday" (green), and per the project owner's own
example, a childcare mismatch should read "No Childcare" (grey) rather
than a generic "Childcare" label with just the icon changing.

**New `src/lib/matchChecklist.ts`** — `buildMatchChecklist(party, group)`,
shared by both the strict list and the suggestions. Evaluates all 5
matching dimensions **independent of the "matched on" chips' active/
inactive toggle state** (a deliberate design choice, confirmed against the
project owner's "always visible, confirm everything looks good" intent —
this is a different, purely informational readout of the real facts, not
tied to which criteria currently narrow the search):
- **Day** — `Day: <group's day, spelled out>`, met if that day is in the
  party's stated availability. Omitted entirely if the party has no days
  on file (mirrors how the "matched on" chips already skip criteria the
  party hasn't stated).
- **City** — the group's own city name (bare, no "City:" prefix — kept
  consistent with the existing suggestion-chip style, which the project
  owner didn't ask to change), met on exact match. Now shows the group's
  *actual* city on a mismatch instead of just repeating the party's
  desired city (the old suggestion-chip behavor, which reused
  `party.area` as the label even when it didn't match — genuinely less
  informative, fixed here).
- **Life stage** — same treatment as City: the group's own life stage
  (bare label), same latent bug fixed (label now reflects the group's
  actual value, not just the party's request, on a mismatch).
- **Age** — `Age: <party's own age>` (the project owner's confirmed
  choice among three options — party's age vs. the group's accepted range
  vs. both) — same value shown either way, just green+check or grey+X.
  Omitted if the party has no age on file.
- **Childcare** — `Has Childcare` / `No Childcare` (not a "Field: Value"
  template — deliberately different phrasing per the project owner's own
  example, since "Childcare: No" reads worse than a direct statement).
  Omitted if the party doesn't need childcare.

**New shared `MatchChecklistRow` in `src/components/ui.tsx`** — the actual
chip-row renderer (green `oklch(0.95 0.06 150)` bg + check icon for a
match, `var(--divider)` bg + X icon + `var(--faint)` text for a mismatch),
used by both `GroupCard.tsx` (new `checklist` prop, rendered unconditionally
under the "Hosted by" line whenever a party is selected — not gated behind
the card being expanded/selected, per "always visible") and the inline
`SuggestedGroupCard` in `Finder.tsx` (replaced its old bespoke
`metKeys`/`missedKeys` inline chip JSX with the same shared component).

**Suggestion ranking/scoring is unchanged** — `Finder.tsx`'s `suggestions`
useMemo still scores and sorts candidates using only the currently-*active*
matched-on criteria (same as before this round), so which groups appear in
"might still work" and in what order didn't change. Only the *display*
per suggestion switched from the old active-criteria-only chip set to the
new full 5-criterion `buildMatchChecklist()` output, for the same "show
the complete picture" reasoning as the strict list.

Verified: `tsc`/`eslint` clean, full production build succeeds, dev
server loads with zero console/server errors. **Not yet click-tested
live** — same standing constraint as every round in this project. Not yet
committed as of this doc update — see the header line above.

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
