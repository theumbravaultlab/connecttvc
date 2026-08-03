"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AdvancedMarker, ColorScheme, Map as GoogleMap, useMap } from "@vis.gl/react-google-maps";
import {
  initialsOf,
  LIFE_STAGES,
  partyDisplayName,
  type Group,
  type Party,
  type PeopleLayerMode,
  type Person,
} from "@/lib/types";
import { groupPinColor, lifeColors, statusSolid } from "@/lib/colors";
import { HomeMark, UsersIcon } from "@/components/icons";
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

const PEOPLE_LAYER_LABELS: Record<PeopleLayerMode, string> = {
  off: "Show people",
  unassigned: "Showing: Unassigned",
  assigned: "Showing: Assigned",
  all: "Showing: All",
};

type LocatedGroup = Group & { lat: number; lng: number };
type LatLng = { lat: number; lng: number };

function hasLocation(g: Group): g is LocatedGroup {
  return typeof g.lat === "number" && typeof g.lng === "number";
}

function partyLocation(p: Party | null | undefined): LatLng | null {
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
// or a smaller status-colored party pin).
type MapPin =
  | { kind: "group"; id: string; lat: number; lng: number; group: LocatedGroup }
  | { kind: "party"; id: string; lat: number; lng: number; party: Party }
  | { kind: "statusParty"; id: string; lat: number; lng: number; party: Party };

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
  party,
  people,
  statusParties,
  selectedId,
  onSelect,
  onDeselect,
  peopleLayer,
  onCyclePeopleLayer,
  showPeopleAvailable,
}: {
  groups: Group[];
  /** The currently selected "Finding for" party, if any — shown as a
   * distinct pin and included when fitting the map to visible points. */
  party?: Party | null;
  /** Every person, used only to look up each rendered party's members (for
   * pin initials/tooltips) — never rendered as its own pin. */
  people: Person[];
  /** Every party to render as a smaller, status-colored pin for the
   * current `peopleLayer` mode — already scoped by the caller (global, by
   * assignment status) and already excludes `party` so the two pin types
   * never overlap for the same party. */
  statusParties: Party[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Clears the selected group — fired by clicking anything on the map
   * that isn't a group pin (the map background, a party/status pin, or the
   * permanent church marker), so a group only stays selected while it's
   * the thing actually being looked at. */
  onDeselect: () => void;
  peopleLayer: PeopleLayerMode;
  /** Advances the single "Show people" button to its next mode: off ->
   * unassigned -> assigned -> all -> off. */
  onCyclePeopleLayer: () => void;
  /** Hide the toggle entirely when there's no one to show (e.g. no Parties
   * data at all), same guard the "Finding for" search already uses. */
  showPeopleAvailable: boolean;
}) {
  const router = useRouter();
  const { theme } = useTheme();
  const located = groups.filter(hasLocation);
  const missingGroups = groups.filter((g) => !hasLocation(g));
  const partyPoint = partyLocation(party);

  const membersByParty = useMemo(() => {
    const map = new Map<string, Person[]>();
    for (const person of people) {
      const list = map.get(person.partyId) ?? [];
      list.push(person);
      map.set(person.partyId, list);
    }
    return map;
  }, [people]);

  const locatedStatusParties = useMemo(
    () => statusParties.filter((p): p is Party & { lat: number; lng: number } =>
      typeof p.lat === "number" && typeof p.lng === "number",
    ),
    [statusParties],
  );

  // Fit-to-bounds only ever considers groups + the "Finding for" party —
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
    if (party && partyPoint) {
      raw.push({ kind: "party", id: party.id, lat: partyPoint.lat, lng: partyPoint.lng, party });
    }
    return raw;
  }, [located, party, partyPoint]);

  const pins = useMemo(() => {
    const raw: MapPin[] = [...fitPoints];
    for (const p of locatedStatusParties) {
      raw.push({ kind: "statusParty", id: p.id, lat: p.lat, lng: p.lng, party: p });
    }
    return spreadOverlaps(raw);
  }, [fitPoints, locatedStatusParties]);

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
        onClick={onDeselect}
      >
        <FitToPoints points={fitPoints} active={!!party} />
        <ChurchMarker onClick={onDeselect} />
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
          if (pin.kind === "party") {
            return (
              <PartyPin
                key={`party-${pin.id}`}
                position={{ lat: pin.lat, lng: pin.lng }}
                party={pin.party}
                members={membersByParty.get(pin.party.id) ?? []}
                onClick={onDeselect}
              />
            );
          }
          return (
            <StatusPartyPin
              key={`status-${pin.id}`}
              position={{ lat: pin.lat, lng: pin.lng }}
              party={pin.party}
              members={membersByParty.get(pin.party.id) ?? []}
              onClick={onDeselect}
            />
          );
        })}
      </GoogleMap>

      <LifeStageLegend />

      {showPeopleAvailable && (
        <button
          type="button"
          onClick={onCyclePeopleLayer}
          aria-pressed={peopleLayer !== "off"}
          title="Cycles: off -> unassigned -> assigned -> all"
          className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold shadow-[0_2px_8px_rgba(22,50,79,.18)] backdrop-blur transition-colors"
          style={
            peopleLayer !== "off"
              ? { background: "var(--brand-blue)", color: "#fff" }
              : { background: "color-mix(in srgb, var(--surface) 92%, transparent)", color: "var(--muted)" }
          }
        >
          <UsersIcon width={14} height={14} />
          {PEOPLE_LAYER_LABELS[peopleLayer]}
        </button>
      )}

      {missingGroups.length > 0 && (
        <div className="absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] rounded-2xl bg-[var(--surface)]/95 px-3 py-2 text-[11px] font-bold text-[var(--muted)] shadow-[0_2px_8px_rgba(22,50,79,.18)] backdrop-blur">
          <div>
            {missingGroups.length} group{missingGroups.length === 1 ? "" : "s"} missing a
            location — likely an address that could not be geocoded:
          </div>
          <div className="mt-1 flex flex-wrap gap-x-1 gap-y-1">
            {missingGroups.map((g, i) => (
              <span key={g.id}>
                <button
                  type="button"
                  onClick={() => router.push(`/directory/groups/${g.id}`)}
                  className="font-extrabold text-[var(--brand-blue)] hover:underline"
                >
                  {g.name}
                </button>
                {i < missingGroups.length - 1 ? "," : ""}
              </span>
            ))}
          </div>
          <div className="mt-1 font-semibold text-[var(--faint)]">
            Click a name to open it, then re-enter (or fix) its address.
          </div>
        </div>
      )}
    </div>
  );
}

