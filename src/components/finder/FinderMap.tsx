"use client";

import { useEffect, useMemo } from "react";
import { AdvancedMarker, ColorScheme, Map as GoogleMap, useMap } from "@vis.gl/react-google-maps";
import { displayName, initialsOf, type Group, type Person } from "@/lib/types";
import { groupPinColor, statusSolid } from "@/lib/colors";
import { UsersIcon } from "@/components/icons";
import { useTheme } from "@/components/ThemeProvider";

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

/** Short 2-letter pin label for a group. Most groups are now named
 * "The <Surname>" (see 009_couple_host_naming.sql) — the ordinary
 * initials scheme (first letter of first word + first letter of last
 * word) collapses almost all of these to "T" + one letter, since "The"
 * is always the first word — a 26-way collision across the whole
 * dataset. Stripping "The " and using the first two letters of the
 * actual surname instead gives a far more distinctive, recognizable
 * shorthand. Falls back to the ordinary initials scheme for any group
 * not using that naming convention. */
function groupPinLabel(name: string): string {
  const trimmed = name.trim();
  const stripped = trimmed.replace(/^the\s+/i, "");
  if (stripped !== trimmed) {
    const lastWord = stripped.split(/\s+/).filter(Boolean).pop() ?? "";
    return (lastWord.slice(0, 2) || "?").toUpperCase();
  }
  return initialsOf(name);
}

// A pin to be rendered, tagged so jittered positions can be routed back to
// the right visual (teardrop group pin, the one "Finding for" silhouette,
// or a smaller status-colored person pin).
type MapPin =
  | { kind: "group"; id: string; lat: number; lng: number; group: LocatedGroup }
  | { kind: "person"; id: string; lat: number; lng: number; person: Person }
  | { kind: "statusPerson"; id: string; lat: number; lng: number; person: Person };

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
// both this map and the Directory's address autocomplete share one loaded
// Maps JS instance instead of loading the script twice.
export function FinderMap({
  groups,
  person,
  statusPeople,
  selectedId,
  onSelect,
  showAllPeople,
  onToggleShowAllPeople,
  showPeopleAvailable,
}: {
  groups: Group[];
  /** The currently selected "Finding for" person, if any — shown as a
   * distinct pin and included when fitting the map to visible points. */
  person?: Person | null;
  /** Everyone to render as a smaller, status-colored pin when
   * `showAllPeople` is on — already scoped by the caller to either "the
   * selected group's roster" or "everyone", and already excludes `person`
   * so the two pin types never overlap for the same person. */
  statusPeople: Person[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  showAllPeople: boolean;
  onToggleShowAllPeople: () => void;
  /** Hide the toggle entirely when there's no one to show (e.g. no People
   * data at all), same guard the "Finding for" search already uses. */
  showPeopleAvailable: boolean;
}) {
  const { theme } = useTheme();
  const located = groups.filter(hasLocation);
  const missing = groups.length - located.length;
  const personPoint = personLocation(person);
  const locatedStatusPeople = useMemo(
    () => statusPeople.filter((p): p is Person & { lat: number; lng: number } =>
      typeof p.lat === "number" && typeof p.lng === "number",
    ),
    [statusPeople],
  );

  // Fit-to-bounds only ever considers groups + the "Finding for" person —
  // the status-colored roster pins render on the map but deliberately don't
  // affect auto-zoom, so toggling "Show people" never yanks the viewport.
  const fitPoints = useMemo(() => {
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
    return raw;
  }, [located, person, personPoint]);

  const pins = useMemo(() => {
    const raw: MapPin[] = [...fitPoints];
    for (const p of locatedStatusPeople) {
      raw.push({ kind: "statusPerson", id: p.id, lat: p.lat, lng: p.lng, person: p });
    }
    return spreadOverlaps(raw);
  }, [fitPoints, locatedStatusPeople]);

  if (!BROWSER_KEY) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[var(--panel-3)] p-6 text-center text-[13px] font-semibold text-[var(--muted)]">
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
        colorScheme={theme === "dark" ? ColorScheme.DARK : ColorScheme.LIGHT}
        className="h-full w-full"
      >
        <FitToPoints points={fitPoints} active={!!person} />
        {pins.map((pin) => {
          if (pin.kind === "group") {
            return (
              <GroupPin
                key={pin.id}
                position={{ lat: pin.lat, lng: pin.lng }}
                group={pin.group}
                selected={pin.group.id === selectedId}
                onSelect={onSelect}
              />
            );
          }
          if (pin.kind === "person") {
            return (
              <PersonPin
                key={`person-${pin.id}`}
                position={{ lat: pin.lat, lng: pin.lng }}
                person={pin.person}
              />
            );
          }
          return (
            <StatusPersonPin
              key={`status-${pin.id}`}
              position={{ lat: pin.lat, lng: pin.lng }}
              person={pin.person}
            />
          );
        })}
      </GoogleMap>

      {showPeopleAvailable && (
        <button
          type="button"
          onClick={onToggleShowAllPeople}
          aria-pressed={showAllPeople}
          className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold shadow-[0_2px_8px_rgba(22,50,79,.18)] backdrop-blur transition-colors"
          style={
            showAllPeople
              ? { background: "var(--brand-blue)", color: "#fff" }
              : { background: "color-mix(in srgb, var(--surface) 92%, transparent)", color: "var(--muted)" }
          }
        >
          <UsersIcon width={14} height={14} />
          {showAllPeople ? "Showing people" : "Show people"}
        </button>
      )}

      {missing > 0 && (
        <div className="absolute bottom-3 left-3 rounded-full bg-[var(--surface)]/90 px-3 py-1 text-[11px] font-bold text-[var(--muted)] backdrop-blur">
          {missing} group{missing === 1 ? "" : "s"} missing a location — save
          its address in the Directory to place it on the map.
        </div>
      )}
    </div>
  );
}

