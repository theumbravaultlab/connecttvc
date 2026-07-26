"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "connect-tvc-theme";

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): Theme | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

// A stored explicit choice wins; otherwise mirror the OS preference. Reading
// both fresh on every snapshot (rather than caching) is deliberate — it's
// what lets `subscribe` below be a plain listener registration with no
// separate cache-invalidation logic to keep in sync.
function getSnapshot(): Theme {
  return readStoredTheme() ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}

// Matches globals.css's own light-mode default, so the very first paint
// (server-rendered, before any client JS runs) never disagrees with this
// value — no flash, no hydration mismatch. useSyncExternalStore swaps in
// the real getSnapshot() value synchronously right after hydration.
function getServerSnapshot(): Theme {
  return "light";
}

const listeners = new Set<() => void>();

/** Notifies every ThemeProvider (there's only ever one, but this stays
 * correct if that ever changes) that the stored/OS-derived theme may have
 * changed, so useSyncExternalStore re-reads getSnapshot(). */
function notify() {
  listeners.forEach((l) => l());
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  // Only matters while there's no explicit override — but it's harmless to
  // notify unconditionally either way, since getSnapshot() itself already
  // prioritizes the stored value over the OS preference.
  mq.addEventListener("change", callback);
  return () => {
    listeners.delete(callback);
    mq.removeEventListener("change", callback);
  };
}

/** Tracks light/dark, persists an explicit choice to localStorage, and
 * stamps data-theme on <html> so globals.css's `[data-theme="dark"]` rules
 * take over from the `prefers-color-scheme` media query. Before any
 * explicit choice exists, `theme` here just mirrors the OS preference —
 * the actual rendering already matches it via CSS alone (see the inline
 * script in src/app/layout.tsx for why there's no flash either way).
 *
 * Built on useSyncExternalStore rather than state+effect: localStorage and
 * matchMedia are external, browser-only stores, which is exactly what this
 * hook exists for — it handles the server-vs-client snapshot difference
 * natively (getServerSnapshot during hydration, then an immediate,
 * built-in re-render with the real client value), so there's no manual
 * "read on mount" effect needed at all. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage can throw in private-browsing edge cases — the
      // toggle still works for the current session either way.
    }
    notify();
  };

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
