"use client";

import { useEffect } from "react";
import { AdvancedMarker, Map, useMap } from "@vis.gl/react-google-maps";
import { initialsOf, type Group, type Person } from "@/lib/types";
import { lifeColors } from "@/lib/colors";

const BROWSER_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? "";
// "DEMO_MAP_ID" is Google's official placeholder for local development —
// swap in a real Map ID (Google Cloud → Maps Management → Map IDs) before
// deploying; it's a free, non-secret identifier, not an API key.
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";

// Geographic center of the contiguous US — only used until any group has a
// real geocoded location.
const FALLBACK_CENTER = { lat: 39.8283, lng: -98.5795 };

type LocatedGroup = Group & { lat: number; lng: number };
type LatLng = { lat: number; lng: number };

function hasLocation(g: Group): g is LocatedGroup {
  return typeof g.lat === "number" && typeof g.lng === "number";
}

function personLocation(p: Person | null | undefined): LatLng | null {
  if (!p || typeof p.lat !== "number" || typeof p.lng !== "number") return null;
  return { lat: p.lat, lng: p.lng };
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
  if (!BROWSER_KEY) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#eaf3fc] p-6 text-center text-[13px] font-semibold text-[#5b7a97]">
        Map needs a Google Maps browser key — add
        NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY to .env.local.
      </div>
    );
  }

  const located = groups.filter(hasLocation);
  const missing = groups.length - located.length;
  const personPoint = personLocation(person);
  const fitPoints: LatLng[] = personPoint
    ? [...located, personPoint]
    : located;

  return (
    <div className="relative h-full w-full">
      <Map
        mapId={MAP_ID}
        defaultCenter={fitPoints[0] ?? FALLBACK_CENTER}
        defaultZoom={fitPoints.length ? 11 : 4}
        gestureHandling="greedy"
        disableDefaultUI={false}
        className="h-full w-full"
      >
        <FitToPoints points={fitPoints} />
        {located.map((g, i) => (
          <GroupPin
            key={g.id}
            group={g}
            index={i}
            selected={g.id === selectedId}
            onSelect={onSelect}
          />
        ))}
        {person && personPoint && (
          <PersonPin person={person} position={personPoint} />
        )}
      </Map>

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
 * person) change. */
function FitToPoints({ points }: { points: LatLng[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || points.length === 0) return;
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
  group,
  index,
  selected,
  onSelect,
}: {
  group: LocatedGroup;
  index: number;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const c = lifeColors(group.life);

  return (
    <AdvancedMarker
      position={{ lat: group.lat, lng: group.lng }}
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
 * to — a circle (not a teardrop) in brand blue so it never reads as just
 * another group. */
function PersonPin({ person, position }: { person: Person; position: LatLng }) {
  return (
    <AdvancedMarker position={position} zIndex={40} title={person.name}>
      <span
        className="flex h-[34px] w-[34px] items-center justify-center rounded-full text-[11px] font-extrabold text-white"
        style={{
          background: "#088df9",
          boxShadow: "0 0 0 3px #fff, 0 8px 18px rgba(8,141,249,.42)",
        }}
      >
        {initialsOf(person.name)}
      </span>
    </AdvancedMarker>
  );
}
