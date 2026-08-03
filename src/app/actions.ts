"use server";

import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { getViewerDisplayName } from "@/lib/auth";
import { geocodeAddress, type GeoResult } from "@/lib/geocode";
import { getTravelTimes, type TravelTime } from "@/lib/routes";
import { rowToParty, rowToPerson } from "@/lib/data";
import type { ImportPartyRow } from "@/lib/importParties";
import type {
  ContactLogEntry,
  Group,
  GroupStatus,
  Party,
  PartyStatus,
  PlacementHistoryEntry,
  Person,
} from "@/lib/types";

type SupabaseClient = NonNullable<Awaited<ReturnType<typeof getServerSupabase>>>;

// Map domain records back to DB rows (camelCase -> snake_case). `geo` (when
// present) overrides area/lat/lng with freshly-geocoded values — area is
// auto-derived from the address's city, never hand-picked, so a fresh
// geocode is always authoritative over whatever was already on the record.
// `audit.actorName` stamps `updated_by` on every save; `created_by` is only
// included in the returned object when `audit.isNew` is true — Supabase's
// upsert() only touches columns present in the payload, so omitting
// `created_by` on an update leaves whatever value is already in the DB
// untouched instead of stomping it with the current saver's name.
type Audit = { actorName: string | null; isNew: boolean };

function groupToRow(g: Group, geo: GeoResult | null | undefined, audit: Audit) {
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
    assigned_to: g.assignedTo || null,
    updated_by: audit.actorName,
    ...(audit.isNew ? { created_by: audit.actorName } : {}),
  };
}

function partyToRow(p: Party, geo: GeoResult | null | undefined, audit: Audit) {
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
    assigned_to: p.assignedTo || null,
    updated_by: audit.actorName,
    ...(audit.isNew ? { created_by: audit.actorName } : {}),
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
  // Also populated by saveGroup/saveParty — the audit fields actually
  // written (created_by only differs from what the caller already had on
  // a brand-new record's first save), so the caller can patch its local
  // copy the same way it already does for updatedAt/area/lat/lng.
  createdAt?: string;
  createdBy?: string | null;
  updatedBy?: string | null;
};

// Named for what it actually checks: is there a valid signed-in session.
// The real leader/admin role gate is RLS (`is_leader()` in schema.sql), on
// every policy for groups/parties/people — this is just the "reject
// direct POSTs from a signed-out client" layer server actions need on top
// of that, since actions are reachable regardless of what the UI shows.
async function requireAuth() {
  const supabase = await getServerSupabase();
  if (!supabase) return { supabase: null, userId: null } as const; // seed mode: no-op
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, userId: user.id } as const;
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

async function loadExistingPartyGroup(supabase: SupabaseClient, id: string): Promise<string | null> {
  const { data } = await supabase.from("parties").select("group_id").eq("id", id).maybeSingle();
  return data?.group_id ?? null;
}

/** Appends to a party's placement history whenever its assigned group
 * actually changes — closes out the previously-open assignment (if any)
 * and opens a new one for the new group (if any). Auto-attributed to
 * whoever saved the change, same as the contact log. Never fails the
 * caller's save on its own error — logged instead, same convention as
 * geocode.ts's failure logging — a history-write hiccup shouldn't block a
 * real save. */
async function recordGroupChange(
  supabase: SupabaseClient,
  partyId: string,
  previousGroupId: string | null,
  newGroupId: string | null,
): Promise<void> {
  if (previousGroupId === newGroupId) return;
  try {
    const assignedBy = await getViewerDisplayName();
    const now = new Date().toISOString();

    if (previousGroupId) {
      await supabase
        .from("placement_history")
        .update({ unassigned_at: now })
        .eq("party_id", partyId)
        .is("unassigned_at", null);
    }
    if (newGroupId) {
      const { data: g } = await supabase.from("groups").select("name").eq("id", newGroupId).maybeSingle();
      await supabase.from("placement_history").insert({
        party_id: partyId,
        group_id: newGroupId,
        group_name_snapshot: g?.name ?? "",
        assigned_by: assignedBy,
        assigned_at: now,
      });
    }
  } catch (err) {
    console.error("Failed to record placement history:", err);
  }
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

  const actorName = await getViewerDisplayName();
  const row = groupToRow(group, geo, { actorName, isNew: existing === null });
  const { data, error } = await supabase
    .from("groups")
    .upsert(row)
    .select("updated_at, created_at, created_by, updated_by")
    .single();
  if (error) return { ok: false, error: error.message, persisted: true };
  return {
    ok: true,
    persisted: true,
    updatedAt: data?.updated_at,
    area: row.area,
    lat: row.lat,
    lng: row.lng,
    createdAt: data?.created_at,
    createdBy: data?.created_by,
    updatedBy: data?.updated_by,
  };
}

