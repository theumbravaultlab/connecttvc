import type { ReactNode } from "react";
import { capacityFill, lifeColors, spotsBadge, statusColors } from "@/lib/colors";
import type { DayShort, GroupStatus, LifeStage, PersonStatus } from "@/lib/types";
import { DAYS } from "@/lib/types";

export function LifeTag({ life }: { life: LifeStage }) {
  const c = lifeColors(life);
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-[3px] text-[10.5px] font-extrabold"
      style={{ background: c.tagBg, color: c.tagFg }}
    >
      {life}
    </span>
  );
}

export function StatusPill({ status }: { status: GroupStatus | PersonStatus }) {
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
}: {
  members: number;
  capacity: number;
}) {
  const s = spotsBadge(members, capacity);
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2.5 py-[3px] text-[10.5px] font-extrabold"
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
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#e6eef6]">
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
  const bg = tone === "blue" ? "#088df9" : "#dbe7f3";
  const fg = tone === "blue" ? "#fff" : "#5b7a97";
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
      style={{ background: on ? "#088df9" : "#cfd9e3" }}
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
  multi = true,
}: {
  value: DayShort[];
  onToggle: (d: DayShort) => void;
  multi?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {DAYS.map((d) => {
        const active = value.includes(d);
        return (
          <button
            key={d}
            type="button"
            onClick={() => onToggle(d)}
            className="rounded-full border px-2.5 py-1 text-[11.5px] font-bold transition-all duration-100"
            style={
              active
                ? { background: "#088df9", color: "#fff", borderColor: "#088df9" }
                : { background: "#fff", color: "#5b7a97", borderColor: "#dbe7f3" }
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
}: {
  children: ReactNode;
  tag?: string;
}) {
  return (
    <label className="mb-1 flex items-center gap-1.5 text-[11.5px] font-bold text-[#8aa0b4]">
      {children}
      {tag && (
        <span
          className="rounded-full px-1.5 py-[1px] text-[9.5px] font-bold"
          style={{ background: "var(--amber-bg)", color: "var(--amber-fg)" }}
        >
          {tag}
        </span>
      )}
    </label>
  );
}

const controlClass =
  "w-full rounded-[9px] border border-[#dbe7f3] bg-[#f7fafd] px-3 py-2 text-[12.5px] font-semibold text-[#16324f] outline-none transition-colors focus:border-[#088df9]";

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
