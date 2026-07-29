"use client";

import { useEffect, useState } from "react";
import { getPlacementHistory } from "@/app/actions";
import type { PlacementHistoryEntry } from "@/lib/types";
import { formatDate as formatWhen } from "@/lib/format";

/** Read-only, auto-generated log of every group this party has ever been
 * assigned to — written by saveParty() whenever the assigned group
 * actually changes (see recordGroupChange() in actions.ts), never
 * hand-entered here. Answers "has this party moved around before?" that
 * the single `party.group` field alone can't. */
export function PlacementHistory({ partyId }: { partyId: string }) {
  const [entries, setEntries] = useState<PlacementHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPlacementHistory(partyId)
      .then((rows) => {
        if (!cancelled) setEntries(rows);
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setEntries([]);
          setError(err.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [partyId]);

  if (error) {
    return (
      <p className="rounded-lg border border-[var(--amber-border)] bg-[var(--amber-bg)] px-3 py-1.5 text-[12px] font-bold text-[var(--amber-fg)]">
        {error}
      </p>
    );
  }
  if (entries === null) {
    return <p className="text-[12.5px] font-semibold text-[var(--faint)]">Loading…</p>;
  }
  if (entries.length === 0) {
    return (
      <p className="text-[12.5px] font-semibold text-[var(--faint)]">
        No group assignments yet.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {entries.map((e) => (
        <li
          key={e.id}
          className="rounded-xl bg-[var(--panel-1)] px-3 py-2 text-[12.5px] font-semibold text-[var(--ink)]"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold">{e.groupName || "Unnamed group"}</span>
            <span className="text-[11px] font-bold text-[var(--faint)]">
              {e.unassignedAt ? "Past" : "Current"}
            </span>
          </div>
          <p className="mt-0.5 text-[var(--muted)]">
            {formatWhen(e.assignedAt)}
            {e.unassignedAt ? ` – ${formatWhen(e.unassignedAt)}` : " – now"}
            {e.assignedBy ? ` · assigned by ${e.assignedBy}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}
