// Group.ageRange is free text (e.g. "24–32", "18–24", or "All ages") rather
// than two structured numbers — it reads better as a form field and the
// original design already used strings like this. Parsed here just for
// matching against a Person's age in the Finder.

/** Parses "24–32" (en dash) or "24-32" (hyphen) into [min, max]. Returns
 * null for "All ages" or anything else unparseable — callers should treat
 * null as "no restriction", not as a non-match. */
export function parseAgeRange(range: string): [number, number] | null {
  const match = range.trim().match(/(\d+)\s*[–-]\s*(\d+)/);
  if (!match) return null;
  const [, lo, hi] = match;
  return [Number(lo), Number(hi)];
}

/** Whether a person of the given age fits a group's age range. An unknown
 * person age, or an unparseable/"All ages" group range, always matches —
 * this filter should only ever exclude on a genuine, known mismatch. */
export function ageMatchesRange(age: number | null, range: string): boolean {
  if (age == null) return true;
  const parsed = parseAgeRange(range);
  if (!parsed) return true;
  const [lo, hi] = parsed;
  return age >= lo && age <= hi;
}
