import { getServerSupabase } from "./supabase/server";
import { SEED_GROUPS, SEED_PEOPLE } from "./seed";
import type { Group, Person } from "./types";

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
    updatedAt: r.updated_at,
  };
}

function rowToPerson(r: any): Person {
  return {
    id: String(r.id),
    name: r.name,
    email: r.email ?? "",
    phone: r.phone ?? "",
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
    updatedAt: r.updated_at,
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

export async function getPeople(): Promise<Person[]> {
  const supabase = await getServerSupabase();
  if (!supabase) return SEED_PEOPLE;
  const { data, error } = await supabase
    .from("people")
    .select("*")
    .order("name");
  if (error) throw new Error(`Couldn't load people: ${error.message}`);
  return (data ?? []).map(rowToPerson);
}
