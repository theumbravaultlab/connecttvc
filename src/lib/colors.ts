import type { GroupStatus, LifeStage, PartyStatus } from "./types";

// ============================================================
// Hue-based color system (from design handoff). All computed
// as oklch(L C hue) so the whole palette stays harmonious.
// ============================================================

const LIFE_HUE: Record<LifeStage, number> = {
  Families: 145,
  "Young Adults": 300,
  Everyone: 235,
  Couples: 25,
  Students: 90,
};

export function lifeColors(life: LifeStage) {
  const h = LIFE_HUE[life] ?? 235;
  return {
    /** Pin / left stripe fill */
    solid: `oklch(0.63 0.14 ${h})`,
    /** Tag pill background */
    tagBg: `oklch(0.95 0.045 ${h})`,
    /** Tag pill text */
    tagFg: `oklch(0.46 0.12 ${h})`,
  };
}

// Status hues shared by group + party status pills.
const STATUS_HUE: Record<string, number> = {
  // groups
  Open: 150,
  Closed: 20,
  // parties (New is also a group status; same hue for both)
  New: 235,
  "Actively Searching": 70,
  Waitlisted: 35,
  Grouped: 150,
};

export function statusColors(status: GroupStatus | PartyStatus) {
  const h = STATUS_HUE[status] ?? 235;
  return {
    bg: `oklch(0.95 0.055 ${h})`,
    fg: `oklch(0.44 0.13 ${h})`,
  };
}

/** Vivid, single-color fill for a status-colored map pin — same hue as
 * statusColors(), just at pin-fill lightness/chroma instead of pill
 * background/foreground. */
export function statusSolid(status: GroupStatus | PartyStatus): string {
  const h = STATUS_HUE[status] ?? 235;
  return `oklch(0.62 0.15 ${h})`;
}

/** Map-pin fill for a group: life-stage color while it's actually
 * actionable (New/Open), a flat muted gray once it's Closed. This keeps
 * full 5-color life-stage differentiation exactly where it matters (the
 * groups worth comparing while scanning the map) while a closed group
 * recedes into "skip this one" without needing to click in to find out —
 * deliberately not status-colored across all three statuses, since with
 * most groups landing on "Open" that collapses the map to one dominant
 * hue and makes individual pins harder to tell apart, not easier. */
export function groupPinColor(group: { life: LifeStage; status: GroupStatus }): string {
  if (group.status === "Closed") return "oklch(0.65 0.02 250)";
  return lifeColors(group.life).solid;
}

/** Capacity bar fill: blue < 80%, amber 80–99%, red at 100%. */
export function capacityFill(members: number, capacity: number): string {
  const pct = capacity > 0 ? members / capacity : 0;
  if (pct >= 1) return "oklch(0.62 0.15 20)";
  if (pct >= 0.8) return "oklch(0.7 0.14 70)";
  return "var(--brand-blue)";
}

/** Spots-open pill styling + label. Gray whenever the group is full
 * (unchanged) *or* whenever it's Closed — a Closed group shouldn't read
 * as "green/available" just because its numbers happen to leave room,
 * since it isn't actually accepting anyone. */
export function spotsBadge(members: number, capacity: number, status?: GroupStatus) {
  const open = Math.max(0, capacity - members);
  if (open <= 0 || status === "Closed") {
    return {
      label: open <= 0 ? "Group full" : `${open} spots open`,
      bg: "var(--divider)",
      fg: "var(--muted)",
      open,
    };
  }
  return {
    label: `${open} spots open`,
    bg: "oklch(0.95 0.06 150)",
    fg: "oklch(0.44 0.13 150)",
    open,
  };
}
