"use server";

import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { geocodeAddress } from "@/lib/geocode";
import type { Group, Person } from "@/lib/types";

// Map domain records back to DB rows (camelCase -> snake_case).
function groupToRow(g: Group, geo?: { lat: number; lng: number } | null) {
  return {
    id: g.id,
    name: g.name,
    day: g.day,
    time: g.time,
    area: g.area,
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
    lat: geo ? geo.lat : (g.lat ?? null),
    lng: geo ? geo.lng : (g.lng ?? null),
    x: g.x ?? null,
    y: g.y ?? null,
  };
}

function personToRow(p: Person) {
  return {
    id: p.id,
    name: p.name,
    email: p.email,
    phone: p.phone,
    area: p.area,
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
  };
}

type ActionResult = { ok: boolean; error?: string; persisted: boolean };

async function requireLeader() {
  const supabase = await getServerSupabase();
  if (!supabase) return { supabase: null } as const; // seed mode: no-op
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase } as const;
}

export async function saveGroup(group: Group): Promise<ActionResult> {
  const { supabase } = await requireLeader();
  if (!supabase) return { ok: true, persisted: false };

  // Re-geocode on every save when there's an address. At this app's real
  // usage volume (a coordinator saving a handful of groups) this is well
  // inside the free tier, and always-fresh is simpler and more reliable
  // than diffing against the stored address to decide whether to call it.
  const geo = group.address.trim()
    ? await geocodeAddress(group.address)
    : null;

  const { error } = await supabase.from("groups").upsert(groupToRow(group, geo));
  if (error) return { ok: false, error: error.message, persisted: true };
  return { ok: true, persisted: true };
}

/**
 * One-time helper for groups that already have an address but were created
 * before geocoding existed (e.g. the original seed data) — geocodes and
 * saves every group missing coordinates. Safe to call repeatedly; it only
 * touches groups where lat/lng is still null.
 */
export async function backfillGroupLocations(): Promise<
  ActionResult & { updated: number }
> {
  const { supabase } = await requireLeader();
  if (!supabase) return { ok: true, persisted: false, updated: 0 };

  const { data, error: fetchError } = await supabase
    .from("groups")
    .select("id, address, lat, lng")
    .is("lat", null)
    .not("address", "eq", "");
  if (fetchError) {
    return { ok: false, error: fetchError.message, persisted: true, updated: 0 };
  }

  let updated = 0;
  for (const row of data ?? []) {
    const geo = await geocodeAddress(row.address);
    if (!geo) continue;
    const { error } = await supabase
      .from("groups")
      .update({ lat: geo.lat, lng: geo.lng })
      .eq("id", row.id);
    if (!error) updated += 1;
  }

  return { ok: true, persisted: true, updated };
}

export async function savePerson(person: Person): Promise<ActionResult> {
  const { supabase } = await requireLeader();
  if (!supabase) return { ok: true, persisted: false };
  const { error } = await supabase.from("people").upsert(personToRow(person));
  if (error) return { ok: false, error: error.message, persisted: true };
  return { ok: true, persisted: true };
}

export async function deleteGroup(id: string): Promise<ActionResult> {
  const { supabase } = await requireLeader();
  if (!supabase) return { ok: true, persisted: false };
  const { error } = await supabase.from("groups").delete().eq("id", id);
  if (error) return { ok: false, error: error.message, persisted: true };
  return { ok: true, persisted: true };
}

export async function deletePerson(id: string): Promise<ActionResult> {
  const { supabase } = await requireLeader();
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
