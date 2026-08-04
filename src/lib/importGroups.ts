import {
  DAYS,
  GROUP_STATUSES,
  LIFE_STAGES,
  type DayShort,
  type Format,
  type Frequency,
  type GroupStatus,
  type LifeStage,
} from "./types";
import { stripFieldSuffix, type FieldPriority, type TemplateField } from "./csvTemplate";
import { matchEnumValue } from "./importShared";

export type GroupImportField =
  | "name"
  | "day"
  | "time"
  | "host"
  | "mentor"
  | "life"
  | "status"
  | "format"
  | "freq"
  | "capacity"
  | "members"
  | "childcare"
  | "topic"
  | "ageRange"
  | "startDate"
  | "contactEmail"
  | "address"
  | "desc"
  | "placementDetails"
  | "skip";

export const GROUP_IMPORT_FIELD_LABELS: Record<GroupImportField, string> = {
  name: "Group name (required)",
  day: "Meeting day",
  time: "Meeting time",
  host: "Host(s)",
  mentor: "Mentor(s)",
  life: "Life stage",
  status: "Status",
  format: "Format",
  freq: "Frequency",
  capacity: "Max capacity",
  members: "Current members",
  childcare: "Childcare available",
  topic: "Focus / topic",
  ageRange: "Age range",
  startDate: "Meeting since",
  contactEmail: "Contact email",
  address: "Address",
  desc: "Description",
  placementDetails: "Placement details",
  skip: "— Don't import —",
};

const FIELD_ALIASES: Record<Exclude<GroupImportField, "skip">, string[]> = {
  name: ["name", "group name", "group"],
  day: ["day", "meeting day", "day of week"],
  time: ["time", "meeting time"],
  host: ["host", "hosts", "host(s)", "leader", "leaders"],
  mentor: ["mentor", "mentors", "mentor(s)", "co-leader", "co-host"],
  life: ["life stage", "lifestage", "stage", "life"],
  status: ["status"],
  format: ["format"],
  freq: ["frequency", "freq", "meeting frequency"],
  capacity: ["max capacity", "capacity", "max size", "spots"],
  members: ["current members", "members", "member count", "roster size"],
  childcare: ["childcare", "childcare available", "child care"],
  topic: ["topic", "focus", "focus / topic", "focus/topic"],
  ageRange: ["age range", "ages", "agerange"],
  startDate: ["meeting since", "start date", "started"],
  contactEmail: ["contact email", "email", "group email"],
  address: ["address", "home address", "street address", "meeting address"],
  desc: ["description", "desc", "about"],
  placementDetails: ["placement details", "good to know", "notes"],
};

/** High vs low priority mirrors this app's own existing "Matching" field
 * flags in GroupForm.tsx (Meeting day, City, Life stage, Age range,
 * Childcare available) — those are what the Finder actually matches
 * against, plus Name (structurally required), Time and Capacity (a group
 * without a meeting time or a spots-available count isn't really usable
 * yet), and Address (needed for map placement, which is central to what
 * this app does — "City" itself is auto-derived from it, not a separate
 * column). Everything else — leadership names, status, free text — is
 * genuinely useful but the app functions fine without it on day one. */
export const GROUP_FIELD_PRIORITY: Record<Exclude<GroupImportField, "skip">, FieldPriority> = {
  name: "high",
  day: "high",
  time: "high",
  address: "high",
  life: "high",
  ageRange: "high",
  childcare: "high",
  capacity: "high",
  host: "low",
  mentor: "low",
  status: "low",
  format: "low",
  freq: "low",
  members: "low",
  topic: "low",
  startDate: "low",
  contactEmail: "low",
  desc: "low",
  placementDetails: "low",
};

export const GROUP_REQUIRED_FIELD: GroupImportField = "name";

