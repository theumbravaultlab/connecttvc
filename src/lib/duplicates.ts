import type { Party, Person } from "./types";

export interface DuplicateCandidate {
  /** An individual's name, or a party's own name (e.g. "The Smiths"). */
  name: string;
  email?: string;
  phone?: string;
  /** City, as a secondary signal for a same-name match — not required. */
  area?: string;
}

export interface DuplicateMatch {
  partyId: string;
  /** The specific existing person this candidate matched, if the match
   * came from a person-level field (name/email/phone) rather than the
   * party's own name. */
  personName?: string;
  reason: "email" | "phone" | "name+city" | "name";
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/[.,'"-]/g, "").replace(/\s+/g, " ");
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Fuzzy duplicate check against existing Parties/People — used both when a
 * coordinator manually starts a new Party and when previewing a bulk CSV
 * import. Deliberately non-blocking everywhere it's used: this only ever
 * surfaces a warning, never prevents a save, since two different real
 * people can share a common name and a coordinator needs to be able to
 * proceed past a false positive.
 *
 * Ranked strongest-first: an exact email or phone match is treated as
 * near-certain; a name match is only elevated to "name+city" (still just a
 * caution, not a certainty) when the candidate's city is also known and
 * matches the existing party's city, since a plain name collision alone
 * (no city, no contact info) is the weakest signal.
 */
export function findDuplicates(
  candidate: DuplicateCandidate,
  parties: Party[],
  people: Person[],
): DuplicateMatch[] {
  const email = candidate.email?.trim().toLowerCase();
  const phone = candidate.phone ? normalizePhone(candidate.phone) : "";
  const name = normalizeName(candidate.name);
  if (!email && !phone && !name) return [];

  const partyById = new Map(parties.map((p) => [p.id, p]));
  const matches = new Map<string, DuplicateMatch>();

  const consider = (partyId: string, personName: string | undefined, reason: DuplicateMatch["reason"]) => {
    // Keep only the strongest reason found per party (email > phone >
    // name+city > name), so one party doesn't show up multiple times.
    const rank: Record<DuplicateMatch["reason"], number> = { email: 3, phone: 2, "name+city": 1, name: 0 };
    const existing = matches.get(partyId);
    if (!existing || rank[reason] > rank[existing.reason]) {
      matches.set(partyId, { partyId, personName, reason });
    }
  };

  for (const person of people) {
    if (email && person.email.trim().toLowerCase() === email) {
      consider(person.partyId, person.name, "email");
      continue;
    }
    if (phone && person.phone && normalizePhone(person.phone) === phone) {
      consider(person.partyId, person.name, "phone");
      continue;
    }
    if (name && normalizeName(person.name) === name) {
      const party = partyById.get(person.partyId);
      const sameCity = !!candidate.area && !!party?.area && party.area === candidate.area;
      consider(person.partyId, person.name, sameCity ? "name+city" : "name");
    }
  }

  if (name) {
    for (const party of parties) {
      if (normalizeName(party.partyName) === name) {
        const sameCity = !!candidate.area && !!party.area && party.area === candidate.area;
        consider(party.id, undefined, sameCity ? "name+city" : "name");
      }
    }
  }

  return [...matches.values()];
}

export const DUPLICATE_REASON_LABEL: Record<DuplicateMatch["reason"], string> = {
  email: "same email",
  phone: "same phone",
  "name+city": "same name and city",
  name: "same name",
};
