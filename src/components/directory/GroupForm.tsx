"use client";

import { useRouter } from "next/navigation";
import {
  DAYS,
  GROUP_STATUSES,
  LIFE_STAGES,
  displayName,
  initialsOf,
  type Group,
  type Person,
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
import { spotsBadge } from "@/lib/colors";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { SectionHeading, Field } from "./form-bits";

export function GroupForm({
  group,
  people,
  onPatch,
}: {
  group: Group;
  people: Person[];
  onPatch: (patch: Partial<Group>) => void;
}) {
  const router = useRouter();
  const roster = people.filter((p) => p.group === group.id);
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

      <SectionHeading>Assigned people ({roster.length})</SectionHeading>
      {roster.length === 0 ? (
        <p className="text-[12.5px] font-semibold text-[var(--faint)]">
          No one is currently assigned to this group.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {roster.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => router.push(`/directory/people/${p.id}`)}
              className="flex items-center gap-2.5 rounded-xl bg-[var(--panel-1)] px-3 py-2 text-left transition-colors hover:bg-[var(--panel-2)]"
            >
              <Avatar initials={initialsOf(displayName(p))} size={26} tone="muted" />
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-[var(--ink)]">
                {displayName(p)}
              </span>
              <StatusPill status={p.status} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
