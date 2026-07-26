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
  hasFilters,
  onClear,
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
  hasFilters: boolean;
  onClear: () => void;
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
