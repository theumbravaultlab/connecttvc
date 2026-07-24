// ============================================================
// Domain types for Connect TVC
// ============================================================

export type LifeStage =
  | "Families"
  | "Young Adults"
  | "Everyone"
  | "Couples"
  | "Students";

export type GroupStatus = "Active" | "Forming" | "Paused" | "Full";
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

export const AREAS = [
  "Eastside",
  "Downtown",
  "North Hills",
  "Westgate",
  "Midtown",
] as const;
export type Area = (typeof AREAS)[number];

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
  coHost: string;
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
  // Geo (populated by geocoding on save). Public map uses fuzzed point.
  lat?: number | null;
  lng?: number | null;
  publicLat?: number | null;
  publicLng?: number | null;
  // Fallback map position used before real geocoding (design mock %).
  x?: number;
  y?: number;
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
