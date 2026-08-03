import type { ReactNode } from "react";
import { capacityFill, lifeColors, spotsBadge, statusColors } from "@/lib/colors";
import type { MatchChecklistItem } from "@/lib/matchChecklist";
import type { DayShort, GroupStatus, LifeStage, PartyStatus } from "@/lib/types";
import { DAYS } from "@/lib/types";
import { CheckIcon, XIcon } from "@/components/icons";

export function LifeTag({ life }: { life: LifeStage }) {
  const c = lifeColors(life);
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-[3px] text-[11px] font-extrabold"
      style={{ background: c.tagBg, color: c.tagFg }}
    >
      {life}
    </span>
  );
}

/** Shown next to a party's name wherever its summary appears, whenever it
 * has 2+ members — a quick visual cue that placing them takes multiple
 * open spots, not one. */
export function PartyTag({ partySize }: { partySize: number }) {
  if (partySize <= 1) return null;
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-[3px] text-[10px] font-extrabold uppercase tracking-wide"
      style={{ background: "var(--panel-3)", color: "var(--brand-blue)" }}
    >
      Party of {partySize}
    </span>
  );
}

/** Row of chips confirming exactly what does/doesn't match between a
 * selected party and one specific group — green check + the group's own
 * value when it matches what the party needs, grey X + the same style of
 * label when it doesn't (so a mismatch shows the real conflicting value,
 * not just a generic "no match"). Shared between the strict match list
 * and the "might still work" suggestions so both read the same way. */
export function MatchChecklistRow({ items }: { items: MatchChecklistItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item.key}
          className="flex items-center gap-1 rounded-full px-2 py-[2px] text-[10.5px] font-bold"
          style={
            item.met
              ? { background: "oklch(0.95 0.06 150)", color: "oklch(0.44 0.13 150)" }
              : { background: "var(--divider)", color: "var(--faint)" }
          }
        >
          {item.met ? <CheckIcon width={9} height={9} /> : <XIcon width={9} height={9} />}
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function StatusPill({ status }: { status: GroupStatus | PartyStatus }) {
  const c = statusColors(status);
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-[3px] text-[10px] font-extrabold uppercase tracking-wide"
      style={{ background: c.bg, color: c.fg }}
    >
      {status}
    </span>
  );
}

export function SpotsPill({
  members,
  capacity,
  status,
}: {
  members: number;
  capacity: number;
  status?: GroupStatus;
}) {
  const s = spotsBadge(members, capacity, status);
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2.5 py-[3px] text-[11px] font-extrabold"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}

export function CapacityBar({
  members,
  capacity,
}: {
  members: number;
  capacity: number;
}) {
  const pct = capacity > 0 ? Math.min(100, (members / capacity) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--divider-2)]">
      <div
        className="h-full rounded-full transition-[width] duration-200"
        style={{ width: `${pct}%`, background: capacityFill(members, capacity) }}
      />
    </div>
  );
}

export function Avatar({
  initials,
  size = 32,
  tone = "blue",
}: {
  initials: string;
  size?: number;
  tone?: "blue" | "muted";
}) {
  const bg = tone === "blue" ? "var(--brand-blue)" : "var(--border)";
  const fg = tone === "blue" ? "#fff" : "var(--muted)";
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold"
      style={{
        width: size,
        height: size,
        background: bg,
        color: fg,
        fontSize: size * 0.4,
      }}
    >
      {initials}
    </span>
  );
}

export function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
      style={{ background: on ? "var(--brand-blue)" : "var(--border)" }}
    >
      <span
        className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-[left] duration-150"
        style={{ left: on ? 20 : 2 }}
      />
    </button>
  );
}

export function DayPills({
  value,
  onToggle,
}: {
  value: DayShort[];
  onToggle: (d: DayShort) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {DAYS.map((d) => {
        const active = value.includes(d);
        return (
          <button
            key={d}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(d)}
            className="rounded-full border px-2.5 py-1 text-[12px] font-bold transition-all duration-100"
            style={
              active
                ? { background: "var(--brand-blue)", color: "#fff", borderColor: "var(--brand-blue)" }
                : { background: "var(--surface)", color: "var(--muted)", borderColor: "var(--border)" }
            }
          >
            {d}
          </button>
        );
      })}
    </div>
  );
}

export function FieldLabel({
  children,
  tag,
  matching,
  htmlFor,
}: {
  children: ReactNode;
  tag?: string;
  /** Flags this field as one the Finder's matching logic actually reads
   * (city, available days, life stage, age, childcare) — a standardized
   * badge distinct from `tag`'s amber notes, so it's obvious at a glance
   * which data points are worth getting right for matching to work. */
  matching?: boolean;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 flex items-center gap-1.5 text-[12px] font-bold text-[var(--faint)]"
    >
      {children}
      {matching && (
        <span
          className="rounded-full px-1.5 py-[1px] text-[10px] font-bold"
          style={{ background: "var(--panel-3)", color: "var(--brand-blue)" }}
        >
          Matching
        </span>
      )}
      {tag && (
        <span
          className="rounded-full px-1.5 py-[1px] text-[10px] font-bold"
          style={{ background: "var(--amber-bg)", color: "var(--amber-fg)" }}
        >
          {tag}
        </span>
      )}
    </label>
  );
}

const controlClass =
  "w-full rounded-[9px] border border-[var(--border)] bg-[var(--panel-1)] px-3 py-2 text-[13px] font-semibold text-[var(--ink)] outline-none transition-colors focus:border-[var(--brand-blue)] focus:ring-2 focus:ring-[var(--brand-blue)]/30";

export function TextInput(
  props: React.InputHTMLAttributes<HTMLInputElement>,
) {
  return <input {...props} className={controlClass} />;
}

export function TextArea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return <textarea {...props} className={`${controlClass} min-h-[70px] resize-y`} />;
}

/** Non-interactive display for a value that's auto-derived rather than
 * hand-entered (e.g. area, derived from the address's city). */
export function ReadOnlyValue({
  value,
  placeholder,
  id,
}: {
  value: string;
  placeholder?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      className="flex w-full items-center rounded-[9px] border border-[var(--border)] bg-[var(--divider)] px-3 py-2 text-[13px] font-semibold text-[var(--muted)]"
    >
      {value || <span className="text-[var(--faint)]">{placeholder}</span>}
    </div>
  );
}

export function SelectInput({
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={controlClass}>
      {children}
    </select>
  );
}
