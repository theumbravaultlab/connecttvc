import type { GroupStatus, LifeStage, PersonStatus } from "./types";

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

// Status hues shared by group + person status pills.
const STATUS_HUE: Record<string, number> = {
  // groups
  Active: 150,
  Forming: 235,
  Paused: 70,
  Full: 20,
  // people
  New: 235,
  "Actively Searching": 70,
  Waitlisted: 35,
  Grouped: 150,
};

export function statusColors(status: GroupStatus | PersonStatus) {
  const h = STATUS_HUE[status] ?? 235;
  return {
    bg: `oklch(0.95 0.055 ${h})`,
    fg: `oklch(0.44 0.13 ${h})`,
  };
}

/** Capacity bar fill: blue < 80%, amber 80–99%, red at 100%. */
export function capacityFill(members: number, capacity: number): string {
  const pct = capacity > 0 ? members / capacity : 0;
  if (pct >= 1) return "oklch(0.62 0.15 20)";
  if (pct >= 0.8) return "oklch(0.7 0.14 70)";
  return "#088df9";
}

/** Spots-open pill styling + label. */
export function spotsBadge(members: number, capacity: number) {
  const open = Math.max(0, capacity - members);
  if (open <= 0) {
    return { label: "Group full", bg: "#eef2f6", fg: "#93a6b8", open: 0 };
  }
  return {
    label: `${open} spots open`,
    bg: "oklch(0.95 0.06 150)",
    fg: "oklch(0.44 0.13 150)",
    open,
  };
}
