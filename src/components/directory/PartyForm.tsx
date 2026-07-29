"use client";

import { useState } from "react";
import {
  LIFE_STAGES,
  PARTY_STATUSES,
  initialsOf,
  partyDisplayName,
  partyMemberNames,
  type DayShort,
  type Group,
  type Party,
  type Person,
  type Profile,
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
import { PlusIcon } from "@/components/icons";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { SectionHeading, Field } from "./form-bits";
import { ContactLog } from "./ContactLog";
import { PlacementHistory } from "./PlacementHistory";
import { EntityPicker } from "./EntityPicker";
import { AdminFooter } from "./AdminFooter";

export function PartyForm({
  party,
  members,
  groups,
  profiles,
  onPatch,
  onAddMember,
  onUpdateMember,
  onRemoveMember,
}: {
  party: Party;
  members: Person[];
  groups: Group[];
  profiles: Profile[];
  onPatch: (patch: Partial<Party>) => void;
  onAddMember: () => void;
  onUpdateMember: (id: string, patch: Partial<Person>) => void;
  onRemoveMember: (id: string) => void;
}) {
  const groupName = groups.find((g) => g.id === party.group)?.name ?? "Unassigned";
  const [removeCandidate, setRemoveCandidate] = useState<Person | null>(null);

  const toggleDay = (d: DayShort) =>
    onPatch({
      days: party.days.includes(d)
        ? party.days.filter((x) => x !== d)
        : [...party.days, d],
    });

  return (
    <div>
      {/* form header */}
      <div className="mb-4 flex items-center gap-3">
        <Avatar initials={initialsOf(partyDisplayName(party, members))} size={40} />
        <div>
          <h2 className="font-[family-name:var(--font-fredoka)] text-[21px] font-semibold text-[var(--ink)]">
            {partyDisplayName(party, members) || "New party"}
          </h2>
          <p className="text-[12px] font-semibold text-[var(--faint)]">
            {members.length > 1 ? `${partyMemberNames(members)} · ` : ""}
            Group · {groupName}
          </p>
        </div>
      </div>

      <SectionHeading>Members</SectionHeading>
      <Field full label="Party name" tag="What shows up in search for a party of 2+">
        <TextInput
          value={party.partyName}
          placeholder="e.g. The Griers"
          onChange={(e) => onPatch({ partyName: e.target.value })}
        />
      </Field>
      <div className="mt-3 flex flex-col gap-2">
        {members.map((m) => (
          <div key={m.id} className="rounded-xl bg-[var(--panel-1)] p-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <TextInput
                value={m.name}
                placeholder="Name"
                onChange={(e) => onUpdateMember(m.id, { name: e.target.value })}
              />
              <TextInput
                type="email"
                value={m.email}
                placeholder="Email"
                onChange={(e) => onUpdateMember(m.id, { email: e.target.value })}
              />
              <TextInput
                type="tel"
                value={m.phone}
                placeholder="Phone"
                onChange={(e) => onUpdateMember(m.id, { phone: e.target.value })}
              />
            </div>
            <button
              type="button"
              disabled={members.length === 1}
              onClick={() => setRemoveCandidate(m)}
              title={members.length === 1 ? "A party needs at least one member — delete the whole party instead" : undefined}
              className={
                members.length === 1
                  ? "mt-2 cursor-not-allowed text-[11.5px] font-bold text-[var(--faint)]"
                  : "mt-2 text-[11.5px] font-bold text-[oklch(0.55_0.18_20)] hover:underline"
              }
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onAddMember}
        className="mt-2 flex items-center gap-1.5 rounded-full border border-[var(--brand-blue-light)] px-3 py-1.5 text-[12.5px] font-bold text-[var(--brand-blue)] transition-colors hover:bg-[var(--panel-2)]"
      >
        <PlusIcon width={13} height={13} />
        Add member
      </button>

      <SectionHeading>Location &amp; availability</SectionHeading>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Time preference">
          <SelectInput
            value={party.timePref}
            onChange={(e) =>
              onPatch({ timePref: e.target.value as Party["timePref"] })
            }
          >
            {["Mornings", "Afternoons", "Evenings", "Flexible"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </SelectInput>
        </Field>
        <Field full label="Available days" matching>
          <div className="pt-1">
            <DayPills value={party.days} onToggle={toggleDay} />
          </div>
        </Field>
        <Field full label="Home address" tag="Members only">
          <AddressAutocomplete
            value={party.address}
            onChange={(address) => onPatch({ address })}
            onPlaceSelected={({ city }) => city && onPatch({ area: city })}
            placeholder="Start typing an address…"
          />
        </Field>
        <Field label="Home city" matching>
          <ReadOnlyValue value={party.area} placeholder="From address" />
        </Field>
      </div>

      <SectionHeading>Fit</SectionHeading>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Life stage" matching>
          <SelectInput
            value={party.life}
            onChange={(e) => onPatch({ life: e.target.value as Party["life"] })}
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
            value={party.age ?? ""}
            onChange={(e) => onPatch({ age: e.target.value ? Number(e.target.value) : null })}
          />
        </Field>
        <Field label="Childcare needed" matching>
          <div className="flex items-center gap-2 pt-1">
            <Toggle
              on={party.childcareNeeded}
              onChange={(v) => onPatch({ childcareNeeded: v })}
              label="Childcare needed"
            />
            <span className="text-[12px] font-semibold text-[var(--muted)]">
              {party.childcareNeeded ? "Yes" : "No"}
            </span>
          </div>
        </Field>
        <Field full label="Interests">
          <TextInput
            value={party.interests}
            onChange={(e) => onPatch({ interests: e.target.value })}
          />
        </Field>
        <Field full label="Accessibility needs">
          <TextInput
            value={party.accessibility}
            onChange={(e) => onPatch({ accessibility: e.target.value })}
          />
        </Field>
      </div>

      <SectionHeading>Assignment</SectionHeading>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Status">
          <SelectInput
            value={party.status}
            onChange={(e) =>
              onPatch({ status: e.target.value as Party["status"] })
            }
          >
            {PARTY_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Member since">
          <TextInput
            value={party.joined}
            onChange={(e) => onPatch({ joined: e.target.value })}
          />
        </Field>
        <Field full label="Assigned group">
          <EntityPicker
            items={groups}
            selectedId={party.group}
            getId={(g) => g.id}
            getLabel={(g) => g.name}
            getSubLabel={(g) => g.area || "Group"}
            searchPlaceholder="Search groups…"
            noMatchLabel="No groups match."
            viewHref={(g) => `/directory/groups/${g.id}`}
            onSelect={(group) =>
              // Assigning a group auto-sets status to Grouped; clearing it
              // back to Unassigned auto-reverts to Actively Searching —
              // either way still just a starting point, freely editable
              // via the Status field above.
              onPatch({ group, status: group ? "Grouped" : "Actively Searching" })
            }
          />
        </Field>
        <Field full label="Assigned to" tag="Point-person for this party — organizational only">
          <EntityPicker
            items={profiles}
            selectedId={party.assignedTo}
            getId={(p) => p.id}
            getLabel={(p) => p.fullName}
            searchPlaceholder="Search coordinators…"
            noMatchLabel="No coordinators match."
            onSelect={(assignedTo) => onPatch({ assignedTo })}
          />
        </Field>
        <Field full label="Leader notes">
          <TextArea
            value={party.notes}
            onChange={(e) => onPatch({ notes: e.target.value })}
          />
        </Field>
      </div>

      <SectionHeading>Placement history</SectionHeading>
      <PlacementHistory partyId={party.id} />

      <SectionHeading>Outreach</SectionHeading>
      <ContactLog partyId={party.id} />

      <SectionHeading>Record info</SectionHeading>
      <AdminFooter
        createdAt={party.createdAt}
        createdBy={party.createdBy}
        updatedAt={party.updatedAt}
        updatedBy={party.updatedBy}
      />

      <ConfirmDialog
        open={removeCandidate != null}
        title={`Remove ${removeCandidate?.name.trim() || "this member"}?`}
        message="This can't be undone — they'll be permanently removed from this party."
        confirmLabel="Remove"
        onConfirm={() => {
          if (removeCandidate) onRemoveMember(removeCandidate.id);
          setRemoveCandidate(null);
        }}
        onCancel={() => setRemoveCandidate(null)}
      />
    </div>
  );
}