/** Default view is always the full DFW bounds — the user zooms/pans
 * manually from there while just browsing/filtering groups. The map only
 * auto-zooms to fit specific points while a "Finding for" person is
 * actively selected (`active`), since that's the one case where jumping to
 * a relevant area is actually helpful rather than disorienting. */
function FitToPoints({ points, active }: { points: LatLng[]; active: boolean }) {
  const map = useMap();

  // Re-applied only when `active` flips (person selected/cleared) — never
  // just because filters change, so manual zoom/pan is preserved while
  // browsing.
  useEffect(() => {
    if (!map || active) return;
    map.fitBounds(DFW_BOUNDS);
  }, [map, active]);

  useEffect(() => {
    if (!map || !active) return;
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
  }, [map, active, points]);

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
  // Life-stage color while the group is actually actionable, a flat gray
  // once it's Closed — see groupPinColor()'s own comment for why this
  // reads better than coloring all three statuses (mostly "Open") would.
  const color = groupPinColor(group);

  return (
    <AdvancedMarker
      position={position}
      onClick={() => onSelect(group.id)}
      zIndex={selected ? 35 : 10}
      title={group.name}
    >
      <div className="relative flex h-[44px] w-[44px] items-center justify-center">
        {selected && (
          <span
            className="hw-pulse-ring"
            style={{ width: 34, height: 34, background: color, opacity: 0.55 }}
          />
        )}
        <span
          className="relative flex h-[30px] w-[30px] items-center justify-center transition-transform duration-150"
          style={{
            background: color,
            borderRadius: "50% 50% 50% 0",
            transform: `rotate(-45deg) scale(${selected ? 1.32 : 1})`,
            boxShadow: selected
              ? "0 8px 20px rgba(8,141,249,.48), 0 0 0 4px rgba(255,255,255,.95)"
              : "0 3px 9px rgba(22,50,79,.3)",
          }}
        >
          <span
            className="text-[11px] font-extrabold text-white"
            style={{ transform: "rotate(45deg)" }}
          >
            {groupPinLabel(group.name)}
          </span>
        </span>
      </div>
    </AdvancedMarker>
  );
}

/** Distinct "you are here"-style pin for the person "Finding for" is set
 * to — a person silhouette (head + shoulders), colored by their own
 * status (same as the roster pins below) rather than always blue, with
 * the person's initials in the head. Still reads as distinct from a
 * group teardrop or a roster pin via its larger size, pulsing halo, and
 * top z-index, not via a fixed color anymore. */
function PersonPin({ position, person }: { position: LatLng; person: Person }) {
  const color = statusSolid(person.status);
  return (
    <AdvancedMarker position={position} zIndex={40} title={displayName(person)}>
      <div className="relative flex h-[52px] w-[46px] items-center justify-center">
        <span
          className="hw-pulse-ring"
          style={{ width: 38, height: 38, background: color, opacity: 0.5 }}
        />
        <div
          className="relative"
          style={{ filter: "drop-shadow(0 3px 8px rgba(22,50,79,.5))" }}
        >
          <svg width="36" height="42" viewBox="0 0 32 38" fill="none">
            <path
              d="M4 37c0-13 6-14 12-14s12 1 12 14z"
              fill={color}
              stroke="#fff"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <circle cx="16" cy="12" r="10.5" fill={color} stroke="#fff" strokeWidth="2.5" />
            <text
              x="16"
              y="15.5"
              textAnchor="middle"
              fontSize="8.5"
              fontWeight="800"
              fill="#fff"
            >
              {initialsOf(displayName(person))}
            </text>
          </svg>
        </div>
      </div>
    </AdvancedMarker>
  );
}

/** A person shown because "Show people" is on — same silhouette shape as
 * PersonPin but smaller, colored by their status instead of always blue,
 * and with lower z-index so it never competes with the "Finding for" pin
 * or a selected group pin. */
function StatusPersonPin({ position, person }: { position: LatLng; person: Person }) {
  const color = statusSolid(person.status);
  return (
    <AdvancedMarker position={position} zIndex={20} title={`${displayName(person)} · ${person.status}`}>
      <div style={{ filter: "drop-shadow(0 2px 5px rgba(22,50,79,.32))" }}>
        <svg width="23" height="27" viewBox="0 0 32 38" fill="none">
          <path
            d="M4 37c0-13 6-14 12-14s12 1 12 14z"
            fill={color}
            stroke="#fff"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <circle cx="16" cy="12" r="10.5" fill={color} stroke="#fff" strokeWidth="2.5" />
          <text
            x="16"
            y="15.5"
            textAnchor="middle"
            fontSize="8.5"
            fontWeight="800"
            fill="#fff"
          >
            {initialsOf(displayName(person))}
          </text>
        </svg>
      </div>
    </AdvancedMarker>
  );
}
