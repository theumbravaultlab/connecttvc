"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon, EditIcon } from "@/components/icons";

/** Generic searchable single-select combobox — search input, click-outside/
 * Escape to close, capped-at-50 filtered results, an explicit "unassigned"
 * option, and an optional "View" link straight to the selected item's own
 * page. Originally built as PartyForm's one-off AssignedGroupPicker (for
 * picking a Party's assigned Group); generalized so the same component also
 * drives "Assigned to" pickers (picking a Profile) on both Group and Party
 * forms — every use so far is "pick one item from a flat list," just with
 * different item types and label accessors. */
export function EntityPicker<T>({
  items,
  selectedId,
  onSelect,
  getId,
  getLabel,
  getSubLabel,
  unassignedLabel = "— Unassigned —",
  searchPlaceholder = "Search…",
  noMatchLabel = "No matches.",
  viewHref,
}: {
  items: T[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  getSubLabel?: (item: T) => string | undefined;
  unassignedLabel?: string;
  searchPlaceholder?: string;
  noMatchLabel?: string;
  /** When provided, a "View" button appears next to the combobox once
   * something is selected, navigating straight to that item's own page. */
  viewHref?: (item: T) => string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = items.find((i) => getId(i) === selectedId) ?? null;
  const q = query.trim().toLowerCase();
  const filtered = (q ? items.filter((i) => getLabel(i).toLowerCase().includes(q)) : items).slice(0, 50);

  return (
    <div className="flex items-center gap-2">
      <div ref={rootRef} className="relative flex-1">
        <button
          type="button"
          onClick={() => (open ? close() : setOpen(true))}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-1.5 rounded-[9px] border border-[var(--border)] bg-[var(--panel-1)] px-3 py-2 text-[13px] font-semibold text-[var(--ink)] outline-none transition-colors focus:border-[var(--brand-blue)] focus:ring-2 focus:ring-[var(--brand-blue)]/30"
        >
          <span className={selected ? "truncate" : "truncate text-[var(--faint)]"}>
            {selected ? getLabel(selected) : unassignedLabel}
          </span>
          <ChevronDownIcon
            width={14}
            height={14}
            className="shrink-0 text-[var(--faint)] transition-transform"
            style={{ transform: open ? "rotate(180deg)" : undefined }}
          />
        </button>
        {open && (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-[9px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_8px_20px_rgba(22,50,79,.14)]">
            <div className="border-b border-[var(--divider)] p-2">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--panel-1)] px-2 py-1.5 text-[12px] font-semibold text-[var(--ink)] outline-none focus:border-[var(--brand-blue)]"
              />
            </div>
            <ul className="max-h-64 overflow-y-auto py-1">
              <li>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onSelect(null);
                    close();
                  }}
                  className="flex w-full items-center px-3 py-2 text-left text-[12.5px] font-semibold text-[var(--faint)] hover:bg-[var(--panel-2)]"
                >
                  {unassignedLabel}
                </button>
              </li>
              {filtered.map((item) => {
                const id = getId(item);
                const sub = getSubLabel?.(item);
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onSelect(id);
                        close();
                      }}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-[var(--panel-2)]"
                    >
                      <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[var(--ink)]">
                        {getLabel(item)}
                      </span>
                      {sub && (
                        <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-wide text-[var(--faint)]">
                          {sub}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
              {filtered.length === 0 && (
                <li className="px-3 py-2 text-[12px] font-semibold text-[var(--faint)]">{noMatchLabel}</li>
              )}
            </ul>
          </div>
        )}
      </div>
      {selected && viewHref && (
        <button
          type="button"
          onClick={() => router.push(viewHref(selected))}
          aria-label="View"
          className="flex shrink-0 items-center gap-1 rounded-full border border-[var(--brand-blue-light)] px-3 py-2 text-[12px] font-bold text-[var(--brand-blue)] transition-colors hover:bg-[var(--panel-2)]"
        >
          <EditIcon width={13} height={13} />
          View
        </button>
      )}
    </div>
  );
}
