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
export type PartyStatus =
  | "New"
  | "Actively Searching"
  | "Waitlisted"
  | "Grouped";
export const PARTY_STATUSES: PartyStatus[] = [
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

/** A household/individual seeking placement — the unit "Finding for"
 * actually matches against. Couples/households searching together (e.g.
 * "the Griers") are one Party with two linked Person records, not two
 * separately-matched people — matching (life stage, days, city, childcare,
 * age, etc.) is evaluated once per party against one shared set of
 * criteria, never reconciled between individuals' possibly-different
 * answers. A solo searcher is just a party of one. */
export interface Party {
  id: string;
  // The connected/searchable name for a party of 2+ (e.g. "The Griers") —
  // optional; falls back to the member names when blank. See
  // partyDisplayName().
  partyName: string;
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
  status: PartyStatus;
  group: string | null; // assigned group id
  joined: string;
  notes: string;
  // Geo (populated by geocoding on save), same pattern as Group.
  lat?: number | null;
  lng?: number | null;
  // Set by the DB trigger; used to detect a stale/conflicting save.
  updatedAt?: string;
}

/** One individual, linked to the Party that holds their matching/placement
 * info. Deliberately minimal — just enough to identify and contact this
 * specific person; everything else lives on their Party. */
export interface Person {
  id: string;
  partyId: string;
  name: string;
  email: string;
  phone: string;
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

/** One entry in a party's outreach log — append-only, timestamped, and
 * auto-attributed to whichever coordinator logged it server-side. Exists
 * specifically to prevent double-messaging: multiple coordinators working
 * the same list can see at a glance whether (and when) someone already
 * reached out to this household, rather than trusting a single overwritable
 * field or tracking it per individual. */
export interface ContactLogEntry {
  id: string;
  partyId: string;
  contactedBy: string | null;
  note: string;
  createdAt: string;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** The name to search for and headline everywhere a party's summary
 * appears — the party's own name (e.g. "The Griers") when it has one set,
 * otherwise its members' names joined together ("Will Grier & Sarah
 * Grier"), or "Unnamed party" for the (should-never-happen) empty case. */
export function partyDisplayName(party: Pick<Party, "partyName">, members: Person[]): string {
  if (party.partyName.trim()) return party.partyName.trim();
  if (members.length === 0) return "Unnamed party";
  return partyMemberNames(members);
}

/** "Will Grier & Sarah Grier" — always available regardless of whether the
 * party has an explicit name set, so callers can show who's actually in a
 * party right under its (possibly non-individual) display name. */
export function partyMemberNames(members: Person[]): string {
  return members.map((m) => m.name).join(" & ");
}