export async function saveParty(party: Party): Promise<ActionResult> {
  const { supabase } = await requireAuth();
  if (!supabase) return { ok: true, persisted: false };

  const existing = await loadExistingGeo(supabase, "parties", party.id);
  const conflict = staleConflictError(existing?.updated_at, party.updatedAt);
  if (conflict) return { ok: false, error: conflict, persisted: true };

  const previousGroupId = await loadExistingPartyGroup(supabase, party.id);

  const addressChanged = !existing || existing.address !== party.address;
  const geo =
    party.address.trim() && (addressChanged || existing?.lat == null)
      ? await geocodeAddress(party.address)
      : null;

  const actorName = await getViewerDisplayName();
  const row = partyToRow(party, geo, { actorName, isNew: existing === null });
  const { data, error } = await supabase
    .from("parties")
    .upsert(row)
    .select("updated_at, created_at, created_by, updated_by")
    .single();
  if (error) return { ok: false, error: error.message, persisted: true };

  await recordGroupChange(supabase, party.id, previousGroupId, party.group);

  return {
    ok: true,
    persisted: true,
    updatedAt: data?.updated_at,
    area: row.area,
    lat: row.lat,
    lng: row.lng,
    createdAt: data?.created_at,
    createdBy: data?.created_by,
    updatedBy: data?.updated_by,
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

/** Soft-deletes the party and, since the DB can no longer hard-cascade a
 * soft delete, every linked Person row too (mirroring what the old `on
 * delete cascade` used to do). contact_log and placement_history rows are
 * deliberately left alone — the party row itself still exists, just
 * marked deleted, so its history stays intact and recoverable alongside
 * it. See 015_soft_delete.sql for why this isn't a real DELETE anymore:
 * a misclick on a real person's record used to be unrecoverable. */
export async function deleteParty(id: string): Promise<ActionResult> {
  const { supabase } = await requireAuth();
  if (!supabase) return { ok: true, persisted: false };
  const deletedBy = await getViewerDisplayName();
  const deletedAt = new Date().toISOString();

  const { error } = await supabase
    .from("parties")
    .update({ deleted_at: deletedAt, deleted_by: deletedBy })
    .eq("id", id);
  if (error) return { ok: false, error: error.message, persisted: true };

  const { error: memberError } = await supabase
    .from("people")
    .update({ deleted_at: deletedAt, deleted_by: deletedBy })
    .eq("party_id", id);
  if (memberError) return { ok: false, error: memberError.message, persisted: true };

  return { ok: true, persisted: true };
}

/** Every soft-deleted party, plus its (also soft-deleted) members — the
 * data behind the "Recently deleted" restore view. Fetched on-demand
 * rather than loaded into the shared DirectoryData context at layout time
 * like the live groups/parties/people, since this is a rarely-visited
 * page and there's no reason to pay for it on every route. */
export async function getDeletedParties(): Promise<
  ActionResult & { parties: Party[]; people: Person[] }
> {
  const { supabase } = await requireAuth();
  if (!supabase) return { ok: true, persisted: false, parties: [], people: [] };

  const { data: partyRows, error: partyError } = await supabase
    .from("parties")
    .select("*")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });
  if (partyError) return { ok: false, error: partyError.message, persisted: true, parties: [], people: [] };

  const parties = (partyRows ?? []).map(rowToParty);
  if (parties.length === 0) return { ok: true, persisted: true, parties: [], people: [] };

  const { data: peopleRows, error: peopleError } = await supabase
    .from("people")
    .select("*")
    .in("party_id", parties.map((p) => p.id));
  if (peopleError) return { ok: false, error: peopleError.message, persisted: true, parties, people: [] };

  return { ok: true, persisted: true, parties, people: (peopleRows ?? []).map(rowToPerson) };
}

/** Undoes deleteParty() — clears deleted_at/deleted_by on the party and
 * every linked person, symmetric with how deleteParty() cascaded the
 * delete in the first place. Used by both the "Recently deleted" view and
 * the delete-undo toast, so a misclick is recoverable either right after
 * it happens or later from the trash. */
