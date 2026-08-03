"use client";

import { Fragment } from "react";
import { useRouter } from "next/navigation";
import type { Group, Party, Person } from "@/lib/types";
import { initialsOf, partyDisplayName, partyMemberNames } from "@/lib/types";
import { Avatar, LifeTag, PartyTag, StatusPill } from "@/components/ui";
import { ChevronDownIcon, SearchIcon } from "@/components/icons";
import { formatDate } from "@/lib/format";

export function EmptyState({ label, hasFilters }: { label: "groups" | "parties"; hasFilters: boolean }) {
  return (
    <div className="mt-10 px-4 text-center text-[13px] font-semibold text-[var(--faint)]">
      {hasFilters
        ? `No ${label} match your search/filters.`
        : `No ${label} yet — click "New ${label === "groups" ? "group" : "party"}" to add one.`}
    </div>
  );
}

const th = "px-4 py-2 text-left text-[11px] font-extrabold uppercase tracking-wide text-[var(--faint)]";
const td = "px-4 py-2.5 text-[13px] font-semibold text-[var(--ink)]";

export type SortDir = "asc" | "desc";

/** A clickable `<th>` that reports which field it represents and toggles a
 * chevron for the active sort direction. Shared by GroupTable/PartyTable —
 * the only two consumers of a table header in this app, so this lives here
 * rather than in a separate file. */
function SortableHeader<F extends string>({
  field,
  label,
  sortField,
  sortDir,
  onSort,
}: {
  field: F;
  label: string;
  sortField: F;
  sortDir: SortDir;
  onSort: (field: F) => void;
}) {
  const active = field === sortField;
  return (
    <th className={th}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className="flex items-center gap-1 transition-colors hover:text-[var(--ink)]"
      >
        {label}
        <ChevronDownIcon
          width={11}
          height={11}
          className={active ? "text-[var(--ink)]" : "text-[var(--faint)] opacity-40"}
          style={{ transform: active && sortDir === "desc" ? "rotate(180deg)" : undefined }}
        />
      </button>
    </th>
  );
}

export type GroupSortField = "name" | "day" | "area" | "life" | "status" | "spots" | "assignedTo" | "createdAt";

const checkboxCellClass = "w-8 px-3 py-2.5";

function RowCheckbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onClick={(e) => e.stopPropagation()}
      onChange={onChange}
      aria-label="Select row"
      className="h-4 w-4 cursor-pointer accent-[var(--brand-blue)]"
    />
  );
}

