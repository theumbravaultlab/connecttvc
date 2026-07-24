"use client";

import { useEffect, useMemo } from "react";
import { AdvancedMarker, Map as GoogleMap, useMap } from "@vis.gl/react-google-maps";
import { initialsOf, type Group, type Person } from "@/lib/types";
import { lifeColors } from "@/lib/colors";

const BROWSER_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? "";
// "DEMO_MAP_ID" is Google's official placeholder for local development —
// swap in a real Map ID (Google Cloud → Maps Management → Map IDs) before
// deploying; it's a free, non-secret identifier, not an API key.
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";

// This org only ever operates in the DFW metroplex, so the map is hard-
// bounded to it: users can zoom in freely but can never pan/zoom out past
// this box. Also doubles as the default view when nothing is located yet.
// Covers Denton/McKinney north, Fort Worth west, Arlington/Mesquite south,
// Rockwall east, with margin. Adjust here if the service area ever grows.
const DFW_BOUNDS: google.maps.LatLngBoundsLiteral = {
  north: 33.45,
  south: 32.5,
  east: -96.25,
  west: -97.55,
};
const DFW_CENTER = { lat: 32.92, lng: -96.95 };

type LocatedGroup = Group & { lat: number; lng: number };
type LatLng = { lat: number; lng: number };

function hasLocation(g: Group): g is LocatedGroup {
  return typeof g.lat === "number" && typeof g.lng === "number";
}

function personLocation(p: Person | null | undefined): LatLng | null {
  if (!p || typeof p.lat !== "number" || typeof p.lng !== "number") return null;
  return { lat: p.lat, lng: p.lng };
}

// A pin to be rendered, tagged so jittered positions can be routed back to
// the right visual (teardrop group pin vs. person silhouette).
type MapPin =
  | { kind: "group"; id: string; lat: number; lng: number; group: LocatedGroup }
  | { kind: "person"; id: string; lat: number; lng: number; person: Person };

/**
 * Nudges pins that would otherwise sit on (or very near) the exact same
 * spot into a small ring around their shared point, so nothing visually
 * overlaps. Only affects rendering — never mutates real coordinates, and
 * groups of 1 (the overwhelming majority) pass through untouched.
 */
