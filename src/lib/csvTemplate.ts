export type FieldPriority = "high" | "low";

/** One row of the downloadable CSV template. `required` gets its own tag
 * (stronger than "High Priority") since it's not just important, the row
 * is unusable without it. */
export interface TemplateField {
  label: string;
  priority: FieldPriority;
  required?: boolean;
}

function priorityTag(field: TemplateField): string {
  if (field.required) return "Required";
  return field.priority === "high" ? "High Priority" : "Low Priority";
}

function escapeCsvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function toCsvLine(cells: string[]): string {
  return cells.map(escapeCsvCell).join(",");
}

/** Builds a downloadable CSV template: one header row with each field's
 * priority tagged directly in the column name (so it round-trips — a
 * coordinator can fill this exact file in and re-upload it, since
 * `stripFieldSuffix` below strips the tag back off before matching), plus
 * one clearly-marked example row showing expected formatting (e.g. how to
 * write multiple days) that's obviously not real data. */
export function buildTemplateCsv(fields: TemplateField[], exampleValues: string[]): string {
  const headers = fields.map((f) => `${f.label} (${priorityTag(f)})`);
  const example = [...exampleValues];
  example[0] = `EXAMPLE — delete this row — ${example[0] ?? ""}`.trim();
  return `${toCsvLine(headers)}\r\n${toCsvLine(example)}\r\n`;
}

/** Strips the "(High Priority)"/"(Low Priority)"/"(Required)" tag a
 * downloaded template's headers carry, so re-uploading a filled-in
 * template auto-maps columns exactly like any other CSV would. */
export function stripFieldSuffix(header: string): string {
  return header.replace(/\s*\((?:high priority|low priority|required)\)\s*$/i, "").trim();
}

/** Triggers a browser file download for CSV text — plain Blob + object
 * URL + a programmatic click, no new dependency. */
export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
