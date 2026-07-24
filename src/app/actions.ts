"use server";

import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import type { Group, Person } from "@/lib/types";

// Map domain records back to DB rows (camelCase -> snake_case).
function groupToRow(g: Group) {
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
  const { error } = await supabase.from("groups").upsert(groupToRow(group));
  if (error) return { ok: false, error: error.message, persisted: true };
  return { ok: true, persisted: true };
}

export async function savePerson(person: Person): Promise<ActionResult> {
  const { supabase } = await requireLeader();
  if (!supabase) return { ok: true, persisted: false };
  const { error } = await supabase.from("people").upsert(personToRow(person));
  if (error) return { ok: false, error: error.message, persisted: true };
  return { ok: true, persisted: true };
}

export async function signOut() {
  const supabase = await getServerSupabase();
  if (supabase) await supabase.auth.signOut();
  redirect("/");
}
