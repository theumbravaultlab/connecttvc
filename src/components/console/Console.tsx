"use client";

import { useTransition, useState, type Dispatch, type SetStateAction } from "react";
import type { Group, Person } from "@/lib/types";
import { initialsOf } from "@/lib/types";
import {
  backfillGroupLocations,
  deleteGroup,
  deletePerson,
  saveGroup,
  savePerson,
} from "@/app/actions";
import {
  Avatar,
  CapacityBar,
  StatusPill,
} from "@/components/ui";
import { ChevronLeftIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { GroupForm } from "./GroupForm";
import { PersonForm } from "./PersonForm";

type Tab = "groups" | "people";
type SaveState = "idle" | "saved" | "error";

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

function validateGroup(g: Group): string | null {
  if (!g.name.trim()) return "Group name can't be blank.";
  if (g.capacity < 1) return "Max capacity must be at least 1.";
  return null;
}

function validatePerson(p: Person): string | null {
  if (!p.name.trim()) return "Full name can't be blank.";
  return null;
}

export function Console({
  groups,
  setGroups,
  people,
  setPeople,
  persisted,
}: {
  groups: Group[];
  setGroups: Dispatch<SetStateAction<Group[]>>;
  people: Person[];
  setPeople: Dispatch<SetStateAction<Person[]>>;
  persisted: boolean;
}) {
  const [tab, setTab] = useState<Tab>("groups");
  const [selGroupId, setSelGroupId] = useState(groups[0]?.id ?? null);
  const [selPersonId, setSelPersonId] = useState(people[0]?.id ?? null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [mobileSub, setMobileSub] = useState<"list" | "edit">("list");
  const [isPending, startTransition] = useTransition();
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);
  const [isBackfilling, setIsBackfilling] = useState(false);

  const missingLocations = groups.filter(
    (g) => g.address.trim() && (g.lat == null || g.lng == null),
  ).length;

  const handleBackfill = () => {
    setIsBackfilling(true);
    setBackfillMsg(null);
    startTransition(async () => {
      const result = await backfillGroupLocations();
      setIsBackfilling(false);
      if (!result.ok) {
        setBackfillMsg(result.error ?? "Backfill failed — try again.");
        return;
      }
      setBackfillMsg(
        result.updated > 0
          ? `Placed ${result.updated} group${result.updated === 1 ? "" : "s"} on the map.`
          : "No groups needed geocoding.",
      );
      if (result.updated > 0) {
        // The action wrote lat/lng directly to the DB (not through
        // patchGroup), so refetch to pick the new values up client-side.
        window.location.reload();
      }
    });
  };

  const clearFeedback = () => {
    setSaveState("idle");
    setSaveError(null);
  };

  const changeTab = (t: Tab) => {
    setTab(t);
    setMobileSub("list");
    clearFeedback();
  };
  const selectGroup = (id: string) => {
    setSelGroupId(id);
    setMobileSub("edit");
    clearFeedback();
  };
  const selectPerson = (id: string) => {
    setSelPersonId(id);
    setMobileSub("edit");
    clearFeedback();
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
    clearFeedback();
  };
  const addPerson = () => {
    const p = blankPerson(`new-${Date.now()}`);
    setPeople((ps) => [p, ...ps]);
    setSelPersonId(p.id);
    setTab("people");
    setMobileSub("edit");
    clearFeedback();
  };

  const handleSave = () => {
    if (tab === "groups" && selGroup) {
      const err = validateGroup(selGroup);
      if (err) {
        setSaveState("error");
        setSaveError(err);
        return;
      }
      startTransition(async () => {
        const result = await saveGroup(selGroup);
        if (result.ok) {
          setSaveState("saved");
          setSaveError(null);
          setTimeout(() => setSaveState("idle"), 1500);
        } else {
          setSaveState("error");
          setSaveError(result.error ?? "Save failed — try again.");
        }
      });
    } else if (tab === "people" && selPerson) {
      const err = validatePerson(selPerson);
      if (err) {
        setSaveState("error");
        setSaveError(err);
        return;
      }
      startTransition(async () => {
        const result = await savePerson(selPerson);
        if (result.ok) {
          setSaveState("saved");
          setSaveError(null);
          setTimeout(() => setSaveState("idle"), 1500);
        } else {
          setSaveState("error");
          setSaveError(result.error ?? "Save failed — try again.");
        }
      });
    }
  };

  const handleDelete = () => {
    if (tab === "groups" && selGroup) {
      if (!window.confirm(`Delete "${selGroup.name}"? This can't be undone.`)) return;
      startTransition(async () => {
        const result = await deleteGroup(selGroup.id);
        if (!result.ok) {
          setSaveState("error");
          setSaveError(result.error ?? "Delete failed — try again.");
          return;
        }
        const remaining = groups.filter((g) => g.id !== selGroup.id);
        setGroups(remaining);
        setSelGroupId(remaining[0]?.id ?? null);
        setMobileSub("list");
        clearFeedback();
      });
    } else if (tab === "people" && selPerson) {
      if (!window.confirm(`Delete "${selPerson.name}"? This can't be undone.`)) return;
      startTransition(async () => {
        const result = await deletePerson(selPerson.id);
        if (!result.ok) {
          setSaveState("error");
          setSaveError(result.error ?? "Delete failed — try again.");
          return;
        }
        const remaining = people.filter((p) => p.id !== selPerson.id);
        setPeople(remaining);
        setSelPersonId(remaining[0]?.id ?? null);
        setMobileSub("list");
        clearFeedback();
      });
    }
  };

  const selected = tab === "groups" ? selGroup : selPerson;

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
        <div className="flex items-center gap-2">
          {tab === "groups" && missingLocations > 0 && (
            <button
              onClick={handleBackfill}
              disabled={isBackfilling}
              className="rounded-full px-3.5 py-1.5 text-[12.5px] font-bold text-[#5b7a97] transition-colors hover:bg-[#f2f6fb] disabled:opacity-60"
            >
              {isBackfilling
                ? "Placing on map…"
                : `Place ${missingLocations} on map`}
            </button>
          )}
          <button
            onClick={tab === "groups" ? addGroup : addPerson}
            className="flex items-center gap-1.5 rounded-full border border-[#a3cbfc] px-3.5 py-1.5 text-[12.5px] font-bold text-[#088df9] transition-colors hover:bg-[#f2f8ff]"
          >
            <PlusIcon width={15} height={15} />
            {tab === "groups" ? "New group" : "New person"}
          </button>
        </div>
      </div>
      {backfillMsg && (
        <div className="shrink-0 border-b border-[#eef3f8] bg-[#f7fafd] px-4 py-1.5 text-[11.5px] font-bold text-[#5b7a97] sm:px-[18px]">
          {backfillMsg}
        </div>
      )}

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

          {!selected ? (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-[13px] font-semibold text-[#8aa0b4]">
              No {tab === "groups" ? "groups" : "people"} yet — click "
              {tab === "groups" ? "New group" : "New person"}" to add one.
            </div>
          ) : (
            <>
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
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#eef3f8] px-4 py-3 sm:px-6">
                <button
                  onClick={handleDelete}
                  disabled={isPending}
                  className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[12.5px] font-bold text-[oklch(0.55_0.18_20)] transition-colors hover:bg-[oklch(0.97_0.03_20)] disabled:opacity-50"
                >
                  <TrashIcon width={15} height={15} />
                  Delete
                </button>
                <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
                  {saveState === "error" ? (
                    <span className="min-w-0 truncate text-[11.5px] font-bold text-[oklch(0.55_0.18_20)]">
                      {saveError}
                    </span>
                  ) : (
                    <span className="hidden text-[11.5px] font-semibold text-[#8aa0b4] sm:inline">
                      Edits apply to the live list instantly.
                    </span>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={isPending}
                    className="shrink-0 rounded-full px-5 py-2 text-[12.5px] font-bold text-white transition-colors disabled:opacity-70"
                    style={{
                      background:
                        saveState === "error"
                          ? "oklch(0.55 0.18 20)"
                          : saveState === "saved"
                            ? "oklch(0.6 0.13 150)"
                            : "#088df9",
                    }}
                  >
                    {isPending
                      ? "Saving…"
                      : saveState === "saved"
                        ? "✓ Saved"
                        : saveState === "error"
                          ? "Retry save"
                          : "Save changes"}
                  </button>
                </div>
              </div>
            </>
          )}
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
