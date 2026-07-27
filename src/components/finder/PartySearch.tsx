"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  PARTY_STATUSES,
  initialsOf,
  partyDisplayName,
  partyMemberNames,
  type Party,
  type PartyStatus,
  type Person,
} from "@/lib/types";
import { Avatar, PartyTag, StatusPill } from "@/components/ui";
import { SearchIcon, XIcon } from "@/components/icons";

/**
 * Typeahead lookup for "Finding for" — matches a party by its own name
 * ("The Griers") *or* by any member's name ("Will Grier"), landing on the
 * party either way. Shows each match's status pill and, when it has more
 * than one member, a "Will Grier & Sarah Grier" subline so it's obvious
 * who's actually in the party you just found. Opens on focus/click even
 * with no query typed yet, so a coordinator can browse everyone rather
 * than needing a name in mind, and offers a status filter to narrow that
 * browse list.
 */
export function PartySearch({
  id,
  parties,
  people,
  selected,
  onSelect,
  onClear,
}: {
  id?: string;
  parties: Party[];
  people: Person[];
  selected: Party | null;
  onSelect: (id: string) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [statusFilter, setStatusFilter] = useState<PartyStatus | "All">("All");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, []);

  const membersByParty = useMemo(() => {
    const map = new Map<string, Person[]>();
    for (const person of people) {
      const list = map.get(person.partyId) ?? [];
      list.push(person);
      map.set(person.partyId, list);
    }
    return map;
  }, [people]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return parties
      .filter((p) => statusFilter === "All" || p.status === statusFilter)
      .map((p) => ({ party: p, members: membersByParty.get(p.id) ?? [] }))
      .filter(
        ({ party, members }) =>
          !q ||
          partyDisplayName(party, members).toLowerCase().includes(q) ||
          members.some((m) => m.name.toLowerCase().includes(q)),
      )
      .sort((a, b) => partyDisplayName(a.party, a.members).localeCompare(partyDisplayName(b.party, b.members)))
      .slice(0, 50);
  }, [parties, membersByParty, query, statusFilter]);

  const handleSelect = (party: Party) => {
    onSelect(party.id);
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
      handleSelect(matches[highlighted].party);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  if (selected) {
    const selectedMembers = membersByParty.get(selected.id) ?? [];
    return (
      <div className="flex items-center justify-between gap-2 rounded-[9px] border-[1.5px] border-[var(--brand-blue-light)] bg-[var(--surface)] py-1.5 pl-3 pr-1.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[13px] font-bold text-[var(--brand-blue)]">
            {partyDisplayName(selected, selectedMembers)}
          </span>
          <PartyTag partySize={selectedMembers.length} />
          <StatusPill status={selected.status} />
        </span>
        <button
          onClick={onClear}
          className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold text-[var(--muted)] hover:bg-[var(--panel-4)]"
        >
          <XIcon width={12} height={12} /> Change
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          inputRef.current?.focus();
        }}
        aria-label="Browse all parties"
        className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]"
      >
        <SearchIcon width={14} height={14} />
      </button>
      <input
        id={id}
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlighted(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search for a party or person…"
        autoComplete="off"
        className="w-full rounded-[9px] border-[1.5px] border-[var(--brand-blue-light)] bg-[var(--surface)] py-2 pl-8 pr-3 text-[13px] font-bold text-[var(--brand-blue)] outline-none placeholder:text-[var(--faint)] placeholder:font-semibold"
      />
      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-[9px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_8px_20px_rgba(22,50,79,.14)]">
          <div className="flex items-center gap-2 border-b border-[var(--divider)] bg-[var(--panel-1)] px-2.5 py-1.5">
            <label className="shrink-0 text-[10px] font-extrabold uppercase tracking-wide text-[var(--faint)]">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as PartyStatus | "All")}
              className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-1.5 py-1 text-[11px] font-semibold text-[var(--ink)] outline-none focus:border-[var(--brand-blue)] focus:ring-2 focus:ring-[var(--brand-blue)]/30"
            >
              <option value="All">All statuses</option>
              {PARTY_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          {matches.length > 0 ? (
            <ul className="max-h-64 overflow-y-auto py-1">
              {matches.map(({ party, members }, i) => (
                <li key={party.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(party)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left"
                    style={{ background: i === highlighted ? "var(--panel-2)" : "var(--surface)" }}
                  >
                    <Avatar initials={initialsOf(partyDisplayName(party, members))} size={22} tone="muted" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[13px] font-semibold text-[var(--ink)]">
                        {partyDisplayName(party, members)}
                      </span>
                      {members.length > 1 && (
                        <span className="truncate text-[11px] font-semibold text-[var(--faint)]">
                          {partyMemberNames(members)}
                        </span>
                      )}
                    </span>
                    <PartyTag partySize={members.length} />
                    <StatusPill status={party.status} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-3 py-2 text-[12px] font-semibold text-[var(--faint)]">
              {query.trim()
                ? `No one matches "${query.trim()}".`
                : "No parties match this status."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
