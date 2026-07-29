"use client";

import { useState, useTransition } from "react";
import { updateOwnDisplayName } from "@/app/actions";
import { TextInput } from "@/components/ui";

/** Lets the signed-in coordinator set their own display name — same
 * overlay/panel pattern as ConfirmDialog.tsx, swapping the confirmation
 * message for a single text field. Reached by clicking the name or avatar
 * in AppShell's header. */
export function EditDisplayNameModal({
  open,
  initialName,
  onClose,
  onSaved,
}: {
  open: boolean;
  initialName: string;
  onClose: () => void;
  onSaved: (fullName: string) => void;
}) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Reset to the current name each time the modal opens, so a cancelled
  // edit doesn't leave stale text showing next time it's reopened. React's
  // documented render-time state-adjustment pattern (compare against a
  // tracked previous value) instead of an effect — same pattern already
  // used elsewhere in this codebase (Finder.tsx's prevPersonId reset).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setName(initialName);
      setError(null);
    }
  }

  if (!open) return null;

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateOwnDisplayName(name);
      if (!result.ok) {
        setError(result.error ?? "Couldn't save that.");
        return;
      }
      onSaved(result.fullName ?? name.trim());
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-display-name-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[380px] rounded-2xl bg-[var(--surface)] p-5 shadow-[0_20px_50px_rgba(22,50,79,.35)]"
      >
        <h2
          id="edit-display-name-title"
          className="font-[family-name:var(--font-fredoka)] text-[16px] font-semibold text-[var(--ink)]"
        >
          Your display name
        </h2>
        <p className="mt-1.5 text-[13px] font-semibold leading-[1.5] text-[var(--muted)]">
          Shown in the header and on anything you log — outreach notes, placement
          history, and record edits.
        </p>
        <div className="mt-4">
          <TextInput
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (!isPending) handleSave();
              }
            }}
          />
        </div>
        {error && (
          <p className="mt-2 rounded-lg border border-[var(--amber-border)] bg-[var(--amber-bg)] px-3 py-1.5 text-[12px] font-bold text-[var(--amber-fg)]">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-full px-4 py-2 text-[13px] font-bold text-[var(--muted)] transition-colors hover:bg-[var(--panel-4)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="rounded-full bg-[var(--brand-blue)] px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-[var(--brand-blue-dark)] disabled:opacity-60"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
