"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Person } from "@/lib/types";
import { deletePerson, savePerson } from "@/app/actions";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SearchIcon } from "@/components/icons";
import { useDirectoryData } from "./DirectoryData";
import { BackLink } from "./form-bits";
import { PersonForm } from "./PersonForm";
import { SaveBar, type SaveState } from "./SaveBar";

function validatePerson(p: Person): string | null {
  if (!p.name.trim()) return "Full name can't be blank.";
  return null;
}

export function PersonEditPage({ id }: { id: string }) {
  const router = useRouter();
  const { groups, people, setPeople, persisted } = useDirectoryData();
  const person = people.find((p) => p.id === id) ?? null;

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!person) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-[13px] font-semibold text-[var(--faint)]">
          This person no longer exists.
        </p>
        <BackLink fallbackHref="/directory/people" />
      </div>
    );
  }

  const patchPerson = (patch: Partial<Person>) =>
    setPeople((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const handleSave = () => {
    const err = validatePerson(person);
    if (err) {
      setSaveState("error");
      setSaveError(err);
      return;
    }
    startTransition(async () => {
      const result = await savePerson(person);
      if (result.ok) {
        setSaveState("saved");
        setSaveError(null);
        // Refresh the local baseline so a second save later in this same
        // session compares against the row's actual latest updated_at,
        // not the stale value loaded when the page first opened. Also
        // pick up the geocoded area/lat/lng — without this, a newly
        // placed person wouldn't show on the Map until a full page
        // reload re-fetched them, even though the DB row was already
        // correct the moment the save succeeded.
        patchPerson({
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
      const result = await deletePerson(person.id);
      if (!result.ok) {
        setConfirmOpen(false);
        setSaveState("error");
        setSaveError(result.error ?? "Delete failed — try again.");
        return;
      }
      setPeople((ps) => ps.filter((p) => p.id !== person.id));
      router.push("/directory/people");
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--divider)] px-4 py-3 sm:px-6">
        <BackLink fallbackHref="/directory/people" />
        <button
          type="button"
          onClick={() => router.push(`/?person=${person.id}`)}
          className="flex items-center gap-1.5 rounded-full bg-[var(--brand-blue)] px-3.5 py-1.5 text-[12.5px] font-bold text-white transition-colors hover:bg-[var(--brand-blue-dark)]"
        >
          <SearchIcon width={13} height={13} />
          Find for
        </button>
      </div>
      {!persisted && (
        <div className="shrink-0 border-b border-[var(--amber-border)] bg-[var(--amber-bg)] px-4 py-2 text-[12px] font-bold text-[var(--amber-fg)] sm:px-6">
          Demo mode — edits stay in this session. Add Supabase keys to persist.
        </div>
      )}
      <div className="hw-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[760px] px-4 py-5 sm:px-6">
          <PersonForm person={person} groups={groups} onPatch={patchPerson} />
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
        title={`Delete "${person.name}"?`}
        message="This can't be undone — the person will be permanently removed."
        isPending={isPending}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
