import { getServerSupabase } from "./supabase/server";
import { SEED_GROUPS, SEED_PARTIES, SEED_PEOPLE } from "./seed";
import type { Group, Party, Person, Profile } from "./types";

// ============================================================
// DB row <-> domain mappers (Postgres snake_case <-> camelCase)
// ============================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToGroup(r: any): Group {
  return {
    id: String(r.id),
    name: r.name,
    day: r.day,
    time: r.time,
    area: r.area,
    host: r.host ?? "",
    mentor: r.mentor ?? "—",
    life: r.life,
    status: r.status,
    format: r.format,
    freq: r.freq,
    capacity: r.capacity ?? 0,
    members: r.members ?? 0,
    childcare: !!r.childcare,
    topic: r.topic ?? "",
    ageRange: r.age_range ?? "",
    startDate: r.start_date ?? "",
    contactEmail: r.contact_email ?? "",
    address: r.address ?? "",
    desc: r.description ?? "",
    placementDetails: r.placement_details ?? "",
    lat: r.lat,
    lng: r.lng,
    assignedTo: r.assigned_to ? String(r.assigned_to) : null,
    updatedAt: r.updated_at,
    createdAt: r.created_at,
    createdBy: r.created_by ?? null,
    updatedBy: r.updated_by ?? null,
  };
}

export function rowToParty(r: any): Party {
  return {
    id: String(r.id),
    partyName: r.party_name ?? "",
    area: r.area,
    address: r.address ?? "",
    age: r.age ?? null,
    days: r.days ?? [],
    timePref: r.time_pref,
    life: r.life,
    interests: r.interests ?? "",
    childcareNeeded: !!r.childcare_needed,
    accessibility: r.accessibility ?? "—",
    status: r.status,
    group: r.group_id ? String(r.group_id) : null,
    joined: r.joined ?? "",
    notes: r.notes ?? "",
    lat: r.lat,
    lng: r.lng,
    assignedTo: r.assigned_to ? String(r.assigned_to) : null,
    updatedAt: r.updated_at,
    createdAt: r.created_at,
    createdBy: r.created_by ?? null,
    updatedBy: r.updated_by ?? null,
    deletedAt: r.deleted_at ?? null,
    deletedBy: r.deleted_by ?? null,
  };
}

export function rowToPerson(r: any): Person {
  return {
    id: String(r.id),
    partyId: String(r.party_id),
    name: r.name,
    email: r.email ?? "",
    phone: r.phone ?? "",
    updatedAt: r.updated_at,
  };
}

function rowToProfile(r: any): Profile {
  return {
    id: String(r.id),
    fullName: (r.full_name ?? "").trim() || "Unnamed coordinator",
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ============================================================
// Reads (server-only). Fall back to seed data when Supabase is
// not configured yet, so the app is viewable out of the box.
// ============================================================

// When Supabase isn't configured at all, seed data is the *expected*
// experience (demo mode). Once it IS configured, a failed query is a real
// problem (expired session, RLS misconfig, network) — never silently swap
// in fake seed data at that point, since a coordinator could mistake it for
// their real church's data. Let it throw; app/error.tsx shows a clear message.

export async function getGroups(): Promise<Group[]> {
  const supabase = await getServerSupabase();
  if (!supabase) return SEED_GROUPS;
  const { data, error } = await supabase
    .from("groups")
    .select("*")
    .order("name");
  if (error) throw new Error(`Couldn't load groups: ${error.message}`);
  return (data ?? []).map(rowToGroup);
}

export async function getParties(): Promise<Party[]> {
  const supabase = await getServerSupabase();
  if (!supabase) return SEED_PARTIES;
  const { data, error } = await supabase
    .from("parties")
    .select("*")
    .is("deleted_at", null)
    .order("party_name");
  if (error) throw new Error(`Couldn't load parties: ${error.message}`);
  return (data ?? []).map(rowToParty);
}

export async function getPeople(): Promise<Person[]> {
  const supabase = await getServerSupabase();
  if (!supabase) return SEED_PEOPLE;
  const { data, error } = await supabase
    .from("people")
    .select("*")
    .is("deleted_at", null)
    .order("name");
  if (error) throw new Error(`Couldn't load people: ${error.message}`);
  return (data ?? []).map(rowToPerson);
}

/** Every registered coordinator account — the source list for "Assigned
 * to" pickers/filters/columns. No seed-mode fallback needed: demo mode has
 * no auth at all, so an empty list is the correct "no coordinators exist
 * yet" state rather than fabricated data. */
export async function getProfiles(): Promise<Profile[]> {
  const supabase = await getServerSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .order("full_name");
  if (error) throw new Error(`Couldn't load coordinators: ${error.message}`);
  return (data ?? []).map(rowToProfile);
}
