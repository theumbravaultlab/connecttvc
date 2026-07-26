// ============================================================
// Domain types for Connect TVC
// ============================================================

export type LifeStage =
  | "Families"
  | "Young Adults"
  | "Everyone"
  | "Couples"
  | "Students";

export type GroupStatus = "New" | "Open" | "Closed";
export const GROUP_STATUSES: GroupStatus[] = ["New", "Open", "Closed"];
export type PersonStatus =
  | "New"
  | "Actively Searching"
  | "Waitlisted"
  | "Grouped";
export const PERSON_STATUSES: PersonStatus[] = [
  "New",
  "Actively Searching",
  "Waitlisted",
  "Grouped",
];
export type Format = "In-person" | "Hybrid" | "Online";
export type Frequency = "Weekly" | "Every other week" | "Monthly";
export type TimePref = "Mornings" | "Afternoons" | "Evenings" | "Flexible";

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type DayShort = (typeof DAYS)[number];

// Area is no longer a fixed set — it's auto-derived from the city in each
// record's geocoded address (see src/lib/geocode.ts), so Group.area /
// Person.area are just plain strings now. The Finder's area filter builds
// its option list dynamically from whatever areas are actually present.

export const LIFE_STAGES: LifeStage[] = [
  "Families",
  "Young Adults",
  "Everyone",
  "Couples",
  "Students",
];

/** A home group — full record as managed in the leader console. */
export interface Group {
  id: string;
  name: string;
  day: DayShort; // "Tue"
  time: string; // "7:00 PM"
  area: string;
  host: string;
  mentor: string;
  life: LifeStage;
  status: GroupStatus;
  format: Format;
  freq: Frequency;
  capacity: number;
  members: number;
  childcare: boolean;
  topic: string;
  ageRange: string;
  startDate: string;
  contactEmail: string;
  address: string; // PRIVATE — leaders only
  desc: string;
  // Shown on the Finder card as "Placement Details" — practical notes for
  // whoever is deciding whether to place someone here (steps to the door,
  // parking, pets, etc.), distinct from `desc` (the public-facing blurb).
  placementDetails: string;
  // Geo (populated by geocoding on save).
  lat?: number | null;
  lng?: number | null;
  // Set by the DB trigger; used to detect a stale/conflicting save.
  updatedAt?: string;
}

/** A person seeking placement — managed by coordinators. */
export interface Person {
  id: string;
  name: string;
  email: string;
  phone: string;
  area: string;
  address: string; // home address, private — used for routing/map only
  days: DayShort[];
  timePref: TimePref;
  life: LifeStage;
  // Used to match against a Group's free-text `ageRange` (e.g. "24–32") in
  // the Finder — see src/lib/ageRange.ts. Optional since not every existing
  // record has it filled in yet.
  age: number | null;
  interests: string;
  childcareNeeded: boolean;
  accessibility: string;
  status: PersonStatus;
  group: string | null; // assigned group id
  joined: string;
  notes: string;
  // Geo (populated by geocoding on save), same pattern as Group.
  lat?: number | null;
  lng?: number | null;
  // Set by the DB trigger; used to detect a stale/conflicting save.
  updatedAt?: string;
}

export const DAY_LONG: Record<DayShort, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
