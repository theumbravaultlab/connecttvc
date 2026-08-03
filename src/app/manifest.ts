import type { MetadataRoute } from "next";

// Installable-only PWA — deliberately no service worker / offline caching.
// This app's whole value is live group capacity, statuses, and placements
// straight from Supabase; caching any of that for offline use risks a
// coordinator placing someone into a group that's already full because
// they're looking at a stale cached snapshot. This manifest only makes the
// site installable to a home-screen icon that opens without browser chrome.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Connect TVC — Home Groups",
    short_name: "Connect TVC",
    description:
      "Coordinator map + directory for Connect TVC home groups.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7fafd",
    theme_color: "#088df9",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