function spreadOverlaps<T extends { id: string; lat: number; lng: number }>(
  points: T[],
): T[] {
  const buckets = new Map<string, T[]>();
  for (const p of points) {
    // ~110m grid at this latitude — close enough to visually collide.
    const key = `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;
    const arr = buckets.get(key);
    if (arr) arr.push(p);
    else buckets.set(key, [p]);
  }

  const result: T[] = [];
  for (const bucket of buckets.values()) {
    if (bucket.length === 1) {
      result.push(bucket[0]);
      continue;
    }
    const sorted = [...bucket].sort((a, b) => a.id.localeCompare(b.id));
    const centerLat = sorted.reduce((s, p) => s + p.lat, 0) / sorted.length;
    const centerLng = sorted.reduce((s, p) => s + p.lng, 0) / sorted.length;
    const radiusDeg = 0.0012; // ~130m ring, visually distinct at city zoom
    const lngScale = Math.cos((centerLat * Math.PI) / 180) || 1;
    sorted.forEach((p, i) => {
      const angle = (2 * Math.PI * i) / sorted.length;
      result.push({
        ...p,
        lat: centerLat + radiusDeg * Math.cos(angle),
        lng: centerLng + (radiusDeg * Math.sin(angle)) / lngScale,
      });
    });
  }
  return result;
}

// Note: no <APIProvider> here — it's mounted once at the AppShell level so
// both this map and the Console's address autocomplete share one loaded
// Maps JS instance instead of loading the script twice.
export function FinderMap({
  groups,
  person,
  selectedId,
  onSelect,
}: {
  groups: Group[];
  /** The currently selected "Finding for" person, if any — shown as a
   * distinct pin and included when fitting the map to visible points. */
  person?: Person | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const located = groups.filter(hasLocation);
  const missing = groups.length - located.length;
  const personPoint = personLocation(person);

  const pins = useMemo(() => {
    const raw: MapPin[] = located.map((g) => ({
      kind: "group",
      id: g.id,
      lat: g.lat,
      lng: g.lng,
      group: g,
    }));
    if (person && personPoint) {
      raw.push({ kind: "person", id: person.id, lat: personPoint.lat, lng: personPoint.lng, person });
    }
    return spreadOverlaps(raw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [located, person, personPoint]);

  if (!BROWSER_KEY) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#eaf3fc] p-6 text-center text-[13px] font-semibold text-[#5b7a97]">
        Map needs a Google Maps browser key — add
        NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY to .env.local.
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <GoogleMap
        mapId={MAP_ID}
        defaultCenter={DFW_CENTER}
        defaultZoom={10}
        restriction={{ latLngBounds: DFW_BOUNDS, strictBounds: true }}
        gestureHandling="greedy"
        disableDefaultUI={false}
        className="h-full w-full"
      >
        <FitToPoints points={pins} />
        {pins.map((pin) =>
          pin.kind === "group" ? (
            <GroupPin
              key={pin.id}
              position={{ lat: pin.lat, lng: pin.lng }}
              group={pin.group}
              selected={pin.group.id === selectedId}
              onSelect={onSelect}
            />
          ) : (
            <PersonPin
              key={`person-${pin.id}`}
              position={{ lat: pin.lat, lng: pin.lng }}
              person={pin.person}
            />
          ),
        )}
      </GoogleMap>

      {missing > 0 && (
        <div className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-[10.5px] font-bold text-[#5b7a97] backdrop-blur">
          {missing} group{missing === 1 ? "" : "s"} missing a location — save
          its address in the Console to place it on the map.
        </div>
      )}
    </div>
  );
}

/** Fits/recenters the map whenever the visible points (groups + selected
 * person) change; falls back to the full DFW default view when nothing is
 * located yet. */
function FitToPoints({ points }: { points: LatLng[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    if (points.length === 0) {
      map.fitBounds(DFW_BOUNDS);
      return;
    }
    if (points.length === 1) {
      map.setCenter(points[0]);
      map.setZoom(13);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    points.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, 60);
  }, [map, points]);

  return null;
}

function GroupPin({
  position,
  group,
  selected,
  onSelect,
}: {
  position: LatLng;
  group: LocatedGroup;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const c = lifeColors(group.life);

  return (
    <AdvancedMarker
      position={position}
      onClick={() => onSelect(group.id)}
      zIndex={selected ? 30 : 10}
      title={group.name}
    >
      <span
        className="flex h-[30px] w-[30px] items-center justify-center transition-transform duration-150"
        style={{
          background: c.solid,
          borderRadius: "50% 50% 50% 0",
          transform: `rotate(-45deg) scale(${selected ? 1.16 : 1})`,
          boxShadow: selected
            ? "0 8px 18px rgba(8,141,249,.42), 0 0 0 4px rgba(255,255,255,.95)"
            : "0 3px 9px rgba(22,50,79,.3)",
        }}
      >
        <span
          className="text-[10.5px] font-extrabold text-white"
          style={{ transform: "rotate(45deg)" }}
        >
          {initialsOf(group.name)}
        </span>
      </span>
    </AdvancedMarker>
  );
}

/** Distinct "you are here"-style pin for the person "Finding for" is set
 * to — a person silhouette (head + shoulders) in brand blue with the
 * person's initials in the head, so it never reads as just another group
 * teardrop. */
function PersonPin({ position, person }: { position: LatLng; person: Person }) {
  return (
    <AdvancedMarker position={position} zIndex={40} title={person.name}>
      <div style={{ filter: "drop-shadow(0 3px 8px rgba(8,141,249,.45))" }}>
        <svg width="32" height="38" viewBox="0 0 32 38" fill="none">
          <path
            d="M4 37c0-13 6-14 12-14s12 1 12 14z"
            fill="#088df9"
            stroke="#fff"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="16" cy="12" r="10.5" fill="#088df9" stroke="#fff" strokeWidth="2" />
          <text
            x="16"
            y="15.5"
            textAnchor="middle"
            fontSize="8.5"
            fontWeight="800"
            fill="#fff"
          >
            {initialsOf(person.name)}
          </text>
        </svg>
      </div>
    </AdvancedMarker>
  );
}
