// Server-only: uses GOOGLE_MAPS_SERVER_KEY. Never import from client code.

export interface TravelTime {
  minutes: number;
  text: string; // e.g. "12 min"
}

interface Destination {
  id: string;
  lat: number;
  lng: number;
}

function formatMinutes(totalMinutes: number): string {
  if (totalMinutes < 1) return "<1 min";
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

/**
 * Drive time from one origin to several destinations in a single call, via
 * the Routes API's route matrix endpoint (built for exactly this "one point,
 * many candidates" shape — cheaper and simpler than calling computeRoutes
 * once per destination). Returns a map keyed by destination id; entries are
 * omitted (not null) for any destination Google couldn't route to, so
 * callers can just check `id in result`.
 */
export async function getTravelTimes(
  origin: { lat: number; lng: number },
  destinations: Destination[],
): Promise<Record<string, TravelTime>> {
  const key = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!key || destinations.length === 0) return {};

  try {
    const res = await fetch(
      "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask":
            "originIndex,destinationIndex,duration,condition",
        },
        body: JSON.stringify({
          origins: [
            { waypoint: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } } },
          ],
          destinations: destinations.map((d) => ({
            waypoint: { location: { latLng: { latitude: d.lat, longitude: d.lng } } },
          })),
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_AWARE",
        }),
      },
    );
    if (!res.ok) return {};

    const rows: Array<{
      destinationIndex: number;
      duration?: string;
      condition?: string;
    }> = await res.json();

    const result: Record<string, TravelTime> = {};
    for (const row of rows) {
      if (row.condition !== "ROUTE_EXISTS" || !row.duration) continue;
      const dest = destinations[row.destinationIndex];
      if (!dest) continue;
      const seconds = parseInt(row.duration.replace("s", ""), 10);
      if (Number.isNaN(seconds)) continue;
      const minutes = Math.round(seconds / 60);
      result[dest.id] = { minutes, text: formatMinutes(minutes) };
    }
    return result;
  } catch {
    return {};
  }
}
