// Server-only: uses GOOGLE_MAPS_SERVER_KEY (never NEXT_PUBLIC_), so this
// must only ever be imported from server code (server actions, RSCs).

export interface GeoResult {
  lat: number;
  lng: number;
  /** City derived from the geocoded address's "locality" component, if
   * Google returned one — used to auto-populate the area field. */
  city: string | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function extractCity(components: any[]): string | null {
  const byType = (type: string) =>
    components?.find((c) => c.types?.includes(type))?.long_name ?? null;
  // "locality" covers most US cities; some DFW suburbs report only as a
  // sublocality or a level-3 administrative area, so fall back in order.
  return (
    byType("locality") ??
    byType("sublocality") ??
    byType("administrative_area_level_3") ??
    null
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Turns a free-text address into coordinates + city via the Geocoding API.
 * Returns null (never throws) on a missing key, bad address, or API error —
 * callers should treat that as "couldn't place this on the map yet" rather
 * than fail the whole save.
 */
export async function geocodeAddress(address: string): Promise<GeoResult | null> {
  const key = process.env.GOOGLE_MAPS_SERVER_KEY;
  const trimmed = address.trim();
  if (!key || !trimmed) return null;

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(trimmed)}&key=${key}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const result = data?.results?.[0];
    const location = result?.geometry?.location;
    if (data.status !== "OK" || typeof location?.lat !== "number") return null;
    return {
      lat: location.lat,
      lng: location.lng,
      city: extractCity(result.address_components),
    };
  } catch {
    return null;
  }
}
