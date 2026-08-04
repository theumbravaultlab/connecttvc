/** Case/whitespace-insensitive exact match against a fixed option list,
 * falling back to a sane default rather than throwing — shared by both
 * the Party and Group CSV importers for every enum-like field (life
 * stage, status, format, frequency). A messy or unrecognized cell should
 * never block the rest of an otherwise-good import row. */
export function matchEnumValue<T extends string>(value: string, options: readonly T[], fallback: T): T {
  const normalized = value.trim().toLowerCase();
  return options.find((o) => o.toLowerCase() === normalized) ?? fallback;
}
