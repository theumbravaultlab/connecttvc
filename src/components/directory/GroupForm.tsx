"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DAYS,
  GROUP_STATUSES,
  LIFE_STAGES,
  initialsOf,
  partyDisplayName,
  type Group,
  type Party,
  type Person,
  type Profile,
} from "@/lib/types";
import {
  Avatar,
  CapacityBar,
  ReadOnlyValue,
  SelectInput,
  StatusPill,
  TextArea,
  TextInput,
  Toggle,
} from "@/components/ui";
import { PlusIcon, SearchIcon, XIcon } from "@/components/icons";
import { spotsBadge } from "@/lib/colors";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { SectionHeading, Field } from "./form-bits";
import { EntityPicker } from "./EntityPicker";
import { AdminFooter } from "./AdminFooter";

export function GroupForm({
  group,
  parties,
  people,
  profiles,
  onPatch,
  onAssignParty,
  onUnassignParty,
}: {
  group: Group;
  parties: Party[];
  people: Person[];
  profiles: Profile[];
  onPatch: (patch: Partial<Group>) => void;
  onAssignParty: (party: Party) => void;
  onUnassignParty: (party: Party) => void;
}) {
  const router = useRouter();
  const roster = parties.filter((p) => p.group === group.id);
  const s = spotsBadge(group.members, group.capacity, group.status);
  const spotsLabel = s.open <= 0 ? "Group is full" : `${s.open} of ${group.capacity} spots open`;

  return (
    <div>
      {/* form header */}
      <div className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-fredoka)] text-[21px] font-semibold text-[var(--ink)]">
              {group.name || "Untitled group"}
            </h2>
            <p className="text-[12px] font-semibold text-[var(--faint)]">
              Editing group details
            </p>
          </div>
          <StatusPill status={group.status} />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1">
            <CapacityBar members={group.members} capacity={group.capacity} />
          </div>
          <span className="text-[12px] font-bold text-[var(--muted)]">
            {spotsLabel}
          </span>
        </div>
      </div>

      <SectionHeading>Basics</SectionHeading>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field full label="Group name">
          <TextInput
            value={group.name}
            onChange={(e) => onPatch({ name: e.target.value })}
          />
        </Field>
        <Field full label="Focus / topic">
          <TextInput
            value={group.topic}
            onChange={(e) => onPatch({ topic: e.target.value })}
          />
        </Field>
        <Field full label="Description">
          <TextArea
            value={group.desc}
            onChange={(e) => onPatch({ desc: e.target.value })}
          />
        </Field>
        <Field full label="Placement details" tag="Shown on the Finder card">
          <TextArea
            value={group.placementDetails}
            onChange={(e) => onPatch({ placementDetails: e.target.value })}
          />
        </Field>
      </div>

      <SectionHeading>When &amp; where</SectionHeading>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Meeting day" matching>
          <SelectInput
            value={group.day}
            onChange={(e) => onPatch({ day: e.target.value as Group["day"] })}
          >
            {DAYS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Time">
          <TextInput
            value={group.time}
            onChange={(e) => onPatch({ time: e.target.value })}
          />
        </Field>
        <Field label="Frequency">
          <SelectInput
            value={group.freq}
            onChange={(e) => onPatch({ freq: e.target.value as Group["freq"] })}
          >
            {["Weekly", "Every other week", "Monthly"].map((f) => (
              <option key={f}>{f}</option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Format">
          <SelectInput
            value={group.format}
            onChange={(e) => onPatch({ format: e.target.value as Group["format"] })}
          >
            {["In-person", "Hybrid", "Online"].map((f) => (
              <option key={f}>{f}</option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Meeting since">
          <TextInput
            value={group.startDate}
            onChange={(e) => onPatch({ startDate: e.target.value })}
          />
        </Field>
        <Field full label="Home address" tag="Members only">
          <AddressAutocomplete
            value={group.address}
            onChange={(address) => onPatch({ address })}
            onPlaceSelected={({ city }) => city && onPatch({ area: city })}
            placeholder="Start typing an address…"
          />
        </Field>
        <Field label="City" matching>
          <ReadOnlyValue value={group.area} placeholder="From address" />
        </Field>
      </div>

      <SectionHeading>Leadership</SectionHeading>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Host(s)">
          <TextInput
            value={group.host}
            onChange={(e) => onPatch({ host: e.target.value })}
          />
        </Field>
        <Field label="Mentor(s)">
          <TextInput
            value={group.mentor}
            onChange={(e) => onPatch({ mentor: e.target.value })}
          />
        </Field>
        <Field full label="Contact email">
          <TextInput
            type="email"
            value={group.contactEmail}
            onChange={(e) => onPatch({ contactEmail: e.target.value })}
          />
        </Field>
        <Field full label="Assigned to" tag="Point-person for this group — organizational only">
          <EntityPicker
            items={profiles}
            selectedId={group.assignedTo}
            getId={(p) => p.id}
            getLabel={(p) => p.fullName}
            searchPlaceholder="Search coordinators…"
            noMatchLabel="No coordinators match."
            onSelect={(assignedTo) => onPatch({ assignedTo })}
          />
        </Field>
      </div>

      <SectionHeading>Capacity &amp; fit</SectionHeading>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Life stage" matching>
          <SelectInput
            value={group.life}
            onChange={(e) => onPatch({ life: e.target.value as Group["life"] })}
          >
            {LIFE_STAGES.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Age range" matching>
          <TextInput
            value={group.ageRange}
            onChange={(e) => onPatch({ ageRange: e.target.value })}
          />
        </Field>
        <Field label="Max capacity">
          <TextInput
            type="number"
            min={1}
            value={group.capacity}
            onChange={(e) => {
              const capacity = Number(e.target.value) || 0;
              // Becoming full is a reason to close a group; becoming
              // *not* full again is deliberately not auto-reverted — by
              // then it may be closed for an unrelated reason, so
              // reopening stays a manual decision (via the Status field).
              onPatch(
                capacity > 0 && capacity === group.members
                  ? { capacity, status: "Closed" }
                  : { capacity },
              );
            }}
          />
        </Field>
        <Field label="Current members">
          <TextInput
            type="number"
            min={0}
            value={group.members}
            onChange={(e) => {
              const members = Number(e.target.value) || 0;
              onPatch(
                group.capacity > 0 && members === group.capacity
                  ? { members, status: "Closed" }
                  : { members },
              );
            }}
          />
        </Field>
        <Field full label="Childcare available" matching>
          <div className="flex items-center gap-2 pt-1">
            <Toggle
              on={group.childcare}
              onChange={(v) => onPatch({ childcare: v })}
              label="Childcare available"
            />
            <span className="text-[12px] font-semibold text-[var(--muted)]">
              {group.childcare ? "Yes" : "No"}
            </span>
          </div>
        </Field>
        <Field full label="Status">
          <SelectInput
            value={group.status}
            onChange={(e) => onPatch({ status: e.target.value as Group["status"] })}
          >
            {GROUP_STATUSES.map((s2) => (
              <option key={s2}>{s2}</option>
            ))}
          </SelectInput>
        </Field>
      </div>

      <SectionHeading>Assigned parties ({roster.length})</SectionHeading>
      <AddPartyToGroup
        groupId={group.id}
        parties={parties}
        people={people}
        onAssign={onAssignParty}
      />
      {roster.length === 0 ? (
        <p className="mt-2 text-[12.5px] font-semibold text-[var(--faint)]">
          No one is currently assigned to this group.
        </p>
      ) : (
        <div className="mt-2 flex flex-col gap-1.5">
          {roster.map((pt) => {
            const members = people.filter((p) => p.partyId === pt.id);
            return (
              <div
                key={pt.id}
                className="flex items-center gap-2.5 rounded-xl bg-[var(--panel-1)] px-3 py-2 transition-colors hover:bg-[var(--panel-2)]"
              >
                <button
                  type="button"
                  onClick={() => router.push(`/directory/parties/${pt.id}`)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  <Avatar initials={initialsOf(partyDisplayName(pt, members))} size={26} tone="muted" />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-[var(--ink)]">
                    {partyDisplayName(pt, members)}
                  </span>
                  <StatusPill status={pt.status} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUnassignParty(pt);
                  }}
                  aria-label={`Remove ${partyDisplayName(pt, members)} from this group`}
                  className="shrink-0 rounded-full p-1.5 text-[var(--faint)] transition-colors hover:bg-[var(--panel-4)] hover:text-[oklch(0.55_0.18_20)]"
                >
                  <XIcon width={13} height={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <SectionHeading>Record info</SectionHeading>
      <AdminFooter
        createdAt={group.createdAt}
        createdBy={group.createdBy}
        updatedAt={group.updatedAt}
        updatedBy={group.updatedBy}
      />
    </div>
  );
}

/** Search-to-add box for the "Assigned parties" roster — stays open across
 * multiple adds (unlike EntityPicker's collapse-on-select combobox), since
 * a coordinator is likely assigning more than one party to a group in one
 * sitting. Excludes parties already on this group's roster. */
function AddPartyToGroup({
  groupId,
  parties,
  people,
  onAssign,
}: {
  groupId: string;
  parties: Party[];
  people: Person[];
  onAssign: (party: Party) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const unassigned = parties.filter((p) => p.group !== groupId);
  const results = q
    ? unassigned
        .filter((p) => {
          const members = people.filter((m) => m.partyId === p.id);
          return partyDisplayName(p, members).toLowerCase().includes(q);
        })
        .slice(0, 8)
    : [];

  return (
    <div>
      <div className="relative">
        <SearchIcon
          width={14}
          height={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search parties to add…"
          className="w-full rounded-[9px] border border-[var(--border)] bg-[var(--panel-1)] py-2 pl-9 pr-3 text-[13px] font-semibold text-[var(--ink)] outline-none transition-colors focus:border-[var(--brand-blue)] focus:ring-2 focus:ring-[var(--brand-blue)]/30"
        />
      </div>
      {q && (
        <div className="mt-1.5 flex flex-col gap-1">
          {results.length === 0 ? (
            <p className="px-1 text-[12px] font-semibold text-[var(--faint)]">No parties match.</p>
          ) : (
            results.map((pt) => {
              const members = people.filter((m) => m.partyId === pt.id);
              return (
                <div
                  key={pt.id}
                  className="flex items-center gap-2.5 rounded-xl border border-[var(--divider)] px-3 py-2"
                >
                  <Avatar initials={initialsOf(partyDisplayName(pt, members))} size={24} tone="muted" />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-[var(--ink)]">
                    {partyDisplayName(pt, members)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onAssign(pt);
                      setQuery("");
                    }}
                    className="flex shrink-0 items-center gap-1 rounded-full border border-[var(--brand-blue-light)] px-2.5 py-1 text-[11.5px] font-bold text-[var(--brand-blue)] transition-colors hover:bg-[var(--panel-2)]"
                  >
                    <PlusIcon width={11} height={11} />
                    Add
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
