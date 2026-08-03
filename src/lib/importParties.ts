import { DAYS, LIFE_STAGES, PARTY_STATUSES, type DayShort, type LifeStage, type PartyStatus, type TimePref } from "./types";

export type ImportField =
  | "name"
  | "partyName"
  | "email"
  | "phone"
  | "address"
  | "age"
  | "life"
  | "status"
  | "days"
  | "timePref"
  | "notes"
  | "skip";

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  name: "Name (required)",
  partyName: "Party/household name",
  email: "Email",
  phone: "Phone",
  address: "Address",
  age: "Age",
  life: "Life stage",
  status: "Status",
  days: "Available days",
  timePref: "Time preference",
  notes: "Notes",
  skip: "— Don't import —",
};

const FIELD_ALIASES: Record<Exclude<ImportField, "skip">, string[]> = {
  name: ["name", "full name", "individual", "person", "member", "member name"],
  partyName: ["party name", "family name", "household", "family", "last name"],
  email: ["email", "e-mail", "email address"],
  phone: ["phone", "cell", "mobile", "telephone", "phone number"],
  address: ["address", "home address", "street address", "mailing address"],
  age: ["age"],
  life: ["life stage", "lifestage", "stage", "life"],
  status: ["status"],
  days: ["days", "available days", "availability", "day"],
  timePref: ["time preference", "time pref", "preferred time", "timepref"],
  notes: ["notes", "note", "comments", "comment"],
};

/** Best-guess field for a CSV column header, by exact (case/whitespace-
 * insensitive) match against a known alias list. Returns "skip" when
 * nothing matches — better to make the coordinator map an unrecognized
 * column explicitly than guess wrong and silently import garbage. */
export function guessField(header: string): ImportField {
  const normalized = header.trim().toLowerCase();
  for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [Exclude<ImportField, "skip">, string[]][]) {
    if (aliases.includes(normalized)) return field;
  }
  return "skip";
}

export interface ImportPartyRow {
  name: string;
  partyName: string;
  email: string;
  phone: string;
  address: string;
  age: number | null;
  life: LifeStage;
  status: PartyStatus;
  days: DayShort[];
  timePref: TimePref;
  notes: string;
}

function matchLifeStage(value: string): LifeStage {
  const normalized = value.trim().toLowerCase();
  return LIFE_STAGES.find((l) => l.toLowerCase() === normalized) ?? "Everyone";
}

function matchStatus(value: string): PartyStatus {
  const normalized = value.trim().toLowerCase();
  return PARTY_STATUSES.find((s) => s.toLowerCase() === normalized) ?? "New";
}

function matchDays(value: string): DayShort[] {
  const tokens = value.split(/[,;/]+/).map((t) => t.trim().toLowerCase()).filter(Boolean);
  const matched = new Set<DayShort>();
  for (const token of tokens) {
    const day = DAYS.find((d) => d.toLowerCase() === token || d.toLowerCase().startsWith(token.slice(0, 3)));
    if (day) matched.add(day);
  }
  return [...matched];
}

/** Turns one raw CSV data row (plus the coordinator's column->field
 * mapping) into a normalized ImportPartyRow. Never throws — an
 * unparseable age becomes null, an unrecognized life stage/status falls
 * back to a sane default ("Everyone"/"New"), same "don't block the whole
 * import over one messy cell" philosophy as everything else here. */
export function buildImportRow(cells: string[], mapping: ImportField[]): ImportPartyRow {
  const get = (field: ImportField): string => {
    const idx = mapping.indexOf(field);
    return idx === -1 ? "" : (cells[idx] ?? "").trim();
  };
  const ageRaw = get("age");
  const age = ageRaw && /^\d+$/.test(ageRaw) ? Number(ageRaw) : null;
  return {
    name: get("name"),
    partyName: get("partyName"),
    email: get("email"),
    phone: get("phone"),
    address: get("address"),
    age,
    life: get("life") ? matchLifeStage(get("life")) : "Everyone",
    status: get("status") ? matchStatus(get("status")) : "New",
    days: get("days") ? matchDays(get("days")) : [],
    timePref: "Flexible",
    notes: get("notes"),
  };
}
