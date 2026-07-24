"use client";

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
  StatusPill,
  TextArea,
  TextInput,
  Toggle,
} from "@/components/ui";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { SectionHeading, Field } from "./form-bits";

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
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar initials={initialsOf(person.name)} size={40} />
          <div>
            <h2 className="font-[family-name:var(--font-fredoka)] text-[21px] font-semibold text-[#16324f]">
              {person.name || "New member"}
            </h2>
            <p className="text-[12px] font-semibold text-[#8aa0b4]">
              Group · {groupName}
            </p>
          </div>
        </div>
        <StatusPill status={person.status} />
      </div>

      <SectionHeading>Contact</SectionHeading>
      <div className="flex flex-wrap gap-3">
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

      <SectionHeading>Location &amp; availability</SectionHeading>
      <div className="flex flex-wrap gap-3">
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
        <Field full label="Available days">
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
        <Field label="Home area">
          <ReadOnlyValue value={person.area} placeholder="From address" />
        </Field>
      </div>

      <SectionHeading>Fit</SectionHeading>
      <div className="flex flex-wrap gap-3">
        <Field label="Life stage">
          <SelectInput
            value={person.life}
            onChange={(e) => onPatch({ life: e.target.value as Person["life"] })}
          >
            {LIFE_STAGES.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Childcare needed">
          <div className="flex items-center gap-2 pt-1">
            <Toggle
              on={person.childcareNeeded}
              onChange={(v) => onPatch({ childcareNeeded: v })}
              label="Childcare needed"
            />
            <span className="text-[12px] font-semibold text-[#5b7a97]">
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
      <div className="flex flex-wrap gap-3">
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
          <SelectInput
            value={person.group ?? ""}
            onChange={(e) => onPatch({ group: e.target.value || null })}
          >
            <option value="">— Unassigned —</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        {person.status === "Grouped" && person.group && (
          <div className="w-full rounded-xl bg-[#fdf9ef] px-3 py-2.5 text-[12px] font-semibold text-[#a9812f]">
            Tip: "Current members" on {groupName} is tracked separately — if
            this is a new permanent placement, update it on the Groups tab too.
          </div>
        )}
        <Field full label="Leader notes">
          <TextArea
            value={person.notes}
            onChange={(e) => onPatch({ notes: e.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}