export function GroupTable({
  groups,
  profileNames,
  sortField,
  sortDir,
  onSort,
  onSelect,
  selectedIds,
  onToggleOne,
  onToggleAll,
}: {
  groups: Group[];
  /** id -> display name, built once per list page from the shared
   * `profiles` list — keeps this table a dumb renderer that never itself
   * looks up a coordinator's name. */
  profileNames: Map<string, string>;
  sortField: GroupSortField;
  sortDir: SortDir;
  onSort: (field: GroupSortField) => void;
  onSelect: (id: string) => void;
  /** Multi-select for bulk actions — omit `onToggleOne` entirely to hide
   * the checkbox column (e.g. a future read-only usage of this table). */
  selectedIds?: Set<string>;
  onToggleOne?: (id: string) => void;
  onToggleAll?: () => void;
}) {
  const selectable = !!onToggleOne;
  const allSelected = selectable && groups.length > 0 && groups.every((g) => selectedIds?.has(g.id));
  return (
    <table className="w-full min-w-[860px] border-collapse">
      <thead className="sticky top-0 z-10 bg-[var(--surface)]">
        <tr className="border-b border-[var(--divider)]">
          {selectable && (
            <th className={checkboxCellClass}>
              <RowCheckbox checked={allSelected} onChange={() => onToggleAll?.()} />
            </th>
          )}
          <SortableHeader field="name" label="Name" sortField={sortField} sortDir={sortDir} onSort={onSort} />
          <SortableHeader field="day" label="Meeting Day" sortField={sortField} sortDir={sortDir} onSort={onSort} />
          <SortableHeader field="area" label="City" sortField={sortField} sortDir={sortDir} onSort={onSort} />
          <SortableHeader field="life" label="Life Stage" sortField={sortField} sortDir={sortDir} onSort={onSort} />
          <SortableHeader field="status" label="Status" sortField={sortField} sortDir={sortDir} onSort={onSort} />
          <SortableHeader field="spots" label="Spots Available" sortField={sortField} sortDir={sortDir} onSort={onSort} />
          <SortableHeader field="assignedTo" label="Assigned To" sortField={sortField} sortDir={sortDir} onSort={onSort} />
          <SortableHeader field="createdAt" label="Created On" sortField={sortField} sortDir={sortDir} onSort={onSort} />
        </tr>
      </thead>
      <tbody>
        {groups.map((g) => {
          const spots = Math.max(0, g.capacity - g.members);
          return (
            <tr
              key={g.id}
              onClick={() => onSelect(g.id)}
              className="cursor-pointer border-b border-[var(--panel-4)] transition-colors hover:bg-[var(--panel-1)]"
            >
              {selectable && (
                <td className={checkboxCellClass}>
                  <RowCheckbox checked={!!selectedIds?.has(g.id)} onChange={() => onToggleOne?.(g.id)} />
                </td>
              )}
              <td className={`${td} font-[family-name:var(--font-fredoka)] font-semibold`}>
                {g.name}
              </td>
              <td className={td}>{g.day}</td>
              <td className={td}>{g.area || "—"}</td>
              <td className={td}>
                <LifeTag life={g.life} />
              </td>
              <td className={td}>
                <StatusPill status={g.status} />
              </td>
              <td className={td}>
                {spots} of {g.capacity}
              </td>
              <td className={td}>{g.assignedTo ? (profileNames.get(g.assignedTo) ?? "—") : "—"}</td>
              <td className={td}>{g.createdAt ? formatDate(g.createdAt) : "—"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export type PartySortField = "name" | "area" | "life" | "status" | "assignedTo" | "createdAt";

export function PartyTable({
  parties,
  people,
  profileNames,
  sortField,
  sortDir,
  onSort,
  onSelect,
  selectedIds,
  onToggleOne,
  onToggleAll,
}: {
  parties: Party[];
  people: Person[];
  profileNames: Map<string, string>;
  sortField: PartySortField;
  sortDir: SortDir;
  onSort: (field: PartySortField) => void;
  onSelect: (id: string) => void;
  /** Multi-select for bulk actions — omit `onToggleOne` entirely to hide
   * the checkbox column. Only the party row itself is selectable, never an
   * individual member sub-row (bulk actions operate on parties). */
  selectedIds?: Set<string>;
  onToggleOne?: (id: string) => void;
  onToggleAll?: () => void;
}) {
  const router = useRouter();
  const selectable = !!onToggleOne;
  const allSelected = selectable && parties.length > 0 && parties.every((p) => selectedIds?.has(p.id));

  return (
    <table className="w-full min-w-[800px] border-collapse">
      <thead className="sticky top-0 z-10 bg-[var(--surface)]">
        <tr className="border-b border-[var(--divider)]">
          {selectable && (
            <th className={checkboxCellClass}>
              <RowCheckbox checked={allSelected} onChange={() => onToggleAll?.()} />
            </th>
          )}
          <SortableHeader field="name" label="Name" sortField={sortField} sortDir={sortDir} onSort={onSort} />
          <SortableHeader field="area" label="Home City" sortField={sortField} sortDir={sortDir} onSort={onSort} />
          <SortableHeader field="life" label="Life Stage" sortField={sortField} sortDir={sortDir} onSort={onSort} />
          <SortableHeader field="status" label="Status" sortField={sortField} sortDir={sortDir} onSort={onSort} />
          <SortableHeader field="assignedTo" label="Assigned To" sortField={sortField} sortDir={sortDir} onSort={onSort} />
          <SortableHeader field="createdAt" label="Created On" sortField={sortField} sortDir={sortDir} onSort={onSort} />
          <th className={th}></th>
        </tr>
      </thead>
      <tbody>
        {parties.map((pt) => {
          const members = people.filter((p) => p.partyId === pt.id);
          return (
            <Fragment key={pt.id}>
              <tr
                onClick={() => onSelect(pt.id)}
                className="cursor-pointer border-b border-[var(--panel-4)] transition-colors hover:bg-[var(--panel-1)]"
              >
                {selectable && (
                  <td className={checkboxCellClass}>
                    <RowCheckbox checked={!!selectedIds?.has(pt.id)} onChange={() => onToggleOne?.(pt.id)} />
                  </td>
                )}
                <td className={td}>
                  <span className="flex items-center gap-2">
                    <Avatar initials={initialsOf(partyDisplayName(pt, members))} size={24} tone="muted" />
                    <span className="flex flex-col">
                      <span className="flex items-center gap-1.5">
                        <span className="font-[family-name:var(--font-fredoka)] font-semibold">
                          {partyDisplayName(pt, members)}
                        </span>
                        <PartyTag partySize={members.length} />
                      </span>
                      {members.length > 1 && (
                        <span className="text-[11px] font-semibold text-[var(--faint)]">
                          {partyMemberNames(members)}
                        </span>
                      )}
                    </span>
                  </span>
                </td>
                <td className={td}>{pt.area || "—"}</td>
                <td className={td}>
                  <LifeTag life={pt.life} />
                </td>
                <td className={td}>
                  <StatusPill status={pt.status} />
                </td>
                <td className={td}>{pt.assignedTo ? (profileNames.get(pt.assignedTo) ?? "—") : "—"}</td>
                <td className={td}>{pt.createdAt ? formatDate(pt.createdAt) : "—"}</td>
                <td className={`${td} text-right`}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/?party=${pt.id}`);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-blue-light)] px-2.5 py-1 text-[11.5px] font-bold text-[var(--brand-blue)] transition-colors hover:bg-[var(--panel-2)]"
                  >
                    <SearchIcon width={11} height={11} />
                    Find for
                  </button>
                </td>
              </tr>
              {members.length > 1 &&
                members.map((m) => (
                  <tr
                    key={m.id}
                    onClick={() => onSelect(pt.id)}
                    className="cursor-pointer border-b border-[var(--panel-4)] bg-[var(--panel-1)] transition-colors hover:bg-[var(--panel-2)]"
                  >
                    {selectable && <td className={checkboxCellClass} />}
                    <td className={`${td} pl-11`}>
                      <span className="flex items-center gap-2">
                        <Avatar initials={initialsOf(m.name)} size={18} tone="muted" />
                        <span className="text-[12.5px] font-semibold">{m.name}</span>
                      </span>
                    </td>
                    <td colSpan={6} className={`${td} text-[12px] font-medium text-[var(--faint)]`}>
                      {[m.email, m.phone].filter(Boolean).join(" · ") || "No contact info on file"}
                    </td>
                  </tr>
                ))}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
