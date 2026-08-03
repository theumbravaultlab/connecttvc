"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Group, Party, PartyStatus } from "@/lib/types";
import { deleteGroup, saveGroup, saveParty } from "@/app/actions";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useUndoToast } from "@/components/UndoToast";
import { useDirectoryData } from "./DirectoryData";
import { BackLink } from "./form-bits";
import { GroupForm } from "./GroupForm";
import { SaveBar, type SaveState } from "./SaveBar";

function validateGroup(g: Group): string | null {
  if (!g.name.trim()) return "Group name can't be blank.";
  if (g.capacity < 1) return "Max capacity must be at least 1.";
  return null;
}

const ACTIVELY_SEARCHING_LIKE: PartyStatus[] = ["New", "Actively Searching", "Waitlisted"];

export function GroupEditPage({ id }: { id: string }) {
  const router = useRouter();
  const { groups, parties, people, profiles, setGroups, setParties, persisted } = useDirectoryData();
  const { showUndoToast } = useUndoToast();
  const group = groups.find((g) => g.id === id) ?? null;

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!group) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-[13px] font-semibold text-[var(--faint)]">
          This group no longer exists.
        </p>
        <BackLink fallbackHref="/directory/groups" />
      </div>
    );
  }

  const patchGroup = (patch: Partial<Group>) =>
    setGroups((gs) => gs.map((g) => (g.id === id ? { ...g, ...patch } : g)));

  // Assigning/unassigning a party from the Group's own side mutates a
  // *different* record (the Party's own `group` field) than the one this
  // page is editing, so it persists immediately via the real saveParty()
  // action rather than waiting on this page's own Save button — same
  // "immediate cross-record action" precedent as PartyEditPage's
  // removeMember(). Going through saveParty() also means
  // recordGroupChange() fires automatically, so a placement_history entry
  // gets written for free. Status auto-transitions the same way
  // PartyForm's own "Assigned group" picker already does, so the result
  // is identical regardless of which side initiated the assignment.
  const assignParty = (party: Party) => {
    startTransition(async () => {
      const nextStatus: PartyStatus = party.status === "Grouped" ? party.status : "Grouped";
      const result = await saveParty({ ...party, group: group.id, status: nextStatus });
      if (!result.ok) {
        setSaveState("error");
        setSaveError(result.error ?? "Couldn't assign that party.");
        return;
      }
      setParties((ps) =>
        ps.map((p) =>
          p.id === party.id
            ? {
                ...p,
                group: group.id,
                status: nextStatus,
                updatedAt: result.updatedAt,
                area: result.area ?? p.area,
                lat: result.lat ?? p.lat,
                lng: result.lng ?? p.lng,
              }
            : p,
        ),
      );
    });
  };

  const unassignParty = (party: Party) => {
    startTransition(async () => {
      const nextStatus: PartyStatus = ACTIVELY_SEARCHING_LIKE.includes(party.status)
        ? party.status
        : "Actively Searching";
      const result = await saveParty({ ...party, group: null, status: nextStatus });
      if (!result.ok) {
        setSaveState("error");
        setSaveError(result.error ?? "Couldn't remove that assignment.");
        return;
      }
      setParties((ps) =>
        ps.map((p) =>
          p.id === party.id ? { ...p, group: null, status: nextStatus, updatedAt: result.updatedAt } : p,
        ),
      );
    });
  };

  const handleSave = () => {
    const err = validateGroup(group);
    if (err) {
      setSaveState("error");
      setSaveError(err);
      return;
    }
    startTransition(async () => {
      const result = await saveGroup(group);
      if (result.ok) {
        setSaveState("saved");
        setSaveError(null);
        // Refresh the local baseline so a second save later in this same
        // session compares against the row's actual latest updated_at,
        // not the stale value loaded when the page first opened. Also
        // pick up the geocoded area/lat/lng — without this, a newly
        // placed group wouldn't show on the Map until a full page
        // reload re-fetched it, even though the DB row was already
        // correct the moment the save succeeded.
        patchGroup({
          updatedAt: result.updatedAt,
          area: result.area,
          lat: result.lat,
          lng: result.lng,
          createdAt: result.createdAt,
          createdBy: result.createdBy,
          updatedBy: result.updatedBy,
        });
        setTimeout(() => setSaveState("idle"), 1500);
      } else {
        setSaveState("error");
        setSaveError(result.error ?? "Save failed — try again.");
      }
    });
  };

  // Deletion is deferred to the undo toast's onCommit — group deletes are
  // hard deletes (no soft-delete/trash for groups, see actions.ts), so
  // "Undo" only means something if the real DELETE hasn't fired yet.
  // Optimistically removed from local state and navigated away
  // immediately; if the coordinator clicks Undo within the window, the
  // group is patched right back into shared state and nothing was ever
  // sent to the server.
  const confirmDelete = () => {
    setConfirmOpen(false);
    setGroups((gs) => gs.filter((g) => g.id !== group.id));
    router.push("/directory/groups");
    showUndoToast({
      message: `"${group.name}" deleted`,
      onUndo: () => setGroups((gs) => [...gs, group]),
      onCommit: () => {
        startTransition(async () => {
          const result = await deleteGroup(group.id);
          if (!result.ok) {
            // The optimistic removal already happened and the toast is
            // long gone by the time this fires — putting the group back
            // is the only way to surface a failed delete at all.
            setGroups((gs) => [...gs, group]);
          }
        });
      },
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-[var(--divider)] px-4 py-3 sm:px-6">
        <BackLink fallbackHref="/directory/groups" />
      </div>
      {!persisted && (
        <div className="shrink-0 border-b border-[var(--amber-border)] bg-[var(--amber-bg)] px-4 py-2 text-[12px] font-bold text-[var(--amber-fg)] sm:px-6">
          Demo mode — edits stay in this session. Add Supabase keys to persist.
        </div>
      )}
      <div className="hw-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[760px] px-4 py-5 sm:px-6">
          <GroupForm
            group={group}
            parties={parties}
            people={people}
            profiles={profiles}
            onPatch={patchGroup}
            onAssignParty={assignParty}
            onUnassignParty={unassignParty}
          />
        </div>
      </div>
      <SaveBar
        onDelete={() => setConfirmOpen(true)}
        onSave={handleSave}
        isPending={isPending}
        saveState={saveState}
        saveError={saveError}
      />
      <ConfirmDialog
        open={confirmOpen}
        title={`Delete "${group.name}"?`}
        message="This can't be undone — the group will be permanently removed."
        isPending={isPending}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
