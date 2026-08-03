"use client";

import { useId } from "react";
import { LIFE_STAGES } from "@/lib/types";
import { SearchIcon } from "@/components/icons";

const labelClass = "mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--faint)]";
const controlClass =
  "w-full rounded-[9px] border border-[var(--border)] bg-[var(--panel-1)] px-2.5 py-2 text-[12px] font-semibold text-[var(--ink)] outline-none transition-colors focus:border-[var(--brand-blue)] focus:ring-2 focus:ring-[var(--brand-blue)]/30";

/** Shared search + status/life-stage/city filter row for the Directory's
 * Groups and People list pages — previously ~90% duplicated between them
 * (aria-label-only selects with no visible label, at a shorter py-1.5 than
 * the Map's filter grid). Now one component with visible labels and the
 * same control height used everywhere else filters appear. */
export type ExtraFilter = {
  key: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  allLabel: string;
};

export function ListFilterBar<TStatus extends string>({
  search,
  onSearchChange,
  searchPlaceholder,
  statusValue,
  onStatusChange,
  statusOptions,
  lifeValue,
  onLifeChange,
  areaValue,
  onAreaChange,
  areaOptions,
  extraFilters,
  hasFilters,
  onClear,
  assignedToMeActive,
  onToggleAssignedToMe,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder: string;
  statusValue: TStatus | "All";
  onStatusChange: (v: TStatus | "All") => void;
  statusOptions: readonly TStatus[];
  lifeValue: string;
  onLifeChange: (v: string) => void;
  areaValue: string;
  onAreaChange: (v: string) => void;
  areaOptions: string[];
  /** Extra dropdown filters beyond the fixed Status/Life/City trio (e.g.
   * Meeting Day, Assigned To) — kept as an optional add-on rather than
   * folding Status/Life/City into the same generic shape, so those three
   * stay strongly typed (TStatus) instead of becoming plain strings. */
  extraFilters?: ExtraFilter[];
  hasFilters: boolean;
  onClear: () => void;
  /** One-click shortcut for the existing "Assigned to" filter — sets it to
   * the signed-in coordinator's own id instead of making them find their
   * own name in a dropdown that grows with the team. Omit
   * `onToggleAssignedToMe` entirely (e.g. demo mode, no viewer id) to hide
   * this control rather than show a chip that can't do anything. */
  assignedToMeActive?: boolean;
  onToggleAssignedToMe?: () => void;
}) {
  const searchId = useId();
  const statusId = useId();
  const lifeId = useId();
  const areaId = useId();

  return (
    <div className="flex shrink-0 flex-wrap items-end gap-2.5 border-b border-[var(--divider)] px-3 py-2.5 sm:px-[18px]">
      <div className="min-w-[160px] flex-1">
        <label htmlFor={searchId} className={labelClass}>
          Search
        </label>
        <div className="relative">
          <SearchIcon
            width={14}
            height={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--faint)]"
          />
          <input
            id={searchId}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className={`${controlClass} pl-8`}
          />
        </div>
      </div>
      <div className="w-[150px]">
        <label htmlFor={statusId} className={labelClass}>
          Status
        </label>
        <select
          id={statusId}
          value={statusValue}
          onChange={(e) => onStatusChange(e.target.value as TStatus | "All")}
          className={controlClass}
        >
          <option value="All">All statuses</option>
          {statusOptions.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="w-[150px]">
        <label htmlFor={lifeId} className={labelClass}>
          Life stage
        </label>
        <select
          id={lifeId}
          value={lifeValue}
          onChange={(e) => onLifeChange(e.target.value)}
          className={controlClass}
        >
          <option value="All">All life stages</option>
          {LIFE_STAGES.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
      </div>
      <div className="w-[150px]">
        <label htmlFor={areaId} className={labelClass}>
          City
        </label>
        <select
          id={areaId}
          value={areaValue}
          onChange={(e) => onAreaChange(e.target.value)}
          className={controlClass}
        >
          <option value="All">All cities</option>
          {areaOptions.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
      </div>
      {extraFilters?.map((f) => (
        <div key={f.key} className="w-[150px]">
          <label htmlFor={f.key} className={labelClass}>
            {f.label}
          </label>
          <select
            id={f.key}
            value={f.value}
            onChange={(e) => f.onChange(e.target.value)}
            className={controlClass}
          >
            <option value="All">{f.allLabel}</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      ))}
      {onToggleAssignedToMe && (
        <div className="pb-[3px]">
          <button
            type="button"
            onClick={onToggleAssignedToMe}
            aria-pressed={!!assignedToMeActive}
            className="rounded-full border px-3 py-[7px] text-[12px] font-bold transition-colors"
            style={
              assignedToMeActive
                ? { background: "var(--brand-blue)", color: "#fff", borderColor: "var(--brand-blue)" }
                : { background: "var(--panel-1)", color: "var(--muted)", borderColor: "var(--border)" }
            }
          >
            Assigned to me
          </button>
        </div>
      )}
      {hasFilters && (
        <button
          type="button"
          onClick={onClear}
          className="pb-2.5 text-[12px] font-bold text-[var(--brand-blue)] hover:underline"
        >
          Clear
        </button>
      )}
    </div>
  );
}
