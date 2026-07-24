# Connect TVC — setup

A privacy-first, login-only home-groups coordinator app. Everything lives behind
one gated screen with **Map** and **Console** tabs. Runs **out of the box in demo
mode** (seed data, edits don't persist). Connect Supabase to make it real.

## Run it

```bash
npm run dev -- -p 3007
```

- `/` — gated app shell: **Map** (list + map, "Finding for" matcher) and
  **Console** (manage groups & people) tabs. Redirects to `/login` if signed out.
- `/login` — email + password sign-in. No self-signup.

## Phase 1–2: connect Supabase (you already have a project)

1. Copy env template and fill in your project's URL + publishable key
   (Supabase → Project Settings → API Keys → **Publishable key**):
   ```bash
   cp .env.local.example .env.local
   ```
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-PUBLISHABLE-KEY
   ```
2. In the Supabase **SQL editor**, run `supabase/schema.sql`, then
   `supabase/seed.sql`, then `supabase/002_lock_down.sql`.
3. Authentication → **Providers → Email**: turn **off** "Allow new users to
   sign up." Accounts are admin-provisioned only.
4. Authentication → **Users → Add user**: create each coordinator's account
   with an email + password, and check **Auto Confirm User**.
5. Restart `npm run dev`. The demo-mode banner disappears and edits persist.

> **Roles:** every new user gets a `profiles` row with role `leader` (invite-only
> assumption) via a trigger. RLS enforces that only leaders read People + exact
> addresses — anonymous requests get nothing (verified: `002_lock_down.sql`
> drops the public view and revokes anon grants entirely).

## Phase 3: Google Maps (when you're ready)

The map is currently a stylized placeholder in
`src/components/finder/FinderMap.tsx` with a clearly marked swap-in point.

1. Google Cloud → new project → enable billing.
2. Enable **Maps JavaScript API**, **Geocoding API**, **Routes API**.
3. Create two keys:
   - **Browser key** — restrict by HTTP referrer, Maps JS API only →
     `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`
   - **Server key** — restrict by IP + Geocoding/Routes only →
     `GOOGLE_MAPS_SERVER_KEY`
4. Set a **billing budget + alerts** and per-API quota caps.
5. Geocode addresses server-side on save (writes `lat/lng` + a jittered
   `public_lat/lng`); render `AdvancedMarkerElement` teardrop pins.

## Responsive layout

The app fills the full viewport (no centered "card" chrome) and adapts per
platform rather than just shrinking:

- **Desktop (≥768px):** Map tab shows list + map side by side; Console shows
  list + edit form side by side.
- **Mobile (<768px):** Map tab gets a **List / Map** segmented toggle instead
  of squeezing both into one screen. Console becomes drill-down navigation —
  tapping a row opens its edit form full-screen with a **← Back** button.
- Both top-level tabs (Map/Console) and both Console sub-views stay mounted,
  so in-progress edits survive switching around.

## Architecture notes

- **Data:** `src/lib/data.ts` (Supabase-or-seed reads), `src/app/actions.ts`
  (auth-gated writes). Types in `src/lib/types.ts`, colors in `src/lib/colors.ts`.
- **Auth:** `src/proxy.ts` gates every route except `/login`; email+password via
  `signInWithPassword`, no magic link, no self-signup.
- **Privacy:** since every viewer is an authenticated coordinator, the app
  reads full records (incl. addresses). If a public-facing surface is ever
  added later, don't reuse these gated queries — add a PII-free view (no
  address, fuzzed coordinates) the way the earlier `public_groups` view did.
