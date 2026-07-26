"use server";

import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { geocodeAddress, type GeoResult } from "@/lib/geocode";
import { getTravelTimes, type TravelTime } from "@/lib/routes";
import type { Group, Person } from "@/lib/types";

type SupabaseClient = NonNullable<Awaited<ReturnType<typeof getServerSupabase>>>;

// Map domain records back to DB rows (camelCase -> snake_case). `geo` (when
// present) overrides area/lat/lng with freshly-geocoded values — area is
// auto-derived from the address's city, never hand-picked, so a fresh
// geocode is always authoritative over whatever was already on the record.
function groupToRow(g: Group, geo?: GeoResult | null) {
  return {
    id: g.id,
    name: g.name,
    day: g.day,
    time: g.time,
    // No address means no city — only fall back to the existing area when
    // an address is present but this particular geocode attempt failed.
    area: g.address.trim() ? (geo?.city ?? g.area) : "",
    host: g.host,
    co_host: g.coHost,
    life: g.life,
    status: g.status,
    format: g.format,
    freq: g.freq,
    capacity: g.capacity,
    members: g.members,
    childcare: g.childcare,
    topic: g.topic,
    age_range: g.ageRange,
    start_date: g.startDate,
    contact_email: g.contactEmail,
    address: g.address,
    description: g.desc,
    placement_details: g.placementDetails,
    lat: geo ? geo.lat : (g.lat ?? null),
    lng: geo ? geo.lng : (g.lng ?? null),
  };
}

function personToRow(p: Person, geo?: GeoResult | null) {
  return {
    id: p.id,
    name: p.name,
    email: p.email,
    phone: p.phone,
    // No address means no city — only fall back to the existing area when
    // an address is present but this particular geocode attempt failed.
    area: p.address.trim() ? (geo?.city ?? p.area) : "",
    address: p.address,
    age: p.age,
    days: p.days,
    time_pref: p.timePref,
    life: p.life,
    interests: p.interests,
    childcare_needed: p.childcareNeeded,
    accessibility: p.accessibility,
    status: p.status,
    group_id: p.group,
    joined: p.joined,
    notes: p.notes,
    lat: geo ? geo.lat : (p.lat ?? null),
    lng: geo ? geo.lng : (p.lng ?? null),
  };
}

type ActionResult = { ok: boolean; error?: string; persisted: boolean; updatedAt?: string };

// Named for what it actually checks: is there a valid signed-in session.
// The real leader/admin role gate is RLS (`is_leader()` in schema.sql), on
// every policy for groups/people/join_requests — this is just the "reject
// direct POSTs from a signed-out client" layer server actions need on top
// of that, since actions are reachable regardless of what the UI shows.
async function requireAuth() {
  const supabase = await getServerSupabase();
  if (!supabase) return { supabase: null } as const; // seed mode: no-op
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase } as const;
}

type ExistingRow = { address: string; lat: number | null; lng: number | null; updated_at: string } | null;

async function loadExisting(
  supabase: SupabaseClient,
  table: "groups" | "people",
  id: string,
): Promise<ExistingRow> {
  const { data } = await supabase
    .from(table)
    .select("address, lat, lng, updated_at")
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
}

/** Null when there's no baseline to compare (a brand-new record, or the
 * client hasn't loaded one yet) or when it still matches. Otherwise, the
 * row was saved by someone else since this session last loaded it. */
function staleConflictError(existing: ExistingRow, clientUpdatedAt: string | undefined): string | null {
  if (!existing || !clientUpdatedAt) return null;
  if (existing.updated_at !== clientUpdatedAt) {
    return "Someone else saved changes to this record after you loaded it — reload the page to see the latest version before saving again.";
  }
  return null;
}

export async function saveGroup(group: Group): Promise<ActionResult> {
  const { supabase } = await requireAuth();
  if (!supabase) return { ok: true, persisted: false };

  const existing = await loadExisting(supabase, "groups", group.id);
  const conflict = staleConflictError(existing, group.updatedAt);
  if (conflict) return { ok: false, error: conflict, persisted: true };

  // Re-geocoding on every save regardless of whether the address actually
  // changed was a deliberate "simpler than diffing" choice at this app's
  // volume — skipping the API call when the address is unchanged (and
  // already has a coordinate) is a free win with no downside. A changed
  // address, a brand-new record, or a previously-failed geocode (still
  // null) all still trigger a fresh attempt.
  const addressChanged = !existing || existing.address !== group.address;
  const geo =
    group.address.trim() && (addressChanged || existing?.lat == null)
      ? await geocodeAddress(group.address)
      : null;

  const { data, error } = await supabase
    .from("groups")
    .upsert(groupToRow(group, geo))
    .select("updated_at")
    .single();
  if (error) return { ok: false, error: error.message, persisted: true };
  return { ok: true, persisted: true, updatedAt: data?.updated_at };
}