const EXAMPLE_VALUES: Record<Exclude<GroupImportField, "skip">, string> = {
  name: "The Smiths",
  day: "Tue",
  time: "7:00 PM",
  host: "John and Sarah Smith",
  mentor: "—",
  life: "Families",
  status: "New",
  format: "In-person",
  freq: "Weekly",
  capacity: "12",
  members: "0",
  childcare: "Yes",
  topic: "Come-as-you-are community",
  ageRange: "All ages",
  startDate: "Jan 2026",
  contactEmail: "thesmiths@connecttvc.org",
  address: "123 Main St, Flower Mound, TX 75028",
  desc: "A relaxed gathering where neighbors share a meal and a short devotional.",
  placementDetails: "Childcare on site; arrive a few minutes early to drop off.",
};

const FIELD_ORDER = (Object.keys(GROUP_IMPORT_FIELD_LABELS) as GroupImportField[]).filter(
  (f): f is Exclude<GroupImportField, "skip"> => f !== "skip",
);

/** Best-guess field for a CSV column header — see guessPartyField() in
 * importParties.ts for the full reasoning, identical approach here. */
export function guessGroupField(header: string): GroupImportField {
  const normalized = stripFieldSuffix(header).trim().toLowerCase();
  for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [Exclude<GroupImportField, "skip">, string[]][]) {
    if (aliases.includes(normalized)) return field;
  }
  return "skip";
}

export function groupTemplateFields(): TemplateField[] {
  return FIELD_ORDER.map((f) => ({
    label: GROUP_IMPORT_FIELD_LABELS[f].replace(/\s*\(required\)$/i, ""),
    priority: GROUP_FIELD_PRIORITY[f],
    required: f === GROUP_REQUIRED_FIELD,
  }));
}

export function groupTemplateExampleRow(): string[] {
  return FIELD_ORDER.map((f) => EXAMPLE_VALUES[f]);
}

export interface ImportGroupRow {
  name: string;
  day: DayShort;
  time: string;
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
  address: string;
  desc: string;
  placementDetails: string;
}

const FORMATS: Format[] = ["In-person", "Hybrid", "Online"];
const FREQS: Frequency[] = ["Weekly", "Every other week", "Monthly"];
const TRUTHY = new Set(["yes", "y", "true", "1", "available"]);

function matchDay(value: string): DayShort {
  const normalized = value.trim().toLowerCase();
  return (
    DAYS.find((d) => d.toLowerCase() === normalized || d.toLowerCase() === normalized.slice(0, 3)) ?? "Mon"
  );
}

function parseInt0(value: string): number {
  return /^\d+$/.test(value) ? Number(value) : 0;
}

/** Turns one raw CSV data row (plus the coordinator's column->field
 * mapping) into a normalized ImportGroupRow — same "never throw, fall
 * back to a sane default" philosophy as buildPartyImportRow(). */
export function buildGroupImportRow(cells: string[], mapping: GroupImportField[]): ImportGroupRow {
  const get = (field: GroupImportField): string => {
    const idx = mapping.indexOf(field);
    return idx === -1 ? "" : (cells[idx] ?? "").trim();
  };
  return {
    name: get("name"),
    day: get("day") ? matchDay(get("day")) : "Mon",
    time: get("time") || "7:00 PM",
    host: get("host"),
    mentor: get("mentor") || "—",
    life: get("life") ? matchEnumValue(get("life"), LIFE_STAGES, "Everyone") : "Everyone",
    status: get("status") ? matchEnumValue(get("status"), GROUP_STATUSES, "New") : "New",
    format: get("format") ? matchEnumValue(get("format"), FORMATS, "In-person") : "In-person",
    freq: get("freq") ? matchEnumValue(get("freq"), FREQS, "Weekly") : "Weekly",
    capacity: get("capacity") ? Math.max(1, parseInt0(get("capacity")) || 1) : 12,
    members: parseInt0(get("members")),
    childcare: TRUTHY.has(get("childcare").toLowerCase()),
    topic: get("topic"),
    ageRange: get("ageRange") || "All ages",
    startDate: get("startDate"),
    contactEmail: get("contactEmail"),
    address: get("address"),
    desc: get("desc"),
    placementDetails: get("placementDetails"),
  };
}