/** Centered legend above the map, one swatch + name per life stage — the
 * same 5 hues `groupPinColor()` uses for New/Open groups (a Closed group's
 * flat gray isn't a life stage, so it's deliberately not listed here). */
function LifeStageLegend() {
  return (
    <div className="pointer-events-none absolute left-1/2 top-3 flex max-w-[calc(100%-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full bg-[var(--surface)]/95 px-3.5 py-1.5 shadow-[0_2px_8px_rgba(22,50,79,.18)] backdrop-blur">
      {LIFE_STAGES.map((stage) => (
        <span key={stage} className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--muted)]">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: lifeColors(stage).solid }}
          />
          {stage}
        </span>
      ))}
    </div>
  );
}

/** Default view is always the full DFW bounds — the user zooms/pans
 * manually from there while just browsing/filtering groups. The map only
 * auto-zooms to fit specific points while a "Finding for" party is
 * actively selected (`active`), since that's the one case where jumping to
 * a relevant area is actually helpful rather than disorienting. */
function FitToPoints({ points, active }: { points: LatLng[]; active: boolean }) {
  const map = useMap();

  // Re-applied only when `active` flips (party selected/cleared) — never
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

/** Distinct "you are here"-style pin for the party "Finding for" is set
 * to — a person silhouette (head + shoulders), colored by the party's own
 * status (same as the roster pins below) rather than always blue, with
 * the party's initials in the head. Still reads as distinct from a group
 * teardrop or a roster pin via its larger size, pulsing halo, and top
 * z-index, not via a fixed color anymore. */
function PartyPin({
  position,
  party,
  members,
  onClick,
}: {
  position: LatLng;
  party: Party;
  members: Person[];
  onClick: () => void;
}) {
  const color = statusSolid(party.status);
  const label = partyDisplayName(party, members);
  return (
    <AdvancedMarker position={position} zIndex={40} title={label} onClick={onClick}>
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
              {initialsOf(label)}
            </text>
          </svg>
        </div>
      </div>
    </AdvancedMarker>
  );
}

/** A party shown because "Show people" is on — same silhouette shape as
 * PartyPin but smaller, colored by status instead of always blue, and with
 * lower z-index so it never competes with the "Finding for" pin or a
 * selected group pin. */
function StatusPartyPin({
  position,
  party,
  members,
  onClick,
}: {
  position: LatLng;
  party: Party;
  members: Person[];
  onClick: () => void;
}) {
  const color = statusSolid(party.status);
  const label = partyDisplayName(party, members);
  return (
    <AdvancedMarker
      position={position}
      zIndex={20}
      title={`${label} · ${party.status}`}
      onClick={onClick}
    >
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
            {initialsOf(label)}
          </text>
        </svg>
      </div>
    </AdvancedMarker>
  );
}

// The actual physical church this org meets at — 2101 Justin Rd, Flower
// Mound, TX 75028-3831, geocoded directly via the Google Geocoding API
// (same one the app itself uses) rather than guessed, since this is a real
// fixed landmark, not sample/generated data. Always rendered, on every view
// (browse or "Finding for"), and deliberately not part of `fitPoints` — it's
// a permanent orientation landmark, not something that should pull the
// auto-zoom toward it.
const CHURCH_POSITION: LatLng = { lat: 33.0269509, lng: -97.04275799999999 };
const CHURCH_NAME = "The Village Church";

/** Large, permanent church-icon marker — the same house glyph as the
 * header's HomeMark, just bigger and non-interactive beyond a hover title
 * and the standard "clicking anything but a group pin deselects" behavior
 * every other non-group marker shares. */
function ChurchMarker({ onClick }: { onClick: () => void }) {
  return (
    <AdvancedMarker position={CHURCH_POSITION} zIndex={30} title={CHURCH_NAME} onClick={onClick}>
      <HomeMark
        width={44}
        height={44}
        style={{ boxShadow: "0 4px 14px rgba(8,141,249,.5), 0 0 0 3px #fff" }}
      />
    </AdvancedMarker>
  );
}