export async function savePerson(person: Person): Promise<ActionResult> {
  const { supabase } = await requireAuth();
  if (!supabase) return { ok: true, persisted: false };

  const existing = await loadExisting(supabase, "people", person.id);
  const conflict = staleConflictError(existing, person.updatedAt);
  if (conflict) return { ok: false, error: conflict, persisted: true };

  const addressChanged = !existing || existing.address !== person.address;
  const geo =
    person.address.trim() && (addressChanged || existing?.lat == null)
      ? await geocodeAddress(person.address)
      : null;

  const { data, error } = await supabase
    .from("people")
    .upsert(personToRow(person, geo))
    .select("updated_at")
    .single();
  if (error) return { ok: false, error: error.message, persisted: true };
  return { ok: true, persisted: true, updatedAt: data?.updated_at };
}

type GeoUpdate = { id: string; lat: number; lng: number; area?: string };

/**
 * Geocodes every row missing a coordinate in batches (parallel within each
 * batch, sequential across batches) rather than one row at a time — the
 * bottleneck is network round-trips to Google's Geocoding API, not the
 * (fast, same-region) database writes, so batching cuts wall-clock time by
 * roughly the batch size for a bulk-inserted dataset with hundreds of rows.
 */
async function backfillLocations(
  supabase: SupabaseClient,
  table: "groups" | "people",
): Promise<{ ok: boolean; error?: string; updated: GeoUpdate[] }> {
  const { data, error: fetchError } = await supabase
    .from(table)
    .select("id, address, lat, lng")
    .is("lat", null)
    .not("address", "eq", "");
  if (fetchError) return { ok: false, error: fetchError.message, updated: [] };

  const rows = data ?? [];
  const updated: GeoUpdate[] = [];
  const batchSize = 15;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (row) => {
        const geo = await geocodeAddress(row.address);
        if (!geo) return null;
        const { error } = await supabase
          .from(table)
          .update({ lat: geo.lat, lng: geo.lng, area: geo.city ?? undefined })
          .eq("id", row.id);
        if (error) return null;
        return { id: row.id, lat: geo.lat, lng: geo.lng, area: geo.city ?? undefined };
      }),
    );
    for (const r of results) if (r) updated.push(r);
  }
  return { ok: true, updated };
}

/** One-time helper for groups that already have an address but were created
 * before geocoding existed (e.g. bulk-inserted sample data) — geocodes and
 * saves every group missing coordinates. Safe to call repeatedly; it only
 * touches groups where lat/lng is still null. Called automatically (see
 * GroupsListPage.tsx) rather than from a manual button, so it returns the
 * actual updated rows — the caller patches its local state directly instead
 * of reloading the page. */
export async function backfillGroupLocations(): Promise<
  ActionResult & { updated: GeoUpdate[] }
> {
  const { supabase } = await requireAuth();
  if (!supabase) return { ok: true, persisted: false, updated: [] };
  const result = await backfillLocations(supabase, "groups");
  return { ok: result.ok, error: result.error, persisted: true, updated: result.updated };
}

/** Same idea as backfillGroupLocations, for people with an address but no
 * coordinates yet (e.g. bulk-inserted sample data, or rows saved before this
 * feature). Called automatically (see PeopleListPage.tsx). */
export async function backfillPersonLocations(): Promise<
  ActionResult & { updated: GeoUpdate[] }
> {
  const { supabase } = await requireAuth();
  if (!supabase) return { ok: true, persisted: false, updated: [] };
  const result = await backfillLocations(supabase, "people");
  return { ok: result.ok, error: result.error, persisted: true, updated: result.updated };
}

/** Drive time from a person's location to each of the given groups, in one
 * batched Routes API call. Read-only, but still auth-gated — server actions
 * are reachable via direct POST regardless of the UI, so this shouldn't
 * skip the same check every other action here makes. */
export async function getTravelTimesToGroups(
  origin: { lat: number; lng: number },
  groups: { id: string; lat: number; lng: number }[],
): Promise<Record<string, TravelTime>> {
  await requireAuth();
  return getTravelTimes(origin, groups);
}

export async function deleteGroup(id: string): Promise<ActionResult> {
  const { supabase } = await requireAuth();
  if (!supabase) return { ok: true, persisted: false };
  const { error } = await supabase.from("groups").delete().eq("id", id);
  if (error) return { ok: false, error: error.message, persisted: true };
  return { ok: true, persisted: true };
}

export async function deletePerson(id: string): Promise<ActionResult> {
  const { supabase } = await requireAuth();
  if (!supabase) return { ok: true, persisted: false };
  const { error } = await supabase.from("people").delete().eq("id", id);
  if (error) return { ok: false, error: error.message, persisted: true };
  return { ok: true, persisted: true };
}

export async function signOut() {
  const supabase = await getServerSupabase();
  if (supabase) await supabase.auth.signOut();
  redirect("/");
}
