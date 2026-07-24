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
2. **Console tab** — full CRUD for Home Groups and People (the individuals
   being placed into groups), with address autocomplete, geocoding, and
   status tracking.

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
- **Git:** real commit history exists (see Git History below). It was
  entirely uncommitted until a full review caught this — always commit
  meaningful chunks of work now.
- **No production deployment yet.** This only runs locally / in dev so far.

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
`AREAS`/`Area`.

**Groups and People are geocoded in parallel.** Both have `address`, `lat`,
`lng` columns and go through the same `AddressAutocomplete` component →
`geocodeAddress()` (`src/lib/geocode.ts`) → saved on `saveGroup`/`savePerson`.
A "Place N on map" backfill button exists on **both** Console tabs for
records that had an address before geocoding existed (or were bulk-inserted
via SQL) — loops one Geocoding API call per row, so bulk-backfilling ~130
records will take a minute or two.

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

```
src/
  app/
    actions.ts          — ALL server actions (save/delete/backfill/travel-times), each auth-gated
    error.tsx            — error boundary for data-fetch failures (uses Next 16's unstable_retry)
    layout.tsx            — root layout, fonts, metadata
    login/page.tsx         — email+password sign-in (only public route)
    page.tsx                — home page, fetches groups/people, renders AppShell
  components/
    AppShell.tsx            — top-level Map|Console tab shell, holds lifted groups/people state,
                               mounts <APIProvider> for Google Maps once (shared by both tabs)
    console/
      AddressAutocomplete.tsx — Places autocomplete input; on selection, resolves city via
                                 Place Details and fires onPlaceSelected for area auto-population
      Console.tsx              — Groups/People CRUD UI, save/delete/backfill logic, validation
      GroupForm.tsx / PersonForm.tsx — the actual edit forms
      form-bits.tsx            — shared Field/SectionHeading layout helpers
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
  seed.sql                       — original 5 groups + 5 people sample data
  002_lock_down.sql              — drops the leftover public-facing view; NOT CONFIRMED RUN
  003_person_geo_and_status.sql  — adds address/lat/lng to people, migrates status values; NOT CONFIRMED RUN
  004_sample_data_dfw.sql        — 25 more groups + 100 more people, real DFW addresses; NOT CONFIRMED RUN
```

## Database migrations — must run in this order

```
schema.sql  →  seed.sql  →  002_lock_down.sql  →  003_person_geo_and_status.sql  →  004_sample_data_dfw.sql
```

As of this handoff, **schema.sql and seed.sql have been run** (confirmed
earlier in the project). **002, 003, and 004 have NOT been confirmed run** —
this is the single most important pending action. After running them, click
**"Place N on map"** on both Console tabs to geocode everything (address →
lat/lng + area), since SQL inserts don't trigger the app's geocoding logic.

## Domain model summary

- **Group**: name, day, time, area (auto), host/co-host, life stage, status
  (Active/Forming/Paused/Full), format (In-person/Hybrid/Online), frequency,
  capacity/members, childcare, address (private), lat/lng, description, etc.
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

## What's built and verified working

Everything below has been either live-tested through the actual UI/browser,
or verified via direct API calls bypassing the app code (to isolate "is this
my bug or a Google Cloud config issue" — this came up twice, see Known
Issues).

- Full Console CRUD (groups + people): create, edit, delete (with confirm),
  validation (blank name, capacity < 1), save success/failure states that
  reflect the *actual* server result (this was a real bug, fixed).
- Supabase auth: password sign-in, admin-provisioned accounts, full RLS.
- Responsive layout: real full-viewport app (not a centered mockup card),
  desktop side-by-side columns, mobile list/map toggle + Console drill-down
  navigation, all verified via `resize_window` + computed-style checks.
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
- Bulk DFW sample data: 25 groups + 100 people, real addresses across ~25
  DFW-metro suburbs, deliberately varied statuses/formats/dates — file is
  ready (`004_sample_data_dfw.sql`) but not yet run against the live DB.
- Accessibility basics: every form label programmatically linked to its
  input (id/htmlFor), aria-pressed on toggle pills, aria-labels on
  icon-only controls.
- "Request to join"/"Message host" buttons removed (were permanently
  non-functional stubs).

## What's pending — needs the user specifically

1. **Run the 3 outstanding SQL migrations** (002, 003, 004) against the live
   Supabase database, in order — see Database Migrations above.
2. **Click "Place N on map"** on both Console tabs after the migrations run,
   to geocode all groups/people (this will take a couple minutes for ~130
   records — one Geocoding API call per row, sequential).
3. **Visually confirm in their own browser** (not the automated Claude
   Code test browser, which has a rendering quirk — see Known Issues):
   group pins show 2-letter initials, the person pin renders as a
   silhouette with initials in the head, the map is bounded to DFW, and
   pins don't overlap.
4. Decide whether to keep or delete the original 5 fictional seed groups/
   people now that there's abundant realistic DFW sample data.
5. Eventually: replace/supplement the 130 sample DFW records with real
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
