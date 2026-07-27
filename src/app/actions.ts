"use server";

import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { getViewerEmail } from "@/lib/auth";
import { geocodeAddress, type GeoResult } from "@/lib/geocode";
import { getTravelTimes, type TravelTime } from "@/lib/routes";
import type { ContactLogEntry, Group, Party, Person } from "@/lib/types";

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
    mentor: g.mentor,
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

function partyToRow(p: Party, geo?: GeoResult | null) {
  return {
    id: p.id,
    party_name: p.partyName,
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

function personToRow(p: Person) {
  return {
    id: p.id,
    party_id: p.partyId,
    name: p.name,
    email: p.email,
    phone: p.phone,
  };
}

type ActionResult = {
  ok: boolean;
  error?: string;
  persisted: boolean;
  updatedAt?: string;
  // Populated by saveGroup/saveParty on success — the geocoded (or
  // carried-forward) area/lat/lng actually written to the row, so the
  // caller can patch its own in-memory copy immediately instead of only
  // finding out on the next full page load.
  area?: string;
  lat?: number | null;
  lng?: number | null;
};

// Named for what it actually checks: is there a valid signed-in session.
// The real leader/admin role gate is RLS (`is_leader()` in schema.sql), on
// every policy for groups/parties/people — this is just the "reject
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

type ExistingGeoRow = { address: string; lat: number | null; lng: number | null; updated_at: string } | null;

async function loadExistingGeo(
  supabase: SupabaseClient,
  table: "groups" | "parties",
  id: string,
): Promise<ExistingGeoRow> {
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
function staleConflictError(
  existingUpdatedAt: string | null | undefined,
  clientUpdatedAt: string | undefined,
): string | null {
  if (!existingUpdatedAt || !clientUpdatedAt) return null;
  if (existingUpdatedAt !== clientUpdatedAt) {
    return "Someone else saved changes to this record after you loaded it — reload the page to see the latest version before saving again.";
  }
  return null;
}

export async function saveGroup(group: Group): Promise<ActionResult> {
  const { supabase } = await requireAuth();
  if (!supabase) return { ok: true, persisted: false };

  const existing = await loadExistingGeo(supabase, "groups", group.id);
  const conflict = staleConflictError(existing?.updated_at, group.updatedAt);
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

  const row = groupToRow(group, geo);
  const { data, error } = await supabase
    .from("groups")
    .upsert(row)
    .select("updated_at")
    .single();
  if (error) return { ok: false, error: error.message, persisted: true };
  return {
    ok: true,
    persisted: true,
    updatedAt: data?.updated_at,
    area: row.area,
    lat: row.lat,
    lng: row.lng,
  };
}

export async function saveParty(party: Party): Promise<ActionResult> {
  const { supabase } = await requireAuth();
  if (!supabase) return { ok: true, persisted: false };

  const existing = await loadExistingGeo(supabase, "parties", party.id);
  const conflict = staleConflictError(existing?.updated_at, party.updatedAt);
  if (conflict) return { ok: false, error: conflict, persisted: true };

  const addressChanged = !existing || existing.address !== party.address;
  const geo =
    party.address.trim() && (addressChanged || existing?.lat == null)
      ? await geocodeAddress(party.address)
      : null;

  const row = partyToRow(party, geo);
  const { data, error } = await supabase
    .from("parties")
    .upsert(row)
    .select("updated_at")
    .single();
  if (error) return { ok: false, error: error.message, persisted: true };
  return {
    ok: true,
    persisted: true,
    updatedAt: data?.updated_at,
    area: row.area,
    lat: row.lat,
    lng: row.lng,
  };
}

/** Person has no address/geo of its own (that lives on its Party) — just a
 * conflict check on `updated_at` plus an upsert of name/email/phone/party_id. */
export async function savePerson(person: Person): Promise<ActionResult> {
  const { supabase } = await requireAuth();
  if (!supabase) return { ok: true, persisted: false };

  const { data: existing } = await supabase
    .from("people")
    .select("updated_at")
    .eq("id", person.id)
    .maybeSingle();
  const conflict = staleConflictError(existing?.updated_at, person.updatedAt);
  if (conflict) return { ok: false, error: conflict, persisted: true };

  const { data, error } = await supabase
    .from("people")
    .upsert(personToRow(person))
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
  table: "groups" | "parties",
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

/** Same idea as backfillGroupLocations, for parties with an address but no
 * coordinates yet (e.g. bulk-inserted sample data, or rows saved before this
 * feature). Called automatically (see PartiesListPage.tsx). */
export async function backfillPartyLocations(): Promise<
  ActionResult & { updated: GeoUpdate[] }
> {
  const { supabase } = await requireAuth();
  if (!supabase) return { ok: true, persisted: false, updated: [] };
  const result = await backfillLocations(supabase, "parties");
  return { ok: result.ok, error: result.error, persisted: true, updated: result.updated };
}

/** Drive time from a party's location to each of the given groups, in one
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

/** Deletes the party and, via `on delete cascade`, every linked Person row
 * and contact_log entry with it — a party's members and outreach history
 * don't make sense to keep around once the party itself is gone. */
export async function deleteParty(id: string): Promise<ActionResult> {
  const { supabase } = await requireAuth();
  if (!supabase) return { ok: true, persisted: false };
  const { error } = await supabase.from("parties").delete().eq("id", id);
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

function rowToContactLogEntry(r: {
  id: string;
  party_id: string;
  contacted_by: string | null;
  note: string | null;
  created_at: string;
}): ContactLogEntry {
  return {
    id: r.id,
    partyId: r.party_id,
    contactedBy: r.contacted_by,
    note: r.note ?? "",
    createdAt: r.created_at,
  };
}

/** Most-recent-first outreach history for one party. */
export async function getContactLog(partyId: string): Promise<ContactLogEntry[]> {
  const { supabase } = await requireAuth();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("contact_log")
    .select("id, party_id, contacted_by, note, created_at")
    .eq("party_id", partyId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Couldn't load the contact log: ${error.message}`);
  return (data ?? []).map(rowToContactLogEntry);
}

/** Appends a new outreach entry, auto-attributed to the signed-in
 * coordinator — never manually typed, so the log stays trustworthy for
 * "has anyone already reached out to this party" decisions, regardless of
 * which member you actually contacted. */
export async function addContactLogEntry(
  partyId: string,
  note: string,
): Promise<{ ok: boolean; error?: string; entry?: ContactLogEntry }> {
  const { supabase } = await requireAuth();
  if (!supabase) return { ok: true };
  const contactedBy = await getViewerEmail();
  const { data, error } = await supabase
    .from("contact_log")
    .insert({ party_id: partyId, contacted_by: contactedBy, note })
    .select("id, party_id, contacted_by, note, created_at")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, entry: rowToContactLogEntry(data) };
}

export async function signOut() {
  const supabase = await getServerSupabase();
  if (supabase) await supabase.auth.signOut();
  redirect("/");
}
