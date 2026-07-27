"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Group } from "@/lib/types";
import { deleteGroup, saveGroup } from "@/app/actions";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useDirectoryData } from "./DirectoryData";
import { BackLink } from "./form-bits";
import { GroupForm } from "./GroupForm";
import { SaveBar, type SaveState } from "./SaveBar";

function validateGroup(g: Group): string | null {
  if (!g.name.trim()) return "Group name can't be blank.";
  if (g.capacity < 1) return "Max capacity must be at least 1.";
  return null;
}

export function GroupEditPage({ id }: { id: string }) {
  const router = useRouter();
  const { groups, parties, people, setGroups, persisted } = useDirectoryData();
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
        });
        setTimeout(() => setSaveState("idle"), 1500);
      } else {
        setSaveState("error");
        setSaveError(result.error ?? "Save failed — try again.");
      }
    });
  };

  const confirmDelete = () => {
    startTransition(async () => {
      const result = await deleteGroup(group.id);
      if (!result.ok) {
        setConfirmOpen(false);
        setSaveState("error");
        setSaveError(result.error ?? "Delete failed — try again.");
        return;
      }
      setGroups((gs) => gs.filter((g) => g.id !== group.id));
      router.push("/directory/groups");
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
          <GroupForm group={group} parties={parties} people={people} onPatch={patchGroup} />
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
