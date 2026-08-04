// Minimal service worker — registered ONLY to satisfy Chrome's PWA install-
// prompt criteria, which still requires an active service worker with a
// `fetch` handler even though manual "Install app" from the browser menu no
// longer strictly needs one (see https://developer.chrome.com/blog/update-install-criteria).
//
// Deliberately does NOT cache or intercept anything — no respondWith() call
// in the fetch handler means every request still goes straight to the
// network exactly as if this file didn't exist. This app's whole value is
// live Supabase data (group capacity, statuses, placements); caching any of
// it would risk a coordinator seeing a stale snapshot. If real offline
// support is ever wanted, build it here deliberately — don't assume this
// file already provides it.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // No respondWith() on purpose — the browser handles every request
  // normally. This handler's only job is to exist.
});
