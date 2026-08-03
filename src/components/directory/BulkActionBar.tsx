"use client";

import type { Profile } from "@/lib/types";

/** Shown above the table whenever 1+ rows are checked — GroupsListPage and
 * PartiesListPage both use this, generic over their own status enum the
 * same way ListFilterBar already is. Each select applies immediately on
 * change (same "no separate confirm step" convention as every other
 * status/assignment control in this app) and resets back to its
 * placeholder afterward, since it's a one-shot action, not a persistent
 * filter. */
export function BulkActionBar<TStatus extends string>({
  count,
  statusOptions,
  onSetStatus,
  profiles,
  onAssign,
  onClear,
  pending,
}: {
  count: number;
  statusOptions: readonly TStatus[];
  onSetStatus: (status: TStatus) => void;
  profiles: Profile[];
  onAssign: (assignedTo: string | null) => void;
  onClear: () => void;
  pending: boolean;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2.5 border-b border-[var(--divider)] bg-[var(--panel-2)] px-3 py-2 sm:px-[18px]">
      <span className="text-[12.5px] font-extrabold text-[var(--ink)]">
        {count} selected
      </span>
      <select
        disabled={pending}
        value=""
        onChange={(e) => {
          if (e.target.value) onSetStatus(e.target.value as TStatus);
          e.target.value = "";
        }}
        className="rounded-full border border-[var(--border)] bg-[var(--panel-1)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink)] outline-none disabled:opacity-50"
      >
        <option value="">Set status…</option>
        {statusOptions.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <select
        disabled={pending}
        value=""
        onChange={(e) => {
          if (e.target.value) onAssign(e.target.value === "unassigned" ? null : e.target.value);
          e.target.value = "";
        }}
        className="rounded-full border border-[var(--border)] bg-[var(--panel-1)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink)] outline-none disabled:opacity-50"
      >
        <option value="">Assign to…</option>
        <option value="unassigned">Unassigned</option>
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.fullName}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onClear}
        className="ml-auto text-[12px] font-bold text-[var(--brand-blue)] hover:underline"
      >
        Clear selection
      </button>
    </div>
  );
}
