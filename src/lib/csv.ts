/** Minimal RFC 4180-ish CSV parser — handles quoted fields (including
 * embedded commas/newlines) and "" as an escaped quote. Hand-rolled rather
 * than a new dependency, consistent with this project's existing
 * "no new dependency, hand-build it" pattern (e.g. the Reports PDF export
 * via window.print() instead of a PDF library). Real-world exports (Asana,
 * spreadsheet software) all produce standard CSV this covers; this isn't
 * meant to handle exotic non-standard dialects. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (char === "\r") {
      i++;
      continue;
    }
    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += char;
    i++;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop fully-blank trailing lines (common with a trailing newline in the file).
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}
