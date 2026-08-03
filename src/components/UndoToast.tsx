"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

export interface UndoToastOptions {
  message: string;
  /** Fires once, after the undo window elapses without being cancelled —
   * this is where the actual (now-permanent) action belongs, e.g. the real
   * server delete call. Deletes are staged this way specifically so
   * "Undo" can mean something: nothing irreversible actually happens
   * until the toast expires. */
  onCommit: () => void;
  /** Fires if "Undo" is clicked before the window elapses. */
  onUndo: () => void;
  durationMs?: number;
}

const DEFAULT_DURATION_MS = 6000;

const ToastCtx = createContext<{ showUndoToast: (opts: UndoToastOptions) => void } | null>(null);

export function useUndoToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useUndoToast must be used within UndoToastProvider");
  return ctx;
}

/**
 * Mounted once at the AppShell level (survives client-side navigation
 * between Directory routes, same as DirectoryDataProvider) so a pending
 * commit started on one page keeps counting down even after `router.push`
 * takes the user somewhere else. Only one toast at a time — this app's
 * scale never needs to stack several, and a second delete while one is
 * already pending immediately commits the first (simplest predictable
 * behavior, rather than trying to juggle two countdowns).
 *
 * Known tradeoff, accepted deliberately: since the commit is a plain
 * client-side timer, closing the tab (not just navigating within the app)
 * within the undo window means `onCommit` never runs — the delete simply
 * doesn't happen. For a delete action, under-deleting is the safe failure
 * direction, so this isn't treated as a bug worth a server-side "pending
 * delete" mechanism.
 */
export function UndoToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const pendingRef = useRef<{ id: number; timer: ReturnType<typeof setTimeout>; onUndo: () => void } | null>(
    null,
  );
  const idRef = useRef(0);

  const showUndoToast = useCallback((opts: UndoToastOptions) => {
    // A second toast while one is pending commits the first immediately
    // rather than silently dropping it — never lose a queued action.
    if (pendingRef.current) {
      clearTimeout(pendingRef.current.timer);
      pendingRef.current = null;
    }
    const id = ++idRef.current;
    const timer = setTimeout(() => {
      if (pendingRef.current?.id !== id) return;
      pendingRef.current = null;
      setToast((t) => (t?.id === id ? null : t));
      opts.onCommit();
    }, opts.durationMs ?? DEFAULT_DURATION_MS);
    pendingRef.current = { id, timer, onUndo: opts.onUndo };
    setToast({ id, message: opts.message });
  }, []);

  const handleUndo = () => {
    if (!pendingRef.current) return;
    clearTimeout(pendingRef.current.timer);
    pendingRef.current.onUndo();
    pendingRef.current = null;
    setToast(null);
  };

  return (
    <ToastCtx.Provider value={{ showUndoToast }}>
      {children}
      {toast && (
        // Deliberately theme-invariant (dark bg, white text) regardless of
        // the app's light/dark mode — the same common snackbar/toast
        // convention used elsewhere (brief, high-contrast, unmissable),
        // not something that needs to blend into either theme.
        <div
          className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-full px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_8px_24px_rgba(0,0,0,.35)]"
          style={{ background: "#16324f" }}
          role="status"
        >
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={handleUndo}
            className="font-extrabold text-[var(--brand-blue-light)] hover:underline"
          >
            Undo
          </button>
        </div>
      )}
    </ToastCtx.Provider>
  );
}
