"use client";

import { useEffect, useState } from "react";
import { partyDisplayName, partyMemberNames, type Party, type Person } from "@/lib/types";
import { getDeletedParties, restoreParty } from "@/app/actions";
import { formatDateTime } from "@/lib/format";
import { Avatar } from "@/components/ui";
import { DirectoryNav } from "./DirectoryNav";
import { useDirectoryData } from "./DirectoryData";

/** Soft-deleted parties are already in the database (see
 * 015_soft_delete.sql) — this is just the first UI ever built to see or
 * restore them; previously the only recovery path was clearing
 * deleted_at by hand in the Supabase table editor. Fetched on demand
 * (not part of the shared DirectoryData context) since this page is
 * rarely visited. */
export function TrashPage() {
  const { setParties, setPeople } = useDirectoryData();
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; parties: Party[]; people: Person[] }
  >({ status: "loading" });
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDeletedParties().then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setState({ status: "error", message: result.error ?? "Couldn't load recently deleted parties." });
        return;
      }
      setState({ status: "ready", parties: result.parties, people: result.people });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRestore = async (id: string) => {
    if (state.status !== "ready") return;
    setRestoringId(id);
    setRestoreError(null);
    const result = await restoreParty(id);
    setRestoringId(null);
    if (!result.ok) {
      setRestoreError(result.error ?? "Couldn't restore this party.");
      return;
    }
    const party = state.parties.find((p) => p.id === id);
    const members = state.people.filter((p) => p.partyId === id);
    // Patches the shared context directly, same as every other write in
    // this app, so the party is immediately visible again in the Parties
    // list and on the Map without a full reload.
    if (party) {
      setParties((ps) => [...ps, { ...party, deletedAt: null, deletedBy: null }]);
      setPeople((ps) => [...ps, ...members.map((m) => ({ ...m }))]);
    }
    setState((s) =>
      s.status === "ready" ? { ...s, parties: s.parties.filter((p) => p.id !== id) } : s,
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--divider)] px-3 py-2.5 sm:px-[18px] sm:py-3">
        <DirectoryNav />
      </div>

      <div className="shrink-0 border-b border-[var(--divider)] bg-[var(--panel-1)] px-4 py-2.5 text-[12.5px] font-semibold text-[var(--muted)] sm:px-[18px]">
        Deleted parties from Directory → Parties. Restoring brings back the party and every
        member linked to it. Groups aren&apos;t soft-deleted, so they don&apos;t appear here.
      </div>

      <div className="hw-scroll min-h-0 flex-1 overflow-auto p-3.5 sm:p-[18px]">
        {state.status === "loading" && (
          <p className="text-[13px] font-semibold text-[var(--faint)]">Loading…</p>
        )}
        {state.status === "error" && (
          <p className="text-[13px] font-semibold text-[oklch(0.55_0.18_20)]">{state.message}</p>
        )}
        {restoreError && (
          <p className="mb-2 text-[12.5px] font-bold text-[oklch(0.55_0.18_20)]">{restoreError}</p>
        )}
        {state.status === "ready" && state.parties.length === 0 && (
          <p className="text-[13px] font-semibold text-[var(--faint)]">
            Nothing in the trash right now.
          </p>
        )}
        {state.status === "ready" && state.parties.length > 0 && (
          <div className="flex flex-col gap-2">
            {state.parties.map((party) => {
              const members = state.people.filter((p) => p.partyId === party.id);
              return (
                <div
                  key={party.id}
                  className="flex items-center gap-3 rounded-xl border border-[var(--divider)] bg-[var(--surface)] px-3.5 py-3"
                >
                  <Avatar initials={partyDisplayName(party, members).slice(0, 2).toUpperCase()} tone="muted" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-bold text-[var(--ink)]">
                      {partyDisplayName(party, members)}
                    </div>
                    {members.length > 1 && (
                      <div className="truncate text-[12px] font-semibold text-[var(--muted)]">
                        {partyMemberNames(members)}
                      </div>
                    )}
                    <div className="mt-0.5 text-[11.5px] font-semibold text-[var(--faint)]">
                      Deleted {party.deletedAt ? formatDateTime(party.deletedAt) : "—"}
                      {party.deletedBy ? ` by ${party.deletedBy}` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={restoringId === party.id}
                    onClick={() => handleRestore(party.id)}
                    className="shrink-0 rounded-full border border-[var(--brand-blue-light)] px-3.5 py-1.5 text-[12.5px] font-bold text-[var(--brand-blue)] transition-colors hover:bg-[var(--panel-2)] disabled:opacity-50"
                  >
                    {restoringId === party.id ? "Restoring…" : "Restore"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
