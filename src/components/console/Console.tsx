"use client";

import { useState, useTransition } from "react";
import type { Group, Person } from "@/lib/types";
import { initialsOf } from "@/lib/types";
import { saveGroup, savePerson } from "@/app/actions";
import {
  Avatar,
  CapacityBar,
  StatusPill,
} from "@/components/ui";
import { ChevronLeftIcon, PlusIcon } from "@/components/icons";
import { GroupForm } from "./GroupForm";
import { PersonForm } from "./PersonForm";

type Tab = "groups" | "people";

const blankGroup = (id: string): Group => ({
  id, name: "New Home Group", day: "Tue", time: "7:00 PM", area: "Eastside",
  host: "", coHost: "—", life: "Everyone", status: "Forming", format: "In-person",
  freq: "Weekly", capacity: 12, members: 0, childcare: false, topic: "",
  ageRange: "All ages", startDate: "", contactEmail: "", address: "", desc: "",
});

const blankPerson = (id: string): Person => ({
  id, name: "New Member", email: "", phone: "", area: "Eastside", days: [],
  timePref: "Flexible", life: "Everyone", interests: "", childcareNeeded: false,
  accessibility: "—", status: "Unassigned", group: null, joined: "", notes: "",
});

export function Console({
  initialGroups,
  initialPeople,
  persisted,
}: {
  initialGroups: Group[];
  initialPeople: Person[];
  persisted: boolean;
}) {
  const [tab, setTab] = useState<Tab>("groups");
  const [groups, setGroups] = useState(initialGroups);
  const [people, setPeople] = useState(initialPeople);
  const [selGroupId, setSelGroupId] = useState(initialGroups[0]?.id ?? null);
  const [selPersonId, setSelPersonId] = useState(initialPeople[0]?.id ?? null);
  const [saved, setSaved] = useState(false);
  const [mobileSub, setMobileSub] = useState<"list" | "edit">("list");
  const [, startTransition] = useTransition();

  const changeTab = (t: Tab) => {
    setTab(t);
    setMobileSub("list");
  };
  const selectGroup = (id: string) => {
    setSelGroupId(id);
    setMobileSub("edit");
  };
  const selectPerson = (id: string) => {
    setSelPersonId(id);
    setMobileSub("edit");
  };

  const selGroup = groups.find((g) => g.id === selGroupId) ?? null;
  const selPerson = people.find((p) => p.id === selPersonId) ?? null;

  const patchGroup = (patch: Partial<Group>) =>
    setGroups((gs) =>
      gs.map((g) => (g.id === selGroupId ? { ...g, ...patch } : g)),
    );
  const patchPerson = (patch: Partial<Person>) =>
    setPeople((ps) =>
      ps.map((p) => (p.id === selPersonId ? { ...p, ...patch } : p)),
    );

  const addGroup = () => {
    const g = blankGroup(`new-${Date.now()}`);
    setGroups((gs) => [g, ...gs]);
    setSelGroupId(g.id);
    setTab("groups");
    setMobileSub("edit");
  };
  const addPerson = () => {
    const p = blankPerson(`new-${Date.now()}`);
    setPeople((ps) => [p, ...ps]);
    setSelPersonId(p.id);
    setTab("people");
    setMobileSub("edit");
  };

  const flashSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleSave = () => {
    flashSaved();
    startTransition(async () => {
      if (tab === "groups" && selGroup) await saveGroup(selGroup);
      if (tab === "people" && selPerson) await savePerson(selPerson);
    });
  };

  return (
    <>
      {/* tab bar */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#eef3f8] px-3 py-2.5 sm:px-[18px] sm:py-3">
        <div className="flex rounded-full bg-[#f2f6fb] p-1">
          {(["groups", "people"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => changeTab(t)}
              className="rounded-full px-4 py-1.5 text-[12.5px] font-bold transition-colors"
              style={
                tab === t
                  ? { background: "#fff", color: "#088df9", boxShadow: "0 1px 2px rgba(22,50,79,.08)" }
                  : { background: "transparent", color: "#5b7a97" }
              }
            >
              {t === "groups" ? "Home Groups" : "People"}
            </button>
          ))}
        </div>
        <button
          onClick={tab === "groups" ? addGroup : addPerson}
          className="flex items-center gap-1.5 rounded-full border border-[#a3cbfc] px-3.5 py-1.5 text-[12.5px] font-bold text-[#088df9] transition-colors hover:bg-[#f2f8ff]"
        >
          <PlusIcon width={15} height={15} />
          {tab === "groups" ? "New group" : "New person"}
        </button>
      </div>

      {/* body */}
      <div className="flex h-full min-h-0 flex-1 flex-col md:flex-row">
        {/* list column */}
        <div
          className={`${mobileSub === "list" ? "flex" : "hidden"} min-h-0 w-full flex-1 flex-col md:flex md:w-[320px] md:flex-none md:border-r md:border-[#eef3f8] lg:w-[342px]`}
        >
          <div className="shrink-0 px-4 py-3 text-[11.5px] font-extrabold uppercase tracking-wide text-[#8aa0b4]">
            {tab === "groups"
              ? `${groups.length} groups`
              : `${people.length} people`}
          </div>
          <div className="hw-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            <div className="flex flex-col gap-[9px]">
              {tab === "groups"
                ? groups.map((g) => (
                    <GroupRow
                      key={g.id}
                      group={g}
                      selected={g.id === selGroupId}
                      onClick={() => selectGroup(g.id)}
                    />
                  ))
                : people.map((p) => (
                    <PersonRow
                      key={p.id}
                      person={p}
                      groupName={
                        groups.find((g) => g.id === p.group)?.name ?? "Unassigned"
                      }
                      selected={p.id === selPersonId}
                      onClick={() => selectPerson(p.id)}
                    />
                  ))}
            </div>
          </div>
        </div>

        {/* edit column */}
        <div
          className={`${mobileSub === "edit" ? "flex" : "hidden"} min-h-0 w-full flex-1 flex-col md:flex`}
        >
          {!persisted && (
            <div className="shrink-0 border-b border-[#f2e6c9] bg-[#fdf9ef] px-4 py-2 text-[11.5px] font-bold text-[#a9812f] sm:px-6">
              Demo mode — edits stay in this session. Add Supabase keys to persist.
            </div>
          )}
          <button
            onClick={() => setMobileSub("list")}
            className="flex shrink-0 items-center gap-1 px-4 pt-4 text-[12.5px] font-bold text-[#088df9] md:hidden"
          >
            <ChevronLeftIcon width={16} height={16} />
            Back to {tab === "groups" ? "groups" : "people"}
          </button>
          <div className="hw-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
            {tab === "groups" && selGroup && (
              <GroupForm group={selGroup} onPatch={patchGroup} />
            )}
            {tab === "people" && selPerson && (
              <PersonForm
                person={selPerson}
                groups={groups}
                onPatch={patchPerson}
              />
            )}
          </div>
          {/* save bar */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#eef3f8] px-4 py-3 sm:px-6">
            <span className="hidden text-[11.5px] font-semibold text-[#8aa0b4] sm:inline">
              Edits apply to the live list instantly.
            </span>
            <button
              onClick={handleSave}
              className="ml-auto rounded-full px-5 py-2 text-[12.5px] font-bold text-white transition-colors"
              style={{ background: saved ? "oklch(0.6 0.13 150)" : "#088df9" }}
            >
              {saved ? "✓ Saved" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function GroupRow({
  group,
  selected,
  onClick,
}: {
  group: Group;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl px-3.5 py-3 text-left transition-colors"
      style={{
        background: selected ? "#eef6ff" : "#fff",
        boxShadow: selected
          ? "inset 0 0 0 2px #088df9"
          : "inset 0 0 0 1px #eef3f8",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-[family-name:var(--font-fredoka)] text-[14.5px] font-semibold text-[#16324f]">
          {group.name}
        </span>
        <StatusPill status={group.status} />
      </div>
      <div className="mt-0.5 text-[11.5px] font-semibold text-[#8aa0b4]">
        {group.day} · {group.time} · {group.area}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="flex-1">
          <CapacityBar members={group.members} capacity={group.capacity} />
        </div>
        <span className="text-[11px] font-bold text-[#5b7a97]">
          {group.members}/{group.capacity}
        </span>
      </div>
    </button>
  );
}

function PersonRow({
  person,
  groupName,
  selected,
  onClick,
}: {
  person: Person;
  groupName: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl px-3.5 py-3 text-left transition-colors"
      style={{
        background: selected ? "#eef6ff" : "#fff",
        boxShadow: selected
          ? "inset 0 0 0 2px #088df9"
          : "inset 0 0 0 1px #eef3f8",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <Avatar initials={initialsOf(person.name)} size={26} tone="muted" />
          <span className="font-[family-name:var(--font-fredoka)] text-[14.5px] font-semibold text-[#16324f]">
            {person.name}
          </span>
        </span>
        <StatusPill status={person.status} />
      </div>
      <div className="mt-1 text-[11.5px] font-semibold text-[#8aa0b4]">
        {person.area} · {person.days.join(", ") || "No days set"}
      </div>
      <div className="mt-0.5 text-[11.5px] font-bold text-[#5b7a97]">
        Group · {groupName}
      </div>
    </button>
  );
}
