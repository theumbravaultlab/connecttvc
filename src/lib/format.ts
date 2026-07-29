// Connect TVC only ever operates in the DFW metroplex (see FinderMap.tsx's
// hard DFW bounds), so every timestamp shown in the app is rendered in
// Central time regardless of the viewer's own device timezone — a
// coordinator in Chicago and one in Denver should see the exact same
// "when," not two different ones. "America/Chicago" (not a fixed UTC
// offset) so it correctly follows CDT/CST across daylight saving changes.
const CENTRAL_TZ = "America/Chicago";

/** "Jul 27, 2026, 2:43 PM CT" — outreach log entries and the record
 * created/updated admin footer. */
export function formatDateTime(iso: string): string {
  const formatted = new Date(iso).toLocaleString(undefined, {
    timeZone: CENTRAL_TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return `${formatted} CT`;
}

/** "Jul 27, 2026" — Placement History's more compact, date-only display. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    timeZone: CENTRAL_TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "July 27, 2026 at 2:43 PM CT" — the Reports page's print/PDF export
 * header. */
export function formatExportedAt(date: Date): string {
  const formatted = date.toLocaleString(undefined, {
    timeZone: CENTRAL_TZ,
    dateStyle: "long",
    timeStyle: "short",
  });
  return `${formatted} CT`;
}
