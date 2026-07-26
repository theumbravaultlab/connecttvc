"use client";

import { TrashIcon } from "@/components/icons";

export type SaveState = "idle" | "saved" | "error";

/** The sticky delete/save action bar shared by the Group and Person edit
 * pages — identical everywhere except which entity it's saving. */
export function SaveBar({
  onDelete,
  onSave,
  isPending,
  saveState,
  saveError,
}: {
  onDelete: () => void;
  onSave: () => void;
  isPending: boolean;
  saveState: SaveState;
  saveError: string | null;
}) {
  return (
    <div className="shrink-0 border-t border-[var(--divider)] px-4 py-3 sm:px-6">
      <div className="mx-auto flex w-full max-w-[760px] flex-wrap items-center justify-between gap-2">
        <button
          onClick={onDelete}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-bold text-[oklch(0.55_0.18_20)] transition-colors hover:bg-[oklch(0.97_0.03_20)] disabled:opacity-50"
        >
          <TrashIcon width={15} height={15} />
          Delete
        </button>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
          {saveState === "error" ? (
            <span className="min-w-0 truncate text-[12px] font-bold text-[oklch(0.55_0.18_20)]">
              {saveError}
            </span>
          ) : (
            <span className="hidden text-[12px] font-semibold text-[var(--faint)] sm:inline">
              Edits apply to the live list instantly.
            </span>
          )}
          <button
            onClick={onSave}
            disabled={isPending}
            className="shrink-0 rounded-full px-5 py-2 text-[13px] font-bold text-white transition-colors disabled:opacity-70"
            style={{
              background:
                saveState === "error"
                  ? "oklch(0.55 0.18 20)"
                  : saveState === "saved"
                    ? "oklch(0.6 0.13 150)"
                    : "var(--brand-blue)",
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
    </div>
  );
}
