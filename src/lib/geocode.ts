// Server-only: uses GOOGLE_MAPS_SERVER_KEY (never NEXT_PUBLIC_), so this
// must only ever be imported from server code (server actions, RSCs).

export interface GeoPoint {
  lat: number;
  lng: number;
}

/**
 * Turns a free-text address into coordinates via the Geocoding API.
 * Returns null (never throws) on a missing key, bad address, or API error —
 * callers should treat that as "couldn't place this on the map yet" rather
 * than fail the whole save.
 */
export async function geocodeAddress(address: string): Promise<GeoPoint | null> {
  const key = process.env.GOOGLE_MAPS_SERVER_KEY;
  const trimmed = address.trim();
  if (!key || !trimmed) return null;

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(trimmed)}&key=${key}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const location = data?.results?.[0]?.geometry?.location;
    if (data.status !== "OK" || typeof location?.lat !== "number") return null;
    return { lat: location.lat, lng: location.lng };
  } catch {
    return null;
  }
}
