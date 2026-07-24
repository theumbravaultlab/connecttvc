"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { initialsOf, type Person } from "@/lib/types";
import { Avatar, StatusPill } from "@/components/ui";
import { SearchIcon, XIcon } from "@/components/icons";

/**
 * Typeahead replacement for the old plain <select> — with 100+ people, a
 * flat alphabetical dropdown stopped being usable. Shows each match's
 * status pill right next to their name, both while searching and once
 * selected.
 */
export function PersonSearch({
  id,
  people,
  selected,
  onSelect,
  onClear,
}: {
  id?: string;
  people: Person[];
  selected: Person | null;
  onSelect: (id: string) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, []);

  const matches = query.trim()
    ? people
        .filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
        .slice(0, 8)
    : [];

  const handleSelect = (p: Person) => {
    onSelect(p.id);
    setQuery("");
    setOpen(false);
    setHighlighted(-1);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || matches.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && highlighted >= 0) {
      e.preventDefault();
      handleSelect(matches[highlighted]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-[9px] border-[1.5px] border-[#a3cbfc] bg-white py-1.5 pl-3 pr-1.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[12.5px] font-bold text-[#088df9]">
            {selected.name}
          </span>
          <StatusPill status={selected.status} />
        </span>
        <button
          onClick={onClear}
          className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold text-[#5b7a97] hover:bg-[#f2f6fb]"
        >
          <XIcon width={12} height={12} /> Change
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <SearchIcon
        width={14}
        height={14}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8aa0b4]"
      />
      <input
        id={id}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlighted(-1);
        }}
        onFocus={() => query.trim() && setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search for a person…"
        autoComplete="off"
        className="w-full rounded-[9px] border-[1.5px] border-[#a3cbfc] bg-white py-2 pl-8 pr-3 text-[12.5px] font-bold text-[#088df9] outline-none placeholder:text-[#8aa0b4] placeholder:font-semibold"
      />
      {open && matches.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-[9px] border border-[#dbe7f3] bg-white py-1 shadow-[0_8px_20px_rgba(22,50,79,.14)]">
          {matches.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(p)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left"
                style={{ background: i === highlighted ? "#f2f8ff" : "#fff" }}
              >
                <Avatar initials={initialsOf(p.name)} size={22} tone="muted" />
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[#16324f]">
                  {p.name}
                </span>
                <StatusPill status={p.status} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim() && matches.length === 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-[9px] border border-[#dbe7f3] bg-white px-3 py-2 text-[12px] font-semibold text-[#8aa0b4] shadow-[0_8px_20px_rgba(22,50,79,.14)]">
          No one matches "{query.trim()}".
        </div>
      )}
    </div>
  );
}
