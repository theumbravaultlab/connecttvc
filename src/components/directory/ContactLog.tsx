"use client";

import { useEffect, useState } from "react";
import { addContactLogEntry, getContactLog } from "@/app/actions";
import type { ContactLogEntry } from "@/lib/types";
import { TextInput } from "@/components/ui";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Append-only outreach history for one party, so any coordinator can see
 * at a glance whether — and when — this household was already reached out
 * to, instead of risking a double message. Entries are auto-attributed to
 * the signed-in coordinator server-side; there's no "who contacted them"
 * field to hand-fill. */
export function ContactLog({ partyId }: { partyId: string }) {
  const [entries, setEntries] = useState<ContactLogEntry[] | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getContactLog(partyId)
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

  const handleLog = async () => {
    setSaving(true);
    setError(null);
    const result = await addContactLogEntry(partyId, note.trim());
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn't save that.");
      return;
    }
    setNote("");
    if (result.entry) {
      const entry = result.entry;
      setEntries((prev) => [entry, ...(prev ?? [])]);
    }
  };

  const last = entries?.[0];

  return (
    <div>
      {last && (
        <div className="mb-3 rounded-xl border border-[var(--border-accent)] bg-[var(--panel-2)] px-3 py-2 text-[12.5px] font-bold text-[var(--ink)]">
          Last reached out {formatWhen(last.createdAt)}
          {last.contactedBy ? ` by ${last.contactedBy}` : ""}
          {last.note ? ` — "${last.note}"` : ""}
        </div>
      )}

      <div className="mb-2 flex items-start gap-2">
        <div className="flex-1">
          <TextInput
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What was this about? (optional)"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (!saving) handleLog();
              }
            }}
          />
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={handleLog}
          className="shrink-0 rounded-full bg-[var(--brand-blue)] px-3.5 py-2 text-[12.5px] font-bold text-white transition-colors hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Logging…" : "Log outreach"}
        </button>
      </div>
      {error && (
        <p className="mb-2 rounded-lg border border-[var(--amber-border)] bg-[var(--amber-bg)] px-3 py-1.5 text-[12px] font-bold text-[var(--amber-fg)]">
          {error}
        </p>
      )}

      {entries === null ? (
        <p className="text-[12.5px] font-semibold text-[var(--faint)]">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-[12.5px] font-semibold text-[var(--faint)]">
          No outreach logged yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {entries.map((e) => (
            <li
              key={e.id}
              className="rounded-xl bg-[var(--panel-1)] px-3 py-2 text-[12.5px] font-semibold text-[var(--ink)]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold">{formatWhen(e.createdAt)}</span>
                <span className="text-[11px] font-bold text-[var(--faint)]">
                  {e.contactedBy ?? "Unknown"}
                </span>
              </div>
              {e.note && <p className="mt-0.5 text-[var(--muted)]">{e.note}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
