"use client";

import { AREAS, DAYS, LIFE_STAGES, type Group } from "@/lib/types";
import {
  CapacityBar,
  FieldLabel,
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
  onPatch,
}: {
  group: Group;
  onPatch: (patch: Partial<Group>) => void;
}) {
  const s = spotsBadge(group.members, group.capacity);
  const spotsLabel = s.open <= 0 ? "Group is full" : `${s.open} of ${group.capacity} spots open`;

  return (
    <div>
      {/* form header */}
      <div className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-fredoka)] text-[21px] font-semibold text-[#16324f]">
              {group.name || "Untitled group"}
            </h2>
            <p className="text-[12px] font-semibold text-[#8aa0b4]">
              Editing group details
            </p>
          </div>
          <StatusPill status={group.status} />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1">
            <CapacityBar members={group.members} capacity={group.capacity} />
          </div>
          <span className="text-[11.5px] font-bold text-[#5b7a97]">
            {spotsLabel}
          </span>
        </div>
      </div>

      <SectionHeading>Basics</SectionHeading>
      <div className="flex flex-wrap gap-3">
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
      </div>

      <SectionHeading>When &amp; where</SectionHeading>
      <div className="flex flex-wrap gap-3">
        <Field label="Meeting day">
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
        <Field label="Area">
          <SelectInput
            value={group.area}
            onChange={(e) => onPatch({ area: e.target.value })}
          >
            {AREAS.map((a) => (
              <option key={a}>{a}</option>
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
            placeholder="Start typing an address…"
          />
        </Field>
      </div>

      <SectionHeading>Leadership</SectionHeading>
      <div className="flex flex-wrap gap-3">
        <Field label="Host(s)">
          <TextInput
            value={group.host}
            onChange={(e) => onPatch({ host: e.target.value })}
          />
        </Field>
        <Field label="Co-leader">
          <TextInput
            value={group.coHost}
            onChange={(e) => onPatch({ coHost: e.target.value })}
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
      <div className="flex flex-wrap gap-3">
        <Field label="Life stage">
          <SelectInput
            value={group.life}
            onChange={(e) => onPatch({ life: e.target.value as Group["life"] })}
          >
            {LIFE_STAGES.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Age range">
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
            onChange={(e) => onPatch({ capacity: Number(e.target.value) || 0 })}
          />
        </Field>
        <Field label="Current members">
          <TextInput
            type="number"
            min={0}
            value={group.members}
            onChange={(e) => onPatch({ members: Number(e.target.value) || 0 })}
          />
        </Field>
        <Field full label="Childcare available">
          <div className="flex items-center gap-2 pt-1">
            <Toggle
              on={group.childcare}
              onChange={(v) => onPatch({ childcare: v })}
              label="Childcare available"
            />
            <span className="text-[12px] font-semibold text-[#5b7a97]">
              {group.childcare ? "Yes" : "No"}
            </span>
          </div>
        </Field>
        <Field full label="Status">
          <SelectInput
            value={group.status}
            onChange={(e) => onPatch({ status: e.target.value as Group["status"] })}
          >
            {["Active", "Forming", "Paused", "Full"].map((s2) => (
              <option key={s2}>{s2}</option>
            ))}
          </SelectInput>
        </Field>
      </div>
    </div>
  );
}
