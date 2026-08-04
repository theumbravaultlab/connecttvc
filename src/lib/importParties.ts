import { DAYS, LIFE_STAGES, PARTY_STATUSES, type DayShort, type LifeStage, type PartyStatus, type TimePref } from "./types";
import { stripFieldSuffix, type FieldPriority, type TemplateField } from "./csvTemplate";
import { matchEnumValue } from "./importShared";

export type PartyImportField =
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

export const PARTY_IMPORT_FIELD_LABELS: Record<PartyImportField, string> = {
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

const FIELD_ALIASES: Record<Exclude<PartyImportField, "skip">, string[]> = {
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

/** High vs low priority mirrors this app's own existing "Matching" field
 * flags in PartyForm.tsx (Available days, Home city, Life stage, Age,
 * Childcare needed) — those are what the Finder actually matches on, plus
 * Name (structurally required) and Address (needed for map placement,
 * which is central to what this app does). Everything else — contact
 * info, status, free text — is genuinely useful but the app functions
 * fine without it on day one. */
export const PARTY_FIELD_PRIORITY: Record<Exclude<PartyImportField, "skip">, FieldPriority> = {
  name: "high",
  address: "high",
  days: "high",
  life: "high",
  age: "high",
  partyName: "low",
  email: "low",
  phone: "low",
  status: "low",
  timePref: "low",
  notes: "low",
};

export const PARTY_REQUIRED_FIELD: PartyImportField = "name";

const EXAMPLE_VALUES: Record<Exclude<PartyImportField, "skip">, string> = {
  name: "John Smith",
  partyName: "The Smiths",
  email: "john@example.com",
  phone: "(555) 123-4567",
  address: "123 Main St, Flower Mound, TX 75028",
  age: "34",
  life: "Families",
  status: "New",
  days: "Mon;Wed;Fri",
  timePref: "Evenings",
  notes: "New to the area",
};

/** Same field order as `partyTemplateFields()`, keyed rather than
 * positional so the two can never drift out of alignment. */
const FIELD_ORDER = (Object.keys(PARTY_IMPORT_FIELD_LABELS) as PartyImportField[]).filter(
  (f): f is Exclude<PartyImportField, "skip"> => f !== "skip",
);

/** Best-guess field for a CSV column header, by exact (case/whitespace-
 * insensitive) match against a known alias list. Strips a downloaded
 * template's own "(High Priority)"/"(Required)" tag first, so re-
 * uploading a filled-in template still auto-maps correctly. Returns
 * "skip" when nothing matches — better to make the coordinator map an
 * unrecognized column explicitly than guess wrong and silently import
 * garbage. */
export function guessPartyField(header: string): PartyImportField {
  const normalized = stripFieldSuffix(header).trim().toLowerCase();
  for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [Exclude<PartyImportField, "skip">, string[]][]) {
    if (aliases.includes(normalized)) return field;
  }
  return "skip";
}

/** Field list + priority, in template-download order. */
export function partyTemplateFields(): TemplateField[] {
  return FIELD_ORDER.map((f) => ({
    label: PARTY_IMPORT_FIELD_LABELS[f].replace(/\s*\(required\)$/i, ""),
    priority: PARTY_FIELD_PRIORITY[f],
    required: f === PARTY_REQUIRED_FIELD,
  }));
}

/** Example values in the same order as `partyTemplateFields()`. */
export function partyTemplateExampleRow(): string[] {
  return FIELD_ORDER.map((f) => EXAMPLE_VALUES[f]);
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
export function buildPartyImportRow(cells: string[], mapping: PartyImportField[]): ImportPartyRow {
  const get = (field: PartyImportField): string => {
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
    life: get("life") ? matchEnumValue(get("life"), LIFE_STAGES, "Everyone") : "Everyone",
    status: get("status") ? matchEnumValue(get("status"), PARTY_STATUSES, "New") : "New",
    days: get("days") ? matchDays(get("days")) : [],
    timePref: "Flexible",
    notes: get("notes"),
  };
}