export async function restoreParty(id: string): Promise<ActionResult> {
  const { supabase } = await requireAuth();
  if (!supabase) return { ok: true, persisted: false };

  const { error } = await supabase
    .from("parties")
    .update({ deleted_at: null, deleted_by: null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message, persisted: true };

  const { error: memberError } = await supabase
    .from("people")
    .update({ deleted_at: null, deleted_by: null })
    .eq("party_id", id);
  if (memberError) return { ok: false, error: memberError.message, persisted: true };

  return { ok: true, persisted: true };
}

// ---------- Bulk actions (Directory list multi-select) ----------
//
// Deliberately plain field updates — no geocoding, no conflict/staleness
// check, no auto-transition side effects (e.g. the single-record capacity
// -> auto-close or group-assignment -> auto-status rules in
// GroupForm.tsx/PartyForm.tsx). A bulk status or assignment change is
// already an explicit, deliberate override across every selected row;
// re-running per-record business rules on top of it would fight the
// coordinator's own intent rather than help it. Still stamps updated_by
// on every touched row, same audit convention as every other write.

export async function bulkUpdateGroupStatus(ids: string[], status: GroupStatus): Promise<ActionResult> {
  const { supabase } = await requireAuth();
  if (!supabase) return { ok: true, persisted: false };
  const { error } = await supabase
    .from("groups")
    .update({ status, updated_by: await getViewerDisplayName() })
    .in("id", ids);
  if (error) return { ok: false, error: error.message, persisted: true };
  return { ok: true, persisted: true };
}

export async function bulkAssignGroups(ids: string[], assignedTo: string | null): Promise<ActionResult> {
  const { supabase } = await requireAuth();
  if (!supabase) return { ok: true, persisted: false };
  const { error } = await supabase
    .from("groups")
    .update({ assigned_to: assignedTo, updated_by: await getViewerDisplayName() })
    .in("id", ids);
  if (error) return { ok: false, error: error.message, persisted: true };
  return { ok: true, persisted: true };
}

export async function bulkUpdatePartyStatus(ids: string[], status: PartyStatus): Promise<ActionResult> {
  const { supabase } = await requireAuth();
  if (!supabase) return { ok: true, persisted: false };
  const { error } = await supabase
    .from("parties")
    .update({ status, updated_by: await getViewerDisplayName() })
    .in("id", ids);
  if (error) return { ok: false, error: error.message, persisted: true };
  return { ok: true, persisted: true };
}

export async function bulkAssignParties(ids: string[], assignedTo: string | null): Promise<ActionResult> {
  const { supabase } = await requireAuth();
  if (!supabase) return { ok: true, persisted: false };
  const { error } = await supabase
    .from("parties")
    .update({ assigned_to: assignedTo, updated_by: await getViewerDisplayName() })
    .in("id", ids);
  if (error) return { ok: false, error: error.message, persisted: true };
  return { ok: true, persisted: true };
}

/** Bulk CSV import — one Party (of one member) per row. Address is stored
 * as-is with `area`/`lat`/`lng` left blank/null on purpose: geocoding
 * hundreds of rows synchronously in one request would be slow and
 * expensive, so this deliberately piggybacks on the same auto-backfill
 * mechanism the sample-data SQL migrations already rely on
 * (backfillPartyLocations(), triggered automatically next time the
 * Parties list is opened) rather than building a second geocoding path.
 * Rows with no name at all are silently skipped (counted, not erronred) —
 * a coordinator reviewing an import doesn't need every blank spreadsheet
 * row treated as a failure. */
export async function bulkImportParties(rows: ImportPartyRow[]): Promise<
  ActionResult & { imported: number; skipped: number; parties: Party[]; people: Person[] }
> {
  const { supabase } = await requireAuth();
  if (!supabase) return { ok: true, persisted: false, imported: 0, skipped: 0, parties: [], people: [] };

  const valid = rows.filter((r) => r.name.trim());
  const skipped = rows.length - valid.length;
  if (valid.length === 0) return { ok: true, persisted: true, imported: 0, skipped, parties: [], people: [] };

  const actorName = await getViewerDisplayName();

  const { data: insertedParties, error: partyError } = await supabase
    .from("parties")
    .insert(
      valid.map((r) => ({
        party_name: r.partyName.trim(),
        area: "",
        address: r.address.trim(),
        age: r.age,
        days: r.days,
        time_pref: r.timePref,
        life: r.life,
        interests: "",
        childcare_needed: false,
        accessibility: "—",
        status: r.status,
        group_id: null,
        joined: "",
        notes: r.notes.trim(),
        created_by: actorName,
        updated_by: actorName,
      })),
    )
    .select("*");
  if (partyError) {
    return { ok: false, error: partyError.message, persisted: true, imported: 0, skipped, parties: [], people: [] };
  }

  const { data: insertedPeople, error: personError } = await supabase
    .from("people")
    .insert(
      valid.map((r, i) => ({
        party_id: insertedParties[i].id,
        name: r.name.trim(),
        email: r.email.trim(),
        phone: r.phone.trim(),
      })),
    )
    .select("*");
  if (personError) {
    // Parties are already committed at this point — roll them back rather
    // than leaving orphaned parties-with-no-members behind (which
    // deletePerson()'s "party needs at least one member" rule would
    // otherwise make impossible to clean up through the UI).
    await supabase.from("parties").delete().in("id", insertedParties.map((p) => p.id));
    return { ok: false, error: personError.message, persisted: true, imported: 0, skipped, parties: [], people: [] };
  }

  return {
    ok: true,
    persisted: true,
    imported: valid.length,
    skipped,
    parties: insertedParties.map(rowToParty),
    people: insertedPeople.map(rowToPerson),
  };
}

/** Removing a person is only ever "leave this party" — never "unlink and
 * keep them floating," since `people.party_id` is NOT NULL by design (see
 * 013_party_split.sql). So the last remaining (non-deleted) member of a
 * party can't be removed this way; the only valid way to get rid of a
 * party's last person is deleteParty(), which takes the whole party with
 * it. Checked server-side (not just hidden in the UI) since Server Actions
 * are reachable via direct POST regardless of what the UI allows.
 *
 * Soft-deleted, not hard-deleted (see 015_soft_delete.sql) — recoverable
 * by clearing deleted_at directly in the table editor if someone's removed
 * by mistake. */
export async function deletePerson(id: string): Promise<ActionResult> {
  const { supabase } = await requireAuth();
  if (!supabase) return { ok: true, persisted: false };

  const { data: person } = await supabase
    .from("people")
    .select("party_id")
    .eq("id", id)
    .maybeSingle();
  if (person) {
    const { count } = await supabase
      .from("people")
      .select("id", { count: "exact", head: true })
      .eq("party_id", person.party_id)
      .is("deleted_at", null);
    if ((count ?? 0) <= 1) {
      return {
        ok: false,
        persisted: true,
        error: "A party needs at least one member — delete the whole party instead of removing its last member.",
      };
    }
  }

  const { error } = await supabase
    .from("people")
    .update({ deleted_at: new Date().toISOString(), deleted_by: await getViewerDisplayName() })
    .eq("id", id);
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
  const contactedBy = await getViewerDisplayName();
  const { data, error } = await supabase
    .from("contact_log")
    .insert({ party_id: partyId, contacted_by: contactedBy, note })
    .select("id, party_id, contacted_by, note, created_at")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, entry: rowToContactLogEntry(data) };
}

