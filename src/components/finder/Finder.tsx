"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DAY_LONG,
  GROUP_STATUSES,
  LIFE_STAGES,
  initialsOf,
  nextPeopleLayerMode,
  partyDisplayName,
  partyMemberNames,
  type DayShort,
  type Group,
  type GroupStatus,
  type Party,
  type PeopleLayerMode,
  type Person,
} from "@/lib/types";
import { ageMatchesRange } from "@/lib/ageRange";
import { lifeColors } from "@/lib/colors";
import { Avatar, PartyTag } from "@/components/ui";
import {
  CarIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  EditIcon,
  PinIcon,
  SearchIcon,
  XIcon,
} from "@/components/icons";
import { getTravelTimesToGroups } from "@/app/actions";
import type { TravelTime } from "@/lib/routes";
import { FinderMap } from "./FinderMap";
import { GroupCard } from "./GroupCard";
import { PartySearch } from "./PartySearch";

const DAY_FILTERS: DayShort[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const EMPTY_TRAVEL_TIMES: Record<string, TravelTime> = {};

export function Finder({
  groups,
  parties,
  people,
}: {
  groups: Group[];
  /** Leader-only: enables the "Finding for" matcher. Empty for public. */
  parties: Party[];
  people: Person[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState("");
  const [days, setDays] = useState<Set<DayShort>>(new Set());
  const [areas, setAreas] = useState<Set<string>>(new Set());
  const [life, setLife] = useState("All");
  const [status, setStatus] = useState<GroupStatus | "All">("All");
  // Picks up a deep-link from the Directory's "Find for" button
  // (?party=<id>) directly in the initial state — searchParams and parties
  // are both already available synchronously at first render (this route
  // is fully dynamic, so this even resolves correctly during SSR, not just
  // after a client-side effect), so this needs no effect at all.
  const [partyId, setPartyId] = useState<string>(() => {
    const paramPartyId = searchParams.get("party");
    return paramPartyId && parties.some((p) => p.id === paramPartyId) ? paramPartyId : "";
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "map">("list");
  // Tagged with the party it was fetched for, so switching to a party with
  // no location (or whose matches all lack one) can never display an
  // unrelated party's stale distances — simpler and more robust than
  // clearing this back to empty via an effect on every party change.
  const [travelTimes, setTravelTimes] = useState<{
    partyId: string;
    times: Record<string, TravelTime>;
  } | null>(null);
  // Off by default — keeps the map uncluttered until a coordinator actually
  // wants to see people on it. Persists across party/group selection
  // changes (unlike the "matched on" toggles below), since it's a general
  // map display preference, not part of any one search. Global rather than
  // scoped to a selected group — selecting a group pin doesn't narrow this
  // layer, it's purely a "placed vs. not placed" view of everyone.
  const [peopleLayer, setPeopleLayer] = useState<PeopleLayerMode>("off");
  const findingForId = useId();
  const lifeId = useId();
  const statusId = useId();
  const statusId2 = useId();

  const party = parties.find((p) => p.id === partyId) ?? null;
  const partyMembers = useMemo(
    () => (party ? people.filter((p) => p.partyId === party.id) : []),
    [party, people],
  );
  const effectiveTravelTimes =
    travelTimes && travelTimes.partyId === party?.id ? travelTimes.times : EMPTY_TRAVEL_TIMES;

  // Cleans the URL after picking up a ?party= deep-link (see the partyId
  // initializer above) so a later refresh doesn't keep reapplying it. This
  // is the one piece of the deep-link that's a genuine side effect (history
  // navigation) rather than state — everything else already happened
  // during the initial render, so this effect calls no setState at all.
  useEffect(() => {
    if (searchParams.get("party")) {
      router.replace("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When finding for a specific party, each "matched on" criterion (their
  // available days, city, life stage, age, childcare need) can be
  // individually toggled off/back on to explore groups that wouldn't
  // otherwise qualify — reset to "all active" whenever the selected party
  // changes. Adjusted directly during render (React's documented pattern
  // for "reset state when an id changes") rather than in an effect, using
  // `prevPartyId` to detect the change — this avoids the extra render an
  // effect-based reset would otherwise cause.
  const [activeDays, setActiveDays] = useState<Set<DayShort>>(new Set());
  const [areaActive, setAreaActive] = useState(true);
  const [lifeActive, setLifeActive] = useState(true);
  const [ageActive, setAgeActive] = useState(true);
  const [childcareActive, setChildcareActive] = useState(true);
  // "Other groups that might work" — collapsed by default so it doesn't add
  // permanent visual weight; collapses again whenever the party changes.
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [prevPartyId, setPrevPartyId] = useState<string | null>(null);
  if (party && party.id !== prevPartyId) {
    setPrevPartyId(party.id);
    setActiveDays(new Set(party.days));
    setAreaActive(true);
    setLifeActive(true);
    setAgeActive(true);
    setChildcareActive(true);
    setShowSuggestions(false);
  } else if (!party && prevPartyId !== null) {
    setPrevPartyId(null);
  }

  // Area is auto-derived from each address's city (no fixed list anymore),
  // so the filter's options come from whatever areas actually show up.
  const areaOptions = useMemo(
    () => [...new Set(groups.map((g) => g.area).filter(Boolean))].sort(),
    [groups],
  );

  // Derived filtered list.
  const filtered = useMemo(() => {
    if (party) {
      return groups.filter((g) => {
        if (status !== "All" && g.status !== status) return false;
        if (activeDays.size > 0 && !activeDays.has(g.day)) return false;
        if (areaActive && g.area !== party.area) return false;
        if (lifeActive && g.life !== party.life) return false;
        if (ageActive && !ageMatchesRange(party.age, g.ageRange)) return false;
        if (childcareActive && party.childcareNeeded && !g.childcare) return false;
        return true;
      });
    }
    return groups.filter((g) => {
      if (days.size > 0 && !days.has(g.day)) return false;
      if (areas.size > 0 && !areas.has(g.area)) return false;
      if (life !== "All" && g.life !== life) return false;
      if (status !== "All" && g.status !== status) return false;
      if (q.trim()) {
        const hay = `${g.name} ${g.area} ${g.host}`.toLowerCase();
        if (!hay.includes(q.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [groups, party, days, areas, life, status, q, activeDays, areaActive, lifeActive, ageActive, childcareActive]);

  // When a city isn't narrowing the result (either the "Finding for"
  // party's city match is toggled off, since areaActive already reuses the
  // existing Routes API travel-time data computed for that party below),
  // fall back to sorting by Google Maps drive distance, closest first, so
  // the list stays useful without a city to anchor it.
  const displayGroups = useMemo(() => {
    if (!party || areaActive) return filtered;
    return [...filtered].sort((a, b) => {
      const ta = effectiveTravelTimes[a.id]?.minutes;
      const tb = effectiveTravelTimes[b.id]?.minutes;
      if (ta == null && tb == null) return 0;
      if (ta == null) return 1;
      if (tb == null) return -1;
      return ta - tb;
    });
  }, [filtered, party, areaActive, effectiveTravelTimes]);

  // Ranked "might still work" candidates — every group the strict match
  // excludes, scored by how many of the currently-*active* "matched on"
  // criteria it still satisfies (a toggled-off criterion never counts
  // against a group, same as the strict filter above). Only meaningful in
  // party-matched mode; empty otherwise. Capped at 6 so it stays a quick
  // scan, not a second full list.
  const suggestions = useMemo(() => {
    if (!party) return [];
    const criteria = (
      [
        activeDays.size > 0 && { key: "Day", satisfies: (g: Group) => activeDays.has(g.day) },
        areaActive && { key: party.area || "City", satisfies: (g: Group) => g.area === party.area },
        lifeActive && { key: party.life, satisfies: (g: Group) => g.life === party.life },
        ageActive && { key: "Age", satisfies: (g: Group) => ageMatchesRange(party.age, g.ageRange) },
        childcareActive && {
          key: "Childcare",
          satisfies: (g: Group) => !party.childcareNeeded || g.childcare,
        },
      ] as const
    ).filter((c): c is { key: string; satisfies: (g: Group) => boolean } => !!c);
    if (criteria.length === 0) return [];

    const strictIds = new Set(filtered.map((g) => g.id));
    return groups
      .filter((g) => !strictIds.has(g.id))
      .filter((g) => status === "All" || g.status === status)
      .map((g) => ({
        group: g,
        metKeys: criteria.filter((c) => c.satisfies(g)).map((c) => c.key),
        missedKeys: criteria.filter((c) => !c.satisfies(g)).map((c) => c.key),
        score: criteria.filter((c) => c.satisfies(g)).length,
      }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score || a.group.name.localeCompare(b.group.name))
      .slice(0, 6);
  }, [party, groups, filtered, status, activeDays, areaActive, lifeActive, ageActive, childcareActive]);

  // Clear the selection if it falls out of the visible set (person or
  // filter change) — never auto-picks a replacement. A selected suggestion
  // counts as visible too, so opening one doesn't immediately deselect it.
  // Adjusted directly during render rather than in an effect, same
  // "prevPersonId" pattern as above, since this is really just another
  // "reset when a derived value no longer applies" case.
  const stillVisible =
    filtered.some((g) => g.id === selectedId) || suggestions.some((s) => s.group.id === selectedId);
  if (selectedId && !stillVisible) {
    setSelectedId(null);
  }

  // Drive time from the selected party to every visible group, batched
  // into one Routes API call. Depends on primitive lat/lng/id rather than
  // the `party` object itself so editing an unrelated field elsewhere
  // (e.g. in the Directory, since state is shared) doesn't trigger a
  // refetch. No synchronous setState here — an empty/no-destination case
  // just skips the fetch and lets `effectiveTravelTimes` (above) keep any
  // stale state from being shown, tagged-by-partyId, rather than this
  // effect needing to clear it itself.
  useEffect(() => {
    if (!party || party.lat == null || party.lng == null) return;
    const candidates = [...filtered, ...suggestions.map((s) => s.group)].filter(
      (g, i, arr) => arr.findIndex((x) => x.id === g.id) === i,
    );
    const destinations = candidates
      .filter((g): g is typeof g & { lat: number; lng: number } =>
        g.lat != null && g.lng != null,
      )
      .map((g) => ({ id: g.id, lat: g.lat, lng: g.lng }));
    if (destinations.length === 0) return;
    let cancelled = false;
    getTravelTimesToGroups({ lat: party.lat, lng: party.lng }, destinations).then(
      (result) => {
        if (!cancelled) setTravelTimes({ partyId: party.id, times: result });
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [party?.id, party?.lat, party?.lng, filtered, suggestions]);

  // Scroll the selected card to the top of the list container. Uses
  // getBoundingClientRect rather than offsetTop, since offsetTop is relative
  // to the nearest positioned ancestor (which may not be the scroll
  // container at all here) and was scrolling the card out of view instead
  // of to the top.
  const listRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    if (!selectedId) return;
    const container = listRef.current;
    const card = cardRefs.current[selectedId];
    if (container && card) {
      const delta = card.getBoundingClientRect().top - container.getBoundingClientRect().top;
      container.scrollTo({ top: container.scrollTop + delta - 14, behavior: "smooth" });
    }
  }, [selectedId]);

  const clearParty = () => {
    setPartyId("");
    setSelectedId(null);
  };

  const toggleDay = (d: DayShort) =>
    setDays((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });

  const toggleArea = (city: string) =>
    setAreas((prev) => {
      const next = new Set(prev);
      if (next.has(city)) next.delete(city);
      else next.add(city);
      return next;
    });

  // Used by the search dropdown's "pick a city" suggestion — always adds
  // (never removes), since a quick-jump lookup shouldn't accidentally
  // deselect a city someone already chose via the City filter itself.
  const selectArea = (city: string) => setAreas((prev) => new Set(prev).add(city));

  // Only relevant in browse mode (no person selected) — the person-matched
  // mode has its own "matched on" chips for broadening/narrowing instead.
  const activeFilterCount =
    (q.trim() ? 1 : 0) +
    (days.size > 0 ? 1 : 0) +
    (areas.size > 0 ? 1 : 0) +
    (life !== "All" ? 1 : 0) +
    (status !== "All" ? 1 : 0);

  const clearAllFilters = () => {
    setQ("");
    setDays(new Set());
    setAreas(new Set());
    setLife("All");
    setStatus("All");
  };

  // Who shows up as a status-colored pin on the map for the current
  // "Show people" layer mode — global, not scoped to a selected group (see
  // the peopleLayer state comment above). The "Finding for" party always
  // keeps its own distinct pin (see FinderMap) so it's never duplicated
  // into this set.
  const statusParties = useMemo(() => {
    const base =
      peopleLayer === "off"
        ? []
        : peopleLayer === "unassigned"
          ? parties.filter((p) => p.group === null)
          : peopleLayer === "assigned"
            ? parties.filter((p) => p.group !== null)
            : parties;
    return party ? base.filter((p) => p.id !== party.id) : base;
  }, [peopleLayer, parties, party]);

  // The map normally only shows strict-match pins — but if a coordinator
  // selects a suggested candidate (not part of the strict list), its pin
  // still needs to render so "selected" actually means something there too.
  const mapGroups = useMemo(() => {
    const selectedSuggestion = suggestions.find((s) => s.group.id === selectedId)?.group;
    if (selectedSuggestion && !displayGroups.some((g) => g.id === selectedSuggestion.id)) {
      return [...displayGroups, selectedSuggestion];
    }
    return displayGroups;
  }, [displayGroups, suggestions, selectedId]);

  const statusSelect = (id: string, full?: boolean) => (
    <select
      id={id}
      value={status}
      onChange={(e) => setStatus(e.target.value as GroupStatus | "All")}
      className={`rounded-[9px] border border-[var(--border)] bg-[var(--panel-1)] px-2.5 text-[12px] font-semibold text-[var(--ink)] outline-none transition-colors focus:border-[var(--brand-blue)] focus:ring-2 focus:ring-[var(--brand-blue)]/30 ${full ? "w-full py-2" : "py-1.5"}`}
    >
      <option value="All">All statuses</option>
      {GROUP_STATUSES.map((s) => (
        <option key={s}>{s}</option>
      ))}
    </select>
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col md:flex-row">
        {/* mobile-only List / Map switch */}
        <div className="flex shrink-0 gap-1 border-b border-[var(--divider)] px-3 py-2 md:hidden">
          {(["list", "map"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setMobileView(v)}
              className="flex-1 rounded-full px-4 py-1.5 text-[13px] font-bold capitalize transition-colors"
              style={
                mobileView === v
                  ? { background: "var(--brand-blue)", color: "#fff" }
                  : { background: "var(--panel-4)", color: "var(--muted)" }
              }
            >
              {v}
            </button>
          ))}
        </div>

        {/* list column */}
        <div
          className={`${mobileView === "list" ? "flex" : "hidden"} min-h-0 w-full flex-1 flex-col md:flex md:w-[380px] md:flex-none md:border-r md:border-[var(--divider)]`}
        >
          {/* filter area */}
          <div className="shrink-0 border-b border-[var(--divider)] px-[15px] py-3.5">
            {parties.length > 0 && (
              <div className="mb-3">
                <label
                  htmlFor={findingForId}
                  className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--faint)]"
                >
                  Finding for
                </label>
                <PartySearch
                  id={findingForId}
                  parties={parties}
                  people={people}
                  selected={party}
                  onSelect={(id) => {
                    setPartyId(id);
                    setSelectedId(null);
                  }}
                  onClear={clearParty}
                />
              </div>
            )}

            {party ? (
              <div className="rounded-xl border border-[var(--border-accent)] bg-[var(--panel-2)] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <Avatar initials={initialsOf(partyDisplayName(party, partyMembers))} size={34} />
                    <div>
                      <div className="flex items-center gap-1.5 text-[13px] font-bold text-[var(--ink)]">
                        {partyDisplayName(party, partyMembers)}
                        <PartyTag partySize={partyMembers.length} />
                      </div>
                      {partyMembers.length > 1 && (
                        <div className="text-[11.5px] font-bold text-[var(--brand-blue)]">
                          {partyMemberNames(partyMembers)}
                        </div>
                      )}
                      <div className="text-[12px] font-semibold text-[var(--muted)]">
                        {party.notes.split(",")[0]} · lives in {party.area}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => router.push(`/directory/parties/${party.id}`)}
                      aria-label="Edit party details"
                      className="flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-bold text-[var(--brand-blue)] hover:bg-[var(--surface)]"
                    >
                      <EditIcon width={12} height={12} /> Edit
                    </button>
                    <button
                      onClick={clearParty}
                      className="flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-bold text-[var(--brand-blue)] hover:bg-[var(--surface)]"
                    >
                      <XIcon width={12} height={12} /> Clear
                    </button>
                  </div>
                </div>
                <div className="mt-2.5 flex items-baseline justify-between gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--faint)]">
                    Matched on
                  </span>
                  <span className="text-[11px] font-semibold text-[var(--faint)]">
                    Tap to include/exclude
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {party.days.map((d) => (
                    <MatchChip
                      key={d}
                      active={activeDays.has(d)}
                      onClick={() =>
                        setActiveDays((prev) => {
                          const next = new Set(prev);
                          if (next.has(d)) next.delete(d);
                          else next.add(d);
                          return next;
                        })
                      }
                    >
                      {DAY_LONG[d]}
                    </MatchChip>
                  ))}
                  <MatchChip active={areaActive} onClick={() => setAreaActive((v) => !v)}>
                    {party.area}
                  </MatchChip>
                  <MatchChip active={lifeActive} onClick={() => setLifeActive((v) => !v)}>
                    {party.life}
                  </MatchChip>
                  {party.age != null && (
                    <MatchChip active={ageActive} onClick={() => setAgeActive((v) => !v)}>
                      Age {party.age}
                    </MatchChip>
                  )}
                  {party.childcareNeeded && (
                    <MatchChip active={childcareActive} onClick={() => setChildcareActive((v) => !v)}>
                      Needs childcare
                    </MatchChip>
                  )}
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <label htmlFor={statusId2} className="sr-only">
                    Filter by status
                  </label>
                  {statusSelect(statusId2)}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <GroupCitySearch
                  query={q}
                  onQueryChange={setQ}
                  groups={groups}
                  cityOptions={areaOptions}
                  onSelectGroup={(id) => setSelectedId(id)}
                  onSelectCity={(city) => selectArea(city)}
                />

                {activeFilterCount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[var(--faint)]">
                      {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"} applied
                    </span>
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="text-[12px] font-bold text-[var(--brand-blue)] hover:underline"
                    >
                      Clear all
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  <DaysFilterPopover
                    selected={days}
                    onToggleDay={toggleDay}
                    onClear={() => setDays(new Set())}
                  />
                  <CityFilterPopover
                    selected={areas}
                    options={areaOptions}
                    onToggle={toggleArea}
                    onClear={() => setAreas(new Set())}
                  />
                  <div>
                    <label
                      htmlFor={lifeId}
                      className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--faint)]"
                    >
                      Life stage
                    </label>
                    <select
                      id={lifeId}
                      value={life}
                      onChange={(e) => setLife(e.target.value)}
                      className="w-full rounded-[9px] border border-[var(--border)] bg-[var(--panel-1)] px-2.5 py-2 text-[12px] font-semibold text-[var(--ink)] outline-none transition-colors focus:border-[var(--brand-blue)] focus:ring-2 focus:ring-[var(--brand-blue)]/30"
                    >
                      <option value="All">All stages</option>
                      {LIFE_STAGES.map((l) => (
                        <option key={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor={statusId}
                      className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--faint)]"
                    >
                      Status
                    </label>
                    {statusSelect(statusId, true)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* list scroll — clicking empty space here (padding, gaps between
              cards, below the last card) deselects, same "anything but the
              group itself" rule the map follows. Checked via closest() up
              to this container rather than a plain e.target === e.currentTarget
              check, so it fires regardless of DOM nesting (a bare "did this
              click land inside a card?" test), while still letting genuine
              controls in the list (the "show more" toggle, etc.) work as
              normal clicks rather than being treated as "clicking away". */}
          <div
            ref={listRef}
            onClick={(e) => {
              const target = e.target as HTMLElement;
              if (!target.closest("[data-card], button, a, input, select")) setSelectedId(null);
            }}
            className="hw-scroll min-h-0 flex-1 overflow-y-auto p-3.5"
          >
            {displayGroups.length === 0 ? (
              <div className="mt-10 px-4 text-center text-[13px] font-semibold text-[var(--faint)]">
                {party && suggestions.length > 0
                  ? "No exact matches — see other groups that might work below."
                  : "No groups match yet — try clearing a filter."}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {displayGroups.map((g, i) => (
                  <GroupCard
                    key={g.id}
                    ref={(el) => {
                      cardRefs.current[g.id] = el;
                    }}
                    group={g}
                    index={i}
                    selected={g.id === selectedId}
                    greatFit={!!party && g.life === party.life}
                    matchName={partyMembers[0]?.name.split(" ")[0]}
                    travelTime={effectiveTravelTimes[g.id]}
                    onSelect={() => setSelectedId(g.id)}
                  />
                ))}
              </div>
            )}

            {party && suggestions.length > 0 && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setShowSuggestions((v) => !v)}
                  aria-expanded={showSuggestions}
                  className="flex w-full items-center justify-between rounded-xl border border-dashed border-[var(--border)] px-3.5 py-2.5 text-left text-[12px] font-bold text-[var(--muted)] transition-colors hover:bg-[var(--panel-1)]"
                >
                  <span>
                    {showSuggestions ? "Hide" : "Show"} {suggestions.length} more group
                    {suggestions.length === 1 ? "" : "s"} that might work
                  </span>
                  <ChevronDownIcon
                    width={14}
                    height={14}
                    className="shrink-0 transition-transform"
                    style={{ transform: showSuggestions ? "rotate(180deg)" : undefined }}
                  />
                </button>
                {showSuggestions && (
                  <div className="mt-2 flex flex-col gap-2">
                    {suggestions.map((s) => (
                      <SuggestedGroupCard
                        key={s.group.id}
                        group={s.group}
                        metKeys={s.metKeys}
                        missedKeys={s.missedKeys}
                        selected={s.group.id === selectedId}
                        travelTime={effectiveTravelTimes[s.group.id]}
                        onSelect={() => setSelectedId(s.group.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* map column */}
        <div
          className={`${mobileView === "map" ? "block" : "hidden"} relative min-h-0 flex-1 md:block`}
        >
          <FinderMap
            groups={mapGroups}
            party={party}
            people={people}
            statusParties={statusParties}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onDeselect={() => setSelectedId(null)}
            peopleLayer={peopleLayer}
            onCyclePeopleLayer={() => setPeopleLayer(nextPeopleLayerMode)}
            showPeopleAvailable={parties.length > 0}
          />
        </div>
      </div>
  );
}

/** Compact "Day" filter — a single trigger button (showing a summary of the
 * current selection) that opens a small popover of day toggles, instead of
 * 8 always-visible pills competing with City/Life stage/Status for space. */
function DaysFilterPopover({
  selected,
  onToggleDay,
  onClear,
}: {
  selected: Set<DayShort>;
  onToggleDay: (d: DayShort) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label =
    selected.size === 0
      ? "Any day"
      : selected.size === 1
        ? DAY_LONG[[...selected][0]]
        : `${selected.size} days`;

  return (
    <div ref={rootRef} className="relative">
      <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--faint)]">
        Day
      </label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-1.5 rounded-[9px] border border-[var(--border)] bg-[var(--panel-1)] px-2.5 py-2 text-[12px] font-semibold text-[var(--ink)] outline-none transition-colors focus:border-[var(--brand-blue)] focus:ring-2 focus:ring-[var(--brand-blue)]/30"
        style={selected.size > 0 ? { borderColor: "var(--brand-blue)" } : undefined}
      >
        <span className="truncate">{label}</span>
        <ChevronDownIcon
          width={13}
          height={13}
          className="shrink-0 text-[var(--faint)] transition-transform"
          style={{ transform: open ? "rotate(180deg)" : undefined }}
        />
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-20 w-[230px] rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[0_10px_30px_rgba(22,50,79,.2)]">
          <div className="flex flex-wrap gap-1.5">
            {DAY_FILTERS.map((d) => {
              const active = selected.has(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onToggleDay(d)}
                  className="rounded-full border px-2.5 py-1 text-[12px] font-bold transition-all duration-100"
                  style={
                    active
                      ? { background: "var(--brand-blue)", color: "#fff", borderColor: "var(--brand-blue)" }
                      : { background: "var(--surface)", color: "var(--muted)", borderColor: "var(--border)" }
                  }
                >
                  {d}
                </button>
              );
            })}
          </div>
          {selected.size > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="mt-2.5 text-[12px] font-bold text-[var(--brand-blue)] hover:underline"
            >
              Clear days
            </button>
          )}
        </div>
      )}
    </div>
  );
}

type SearchScope = "all" | "groups" | "cities";
const SEARCH_SCOPES: { key: SearchScope; label: string }[] = [
  { key: "all", label: "All" },
  { key: "groups", label: "Groups" },
  { key: "cities", label: "Cities" },
];

/** Free-text lookup for the browse-mode search box — types still live-
 * filter the list below exactly as before, but this layers an actual
 * dropdown of matching group names and matching cities on top (same
 * click-to-jump idiom as PartySearch, including opening on focus/click
 * even before anything's typed, so there's a browsable list rather than
 * needing a name in mind). Picking a group selects it; picking a city
 * adds it to the City filter. A scope toggle (All/Groups/Cities, default
 * All) narrows which section(s) show. */
function GroupCitySearch({
  query,
  onQueryChange,
  groups,
  cityOptions,
  onSelectGroup,
  onSelectCity,
}: {
  query: string;
  onQueryChange: (v: string) => void;
  groups: Group[];
  cityOptions: string[];
  onSelectGroup: (id: string) => void;
  onSelectCity: (city: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<SearchScope>("all");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const matchingCities =
    scope === "groups"
      ? []
      : (q ? cityOptions.filter((c) => c.toLowerCase().includes(q)) : cityOptions).slice(0, 50);
  const matchingGroups =
    scope === "cities"
      ? []
      : (q ? groups.filter((g) => g.name.toLowerCase().includes(q)) : groups).slice(0, 50);
  const hasResults = matchingCities.length > 0 || matchingGroups.length > 0;

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <SearchIcon
          width={15}
          height={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]"
        />
        <input
          value={query}
          onChange={(e) => {
            onQueryChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search groups or cities…"
          aria-label="Search groups or cities"
          className="w-full rounded-[9px] border border-[var(--border)] bg-[var(--panel-1)] py-2 pl-9 pr-8 text-[13px] font-semibold text-[var(--ink)] outline-none focus:border-[var(--brand-blue)] focus:ring-2 focus:ring-[var(--brand-blue)]/30"
        />
        {query.length > 0 && (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-[var(--faint)] hover:bg-[var(--panel-4)] hover:text-[var(--muted)]"
          >
            <XIcon width={12} height={12} />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-[9px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_8px_20px_rgba(22,50,79,.14)]">
          <div className="flex items-center gap-1.5 border-b border-[var(--divider)] bg-[var(--panel-1)] px-2.5 py-1.5">
            {SEARCH_SCOPES.map((s) => (
              <button
                key={s.key}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setScope(s.key)}
                aria-pressed={scope === s.key}
                className="rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors"
                style={
                  scope === s.key
                    ? { background: "var(--brand-blue)", color: "#fff" }
                    : { background: "var(--surface)", color: "var(--muted)" }
                }
              >
                {s.label}
              </button>
            ))}
          </div>
          {hasResults ? (
            <ul className="max-h-64 overflow-y-auto py-1">
              {matchingCities.map((city) => (
                <li key={`city-${city}`}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onSelectCity(city);
                      onQueryChange("");
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[var(--panel-2)]"
                  >
                    <PinIcon width={13} height={13} className="shrink-0 text-[var(--faint)]" />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[var(--ink)]">
                      {city}
                    </span>
                    <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-wide text-[var(--faint)]">
                      City
                    </span>
                  </button>
                </li>
              ))}
              {matchingGroups.map((g) => (
                <li key={`group-${g.id}`}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onSelectGroup(g.id);
                      onQueryChange("");
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[var(--panel-2)]"
                  >
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[var(--ink)]">
                      {g.name}
                    </span>
                    <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-wide text-[var(--faint)]">
                      {g.area || "Group"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-3 py-2 text-[12px] font-semibold text-[var(--faint)]">
              {q ? <>No matches for &quot;{query.trim()}&quot;.</> : "Nothing to show yet."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Searchable, multiselect City filter — a plain <select> doesn't scale to
 * ~39 cities, and a Days-style flat pill list would overflow badly at that
 * count, so this adds a search box inside the popover on top of the same
 * toggle-to-select idiom. */
function CityFilterPopover({
  selected,
  options,
  onToggle,
  onClear,
}: {
  selected: Set<string>;
  options: string[];
  onToggle: (city: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  // Closes the popover and clears its search box in one place, so it's
  // always fresh next time it's reopened rather than remembering whatever
  // was last typed.
  const close = () => {
    setOpen(false);
    setQuery("");
  };

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label =
    selected.size === 0
      ? "All cities"
      : selected.size === 1
        ? [...selected][0]
        : `${selected.size} cities`;

  const q = query.trim().toLowerCase();
  const filteredOptions = q ? options.filter((o) => o.toLowerCase().includes(q)) : options;

  return (
    <div ref={rootRef} className="relative">
      <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--faint)]">
        City
      </label>
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-1.5 rounded-[9px] border border-[var(--border)] bg-[var(--panel-1)] px-2.5 py-2 text-[12px] font-semibold text-[var(--ink)] outline-none transition-colors focus:border-[var(--brand-blue)] focus:ring-2 focus:ring-[var(--brand-blue)]/30"
        style={selected.size > 0 ? { borderColor: "var(--brand-blue)" } : undefined}
      >
        <span className="truncate">{label}</span>
        <ChevronDownIcon
          width={13}
          height={13}
          className="shrink-0 text-[var(--faint)] transition-transform"
          style={{ transform: open ? "rotate(180deg)" : undefined }}
        />
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-20 w-[240px] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_10px_30px_rgba(22,50,79,.2)]">
          <div className="border-b border-[var(--divider)] p-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search cities…"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--panel-1)] px-2 py-1.5 text-[12px] font-semibold text-[var(--ink)] outline-none focus:border-[var(--brand-blue)]"
            />
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-2 text-[12px] font-semibold text-[var(--faint)]">
                No matching cities.
              </li>
            ) : (
              filteredOptions.map((city) => {
                const active = selected.has(city);
                return (
                  <li key={city}>
                    <button
                      type="button"
                      onClick={() => onToggle(city)}
                      aria-pressed={active}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] font-semibold hover:bg-[var(--panel-2)]"
                      style={{ color: active ? "var(--brand-blue)" : "var(--ink)" }}
                    >
                      <span
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded border"
                        style={
                          active
                            ? { background: "var(--brand-blue)", borderColor: "var(--brand-blue)" }
                            : { borderColor: "var(--border)" }
                        }
                      >
                        {active && <CheckIcon width={10} height={10} className="text-white" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{city}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          {selected.size > 0 && (
            <div className="border-t border-[var(--divider)] p-2">
              <button
                type="button"
                onClick={onClear}
                className="text-[12px] font-bold text-[var(--brand-blue)] hover:underline"
              >
                Clear cities
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** A ranked "might still work" candidate — deliberately simpler than
 * GroupCard (no expand-on-select detail view), since this is a secondary,
 * capped-at-6 list: name, when/where, an optional travel-time badge, and a
 * row of small chips showing exactly which active criteria it does and
 * doesn't meet, so a coordinator can see at a glance why it's suggested
 * despite not being a full match. */
function SuggestedGroupCard({
  group,
  metKeys,
  missedKeys,
  selected,
  travelTime,
  onSelect,
}: {
  group: Group;
  metKeys: string[];
  missedKeys: string[];
  selected: boolean;
  travelTime?: TravelTime;
  onSelect: () => void;
}) {
  const router = useRouter();
  const c = lifeColors(group.life);
  const dayLong = DAY_LONG[group.day] ?? group.day;

  return (
    <div
      data-card
      onClick={onSelect}
      className="cursor-pointer overflow-hidden rounded-2xl transition-shadow"
      style={{
        background: selected ? "var(--card-selected)" : "var(--panel-1)",
        boxShadow: selected ? "0 0 0 2px var(--brand-blue)" : "none",
      }}
    >
      <div className="flex">
        <div className="w-1.5 shrink-0 opacity-50" style={{ background: c.solid }} />
        <div className="min-w-0 flex-1 px-3.5 py-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="min-w-0 truncate font-[family-name:var(--font-fredoka)] text-[14px] font-semibold text-[var(--ink)]">
              {group.name}
            </h4>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/directory/groups/${group.id}`);
              }}
              aria-label="Edit group details"
              className="shrink-0 rounded-md p-1 text-[var(--faint)] transition-colors hover:bg-[var(--panel-4)] hover:text-[var(--brand-blue)]"
            >
              <EditIcon width={13} height={13} />
            </button>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 text-[11px] font-semibold text-[var(--muted)]">
            <span className="flex min-w-0 items-center gap-1.5 truncate">
              <ClockIcon width={12} height={12} className="shrink-0" />
              {dayLong}s · {group.time} · {group.area}
            </span>
            {travelTime && (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--panel-2)] px-2 py-[2px] text-[10.5px] font-bold text-[var(--brand-blue)]">
                <CarIcon width={11} height={11} />
                {travelTime.text}
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {metKeys.map((k) => (
              <span
                key={k}
                className="flex items-center gap-1 rounded-full bg-[oklch(0.95_0.06_150)] px-2 py-[2px] text-[10.5px] font-bold text-[oklch(0.44_0.13_150)]"
              >
                <CheckIcon width={9} height={9} /> {k}
              </span>
            ))}
            {missedKeys.map((k) => (
              <span
                key={k}
                className="flex items-center gap-1 rounded-full bg-[var(--divider)] px-2 py-[2px] text-[10.5px] font-bold text-[var(--faint)]"
              >
                <XIcon width={9} height={9} /> {k}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** A "matched on" criterion — click to exclude it from matching (and
 * click again to bring it back), so a coordinator can broaden or narrow
 * the search for other groups that might still work. */
function MatchChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="rounded-full px-2 py-[3px] text-[11px] font-bold transition-colors"
      style={
        active
          ? { background: "var(--surface)", color: "var(--muted)", boxShadow: "inset 0 0 0 1px var(--border-accent)" }
          : {
              background: "var(--divider)",
              color: "var(--faint)",
              boxShadow: "inset 0 0 0 1px var(--divider)",
            }
      }
    >
      {children}
    </button>
  );
}
