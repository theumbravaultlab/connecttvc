"use client";

import { useEffect } from "react";
import { APIProvider, AdvancedMarker, Map, useMap } from "@vis.gl/react-google-maps";
import type { Group } from "@/lib/types";
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

function hasLocation(g: Group): g is LocatedGroup {
  return typeof g.lat === "number" && typeof g.lng === "number";
}

export function FinderMap({
  groups,
  selectedId,
  onSelect,
}: {
  groups: Group[];
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

  return (
    <APIProvider apiKey={BROWSER_KEY}>
      <MapInner groups={groups} selectedId={selectedId} onSelect={onSelect} />
    </APIProvider>
  );
}

function MapInner({
  groups,
  selectedId,
  onSelect,
}: {
  groups: Group[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const located = groups.filter(hasLocation);
  const missing = groups.length - located.length;

  return (
    <div className="relative h-full w-full">
      <Map
        mapId={MAP_ID}
        defaultCenter={located[0] ? { lat: located[0].lat, lng: located[0].lng } : FALLBACK_CENTER}
        defaultZoom={located.length ? 11 : 4}
        gestureHandling="greedy"
        disableDefaultUI={false}
        className="h-full w-full"
      >
        <FitToGroups groups={located} />
        {located.map((g, i) => (
          <GroupPin
            key={g.id}
            group={g}
            index={i}
            selected={g.id === selectedId}
            onSelect={onSelect}
          />
        ))}
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

/** Fits/recenters the map whenever the visible (filtered) group set changes. */
function FitToGroups({ groups }: { groups: LocatedGroup[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || groups.length === 0) return;
    if (groups.length === 1) {
      map.setCenter({ lat: groups[0].lat, lng: groups[0].lng });
      map.setZoom(13);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    groups.forEach((g) => bounds.extend({ lat: g.lat, lng: g.lng }));
    map.fitBounds(bounds, 60);
  }, [map, groups]);

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
          className="text-[12px] font-extrabold text-white"
          style={{ transform: "rotate(45deg)" }}
        >
          {index + 1}
        </span>
      </span>
    </AdvancedMarker>
  );
}
