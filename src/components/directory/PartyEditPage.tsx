"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Party, Person } from "@/lib/types";
import { deleteParty, deletePerson, saveParty, savePerson } from "@/app/actions";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SearchIcon } from "@/components/icons";
import { useDirectoryData } from "./DirectoryData";
import { BackLink } from "./form-bits";
import { PartyForm } from "./PartyForm";
import { SaveBar, type SaveState } from "./SaveBar";

function validateParty(members: Person[]): string | null {
  if (members.length === 0) return "A party needs at least one member.";
  if (members.every((m) => !m.name.trim())) return "At least one member needs a name.";
  return null;
}

export function PartyEditPage({ id }: { id: string }) {
  const router = useRouter();
  const { groups, parties, setParties, people, setPeople, persisted } = useDirectoryData();
  const party = parties.find((p) => p.id === id) ?? null;
  const members = people.filter((p) => p.partyId === id);

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!party) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-[13px] font-semibold text-[var(--faint)]">
          This party no longer exists.
        </p>
        <BackLink fallbackHref="/directory/parties" />
      </div>
    );
  }

  const patchParty = (patch: Partial<Party>) =>
    setParties((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const patchMember = (personId: string, patch: Partial<Person>) =>
    setPeople((ps) => ps.map((p) => (p.id === personId ? { ...p, ...patch } : p)));

  const addMember = () => {
    const blank: Person = {
      id: `new-${Date.now()}`,
      partyId: id,
      name: "New member",
      email: "",
      phone: "",
    };
    setPeople((ps) => [...ps, blank]);
  };

  // A not-yet-saved member (still carrying its client-generated "new-…" id)
  // only ever exists in local state — dropping it locally is enough. An
  // already-persisted member needs an immediate, confirmed server delete,
  // same as every other delete in this app.
  const removeMember = (personId: string) => {
    if (personId.startsWith("new-")) {
      setPeople((ps) => ps.filter((p) => p.id !== personId));
      return;
    }
    startTransition(async () => {
      const result = await deletePerson(personId);
      if (!result.ok) {
        setSaveState("error");
        setSaveError(result.error ?? "Couldn't remove that member — try again.");
        return;
      }
      setPeople((ps) => ps.filter((p) => p.id !== personId));
    });
  };

  const handleSave = () => {
    const err = validateParty(members);
    if (err) {
      setSaveState("error");
      setSaveError(err);
      return;
    }
    startTransition(async () => {
      const partyResult = await saveParty(party);
      if (!partyResult.ok) {
        setSaveState("error");
        setSaveError(partyResult.error ?? "Save failed — try again.");
        return;
      }
      // Refresh the local baseline so a second save later in this same
      // session compares against the row's actual latest updated_at, not
      // the stale value loaded when the page first opened. Also pick up
      // the geocoded area/lat/lng — without this, a newly placed party
      // wouldn't show on the Map until a full page reload re-fetched them,
      // even though the DB row was already correct the moment the save
      // succeeded.
      patchParty({
        updatedAt: partyResult.updatedAt,
        area: partyResult.area,
        lat: partyResult.lat,
        lng: partyResult.lng,
      });

      const memberResults = await Promise.all(members.map((m) => savePerson(m)));
      const failed = memberResults.find((r) => !r.ok);
      if (failed) {
        setSaveState("error");
        setSaveError(failed.error ?? "Couldn't save a member — try again.");
        return;
      }
      memberResults.forEach((r, i) => patchMember(members[i].id, { updatedAt: r.updatedAt }));

      setSaveState("saved");
      setSaveError(null);
      setTimeout(() => setSaveState("idle"), 1500);
    });
  };

  const confirmDelete = () => {
    startTransition(async () => {
      const result = await deleteParty(party.id);
      if (!result.ok) {
        setConfirmOpen(false);
        setSaveState("error");
        setSaveError(result.error ?? "Delete failed — try again.");
        return;
      }
      // The DB cascades this delete to every linked person + contact log
      // entry — mirror that locally so the shared state stays consistent.
      setParties((ps) => ps.filter((p) => p.id !== party.id));
      setPeople((ps) => ps.filter((p) => p.partyId !== party.id));
      router.push("/directory/parties");
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--divider)] px-4 py-3 sm:px-6">
        <BackLink fallbackHref="/directory/parties" />
        <button
          type="button"
          onClick={() => router.push(`/?party=${party.id}`)}
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
          <PartyForm
            party={party}
            members={members}
            groups={groups}
            onPatch={patchParty}
            onAddMember={addMember}
            onUpdateMember={patchMember}
            onRemoveMember={removeMember}
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
        title="Delete this party?"
        message="This can't be undone — the party and everyone in it will be permanently removed."
        isPending={isPending}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
