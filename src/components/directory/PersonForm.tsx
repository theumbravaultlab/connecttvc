"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LIFE_STAGES,
  PERSON_STATUSES,
  initialsOf,
  type DayShort,
  type Group,
  type Person,
} from "@/lib/types";
import {
  Avatar,
  DayPills,
  ReadOnlyValue,
  SelectInput,
  TextArea,
  TextInput,
  Toggle,
} from "@/components/ui";
import { ChevronDownIcon, EditIcon } from "@/components/icons";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { SectionHeading, Field } from "./form-bits";
import { ContactLog } from "./ContactLog";

export function PersonForm({
  person,
  groups,
  onPatch,
}: {
  person: Person;
  groups: Group[];
  onPatch: (patch: Partial<Person>) => void;
}) {
  const groupName =
    groups.find((g) => g.id === person.group)?.name ?? "Unassigned";

  const toggleDay = (d: DayShort) =>
    onPatch({
      days: person.days.includes(d)
        ? person.days.filter((x) => x !== d)
        : [...person.days, d],
    });

  return (
    <div>
      {/* form header */}
      <div className="mb-4 flex items-center gap-3">
        <Avatar initials={initialsOf(person.name)} size={40} />
        <div>
          <h2 className="font-[family-name:var(--font-fredoka)] text-[21px] font-semibold text-[var(--ink)]">
            {person.name || "New member"}
          </h2>
          <p className="text-[12px] font-semibold text-[var(--faint)]">
            Group · {groupName}
          </p>
        </div>
      </div>

      <SectionHeading>Contact</SectionHeading>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field full label="Full name">
          <TextInput
            value={person.name}
            onChange={(e) => onPatch({ name: e.target.value })}
          />
        </Field>
        <Field label="Email">
          <TextInput
            type="email"
            value={person.email}
            onChange={(e) => onPatch({ email: e.target.value })}
          />
        </Field>
        <Field label="Phone">
          <TextInput
            type="tel"
            value={person.phone}
            onChange={(e) => onPatch({ phone: e.target.value })}
          />
        </Field>
      </div>

      <SectionHeading>Household</SectionHeading>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Party size" tag="How many spots they need">
          <TextInput
            type="number"
            min={1}
            value={person.partySize}
            onChange={(e) =>
              onPatch({ partySize: Math.max(1, Number(e.target.value) || 1) })
            }
          />
        </Field>
        <Field label="Partner name" tag="If searching together">
          <TextInput
            value={person.partnerName}
            placeholder="e.g. Sarah Smith"
            onChange={(e) => onPatch({ partnerName: e.target.value })}
          />
        </Field>
      </div>

      <SectionHeading>Location &amp; availability</SectionHeading>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Time preference">
          <SelectInput
            value={person.timePref}
            onChange={(e) =>
              onPatch({ timePref: e.target.value as Person["timePref"] })
            }
          >
            {["Mornings", "Afternoons", "Evenings", "Flexible"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </SelectInput>
        </Field>
        <Field full label="Available days" matching>
          <div className="pt-1">
            <DayPills value={person.days} onToggle={toggleDay} />
          </div>
        </Field>
        <Field full label="Home address" tag="Members only">
          <AddressAutocomplete
            value={person.address}
            onChange={(address) => onPatch({ address })}
            onPlaceSelected={({ city }) => city && onPatch({ area: city })}
            placeholder="Start typing an address…"
          />
        </Field>
        <Field label="Home city" matching>
          <ReadOnlyValue value={person.area} placeholder="From address" />
        </Field>
      </div>

      <SectionHeading>Fit</SectionHeading>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Life stage" matching>
          <SelectInput
            value={person.life}
            onChange={(e) => onPatch({ life: e.target.value as Person["life"] })}
          >
            {LIFE_STAGES.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Age" matching>
          <TextInput
            type="number"
            min={0}
            max={120}
            value={person.age ?? ""}
            onChange={(e) => onPatch({ age: e.target.value ? Number(e.target.value) : null })}
          />
        </Field>
        <Field label="Childcare needed" matching>
          <div className="flex items-center gap-2 pt-1">
            <Toggle
              on={person.childcareNeeded}
              onChange={(v) => onPatch({ childcareNeeded: v })}
              label="Childcare needed"
            />
            <span className="text-[12px] font-semibold text-[var(--muted)]">
              {person.childcareNeeded ? "Yes" : "No"}
            </span>
          </div>
        </Field>
        <Field full label="Interests">
          <TextInput
            value={person.interests}
            onChange={(e) => onPatch({ interests: e.target.value })}
          />
        </Field>
        <Field full label="Accessibility needs">
          <TextInput
            value={person.accessibility}
            onChange={(e) => onPatch({ accessibility: e.target.value })}
          />
        </Field>
      </div>

      <SectionHeading>Assignment</SectionHeading>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Status">
          <SelectInput
            value={person.status}
            onChange={(e) =>
              onPatch({ status: e.target.value as Person["status"] })
            }
          >
            {PERSON_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Member since">
          <TextInput
            value={person.joined}
            onChange={(e) => onPatch({ joined: e.target.value })}
          />
        </Field>
        <Field full label="Assigned group">
          <AssignedGroupPicker
            groups={groups}
            selectedId={person.group}
            onSelect={(group) =>
              // Assigning a group auto-sets status to Grouped; clearing it
              // back to Unassigned auto-reverts to Actively Searching —
              // either way still just a starting point, freely editable
              // via the Status field above.
              onPatch({ group, status: group ? "Grouped" : "Actively Searching" })
            }
          />
        </Field>
        <Field full label="Leader notes">
          <TextArea
            value={person.notes}
            onChange={(e) => onPatch({ notes: e.target.value })}
          />
        </Field>
      </div>

      <SectionHeading>Outreach</SectionHeading>
      <ContactLog personId={person.id} />
    </div>
  );
}

/** Searchable dropdown lookup for Assigned Group (same idiom as the
 * City/Group search on the Map), plus a "View" link straight to that
 * group's own edit page once one is set. */
function AssignedGroupPicker({
  groups,
  selectedId,
  onSelect,
}: {
  groups: Group[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
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

  const selected = groups.find((g) => g.id === selectedId) ?? null;
  const q = query.trim().toLowerCase();
  const filtered = (q ? groups.filter((g) => g.name.toLowerCase().includes(q)) : groups).slice(0, 50);

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
            {selected ? selected.name : "— Unassigned —"}
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
                placeholder="Search groups…"
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
                  — Unassigned —
                </button>
              </li>
              {filtered.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onSelect(g.id);
                      close();
                    }}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-[var(--panel-2)]"
                  >
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[var(--ink)]">
                      {g.name}
                    </span>
                    <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-wide text-[var(--faint)]">
                      {g.area || "Group"}
                    </span>
                  </button>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="px-3 py-2 text-[12px] font-semibold text-[var(--faint)]">
                  No groups match.
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
      {selected && (
        <button
          type="button"
          onClick={() => router.push(`/directory/groups/${selected.id}`)}
          aria-label="View assigned group"
          className="flex shrink-0 items-center gap-1 rounded-full border border-[var(--brand-blue-light)] px-3 py-2 text-[12px] font-bold text-[var(--brand-blue)] transition-colors hover:bg-[var(--panel-2)]"
        >
          <EditIcon width={13} height={13} />
          View
        </button>
      )}
    </div>
  );
}