function rowToPlacementHistoryEntry(r: {
  id: string;
  party_id: string;
  group_id: string | null;
  group_name_snapshot: string;
  assigned_at: string;
  assigned_by: string | null;
  unassigned_at: string | null;
}): PlacementHistoryEntry {
  return {
    id: r.id,
    partyId: r.party_id,
    groupId: r.group_id,
    groupName: r.group_name_snapshot,
    assignedAt: r.assigned_at,
    assignedBy: r.assigned_by,
    unassignedAt: r.unassigned_at,
  };
}

/** Most-recent-first group-assignment history for one party — written
 * automatically by saveParty()/recordGroupChange(), never hand-entered. */
export async function getPlacementHistory(partyId: string): Promise<PlacementHistoryEntry[]> {
  const { supabase } = await requireAuth();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("placement_history")
    .select("id, party_id, group_id, group_name_snapshot, assigned_at, assigned_by, unassigned_at")
    .eq("party_id", partyId)
    .order("assigned_at", { ascending: false });
  if (error) throw new Error(`Couldn't load placement history: ${error.message}`);
  return (data ?? []).map(rowToPlacementHistoryEntry);
}

/** Lets a signed-in coordinator set their own display name — shown in the
 * header and, going forward, in every outreach/placement-history/created-
 * updated-by attribution (see getViewerDisplayName()). Relies entirely on
 * the "update own profile" RLS policy (019_assignments_display_names.sql);
 * no service-role bypass, so this can only ever touch the caller's own row. */
export async function updateOwnDisplayName(
  fullName: string,
): Promise<{ ok: boolean; error?: string; fullName?: string }> {
  const { supabase, userId } = await requireAuth();
  if (!supabase) return { ok: true, fullName: fullName.trim() };
  if (!userId) return { ok: false, error: "Unauthorized" };

  const trimmed = fullName.trim();
  if (!trimmed) return { ok: false, error: "Display name can't be blank." };

  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: trimmed })
    .eq("id", userId)
    .select("full_name")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, fullName: data.full_name };
}

export async function signOut() {
  const supabase = await getServerSupabase();
  if (supabase) await supabase.auth.signOut();
  redirect("/");
}
