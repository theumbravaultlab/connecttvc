"use client";

import { useEffect } from "react";

/** Registers public/sw.js — a deliberately no-op service worker (no
 * caching, no offline support) that exists purely to satisfy Chrome's
 * automatic install-prompt criteria, which still checks for an active
 * service worker with a fetch handler even though manual "Install app"
 * from the browser menu doesn't strictly require one. See sw.js's own
 * header comment for the full reasoning. Renders nothing. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration failing (unsupported browser, blocked, etc.) should
        // never break the app itself — installability is a nice-to-have,
        // not a requirement for the site to function.
      });
    }
  }, []);

  return null;
}
