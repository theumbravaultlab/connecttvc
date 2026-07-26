"use client";

import { TrashIcon } from "@/components/icons";

/** In-app replacement for window.confirm(), used for destructive actions
 * (currently: deleting a Group or Person) so the confirmation matches the
 * app's own look instead of a native browser popup. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  isPending,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[380px] rounded-2xl bg-[var(--surface)] p-5 shadow-[0_20px_50px_rgba(22,50,79,.35)]"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[oklch(0.95_0.045_20)]">
          <TrashIcon width={17} height={17} className="text-[oklch(0.55_0.18_20)]" />
        </div>
        <h2
          id="confirm-dialog-title"
          className="mt-3 font-[family-name:var(--font-fredoka)] text-[16px] font-semibold text-[var(--ink)]"
        >
          {title}
        </h2>
        <p className="mt-1.5 text-[13px] font-semibold leading-[1.5] text-[var(--muted)]">
          {message}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-full px-4 py-2 text-[13px] font-bold text-[var(--muted)] transition-colors hover:bg-[var(--panel-4)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="rounded-full bg-[oklch(0.55_0.18_20)] px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-[oklch(0.5_0.18_20)] disabled:opacity-60"
          >
            {isPending ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
