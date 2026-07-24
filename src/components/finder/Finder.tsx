"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  DAY_LONG,
  LIFE_STAGES,
  initialsOf,
  type DayShort,
  type Group,
  type Person,
} from "@/lib/types";
import { Avatar, StatusPill } from "@/components/ui";
import { SearchIcon, XIcon } from "@/components/icons";
import { getTravelTimesToGroups } from "@/app/actions";
import type { TravelTime } from "@/lib/routes";
import { FinderMap } from "./FinderMap";
import { GroupCard } from "./GroupCard";
import { PersonSearch } from "./PersonSearch";

const DAY_FILTERS: (DayShort | "All")[] = ["All", "Mon", "Tue", "Wed", "Thu", "Sun"];

export function Finder({
  groups,
  people,
}: {
  groups: Group[];
  /** Leader-only: enables the "Finding for" matcher. Empty for public. */
  people: Person[];
}) {
  const [q, setQ] = useState("");
  const [day, setDay] = useState<DayShort | "All">("All");
  const [area, setArea] = useState("All");
  const [life, setLife] = useState("All");
  const [personId, setPersonId] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "map">("list");
  const [travelTimes, setTravelTimes] = useState<Record<string, TravelTime>>({});
  const findingForId = useId();
  const areaId = useId();
  const lifeId = useId();

  const person = people.find((p) => p.id === personId) ?? null;

  // Area is auto-derived from each address's city (no fixed list anymore),
  // so the filter's options come from whatever areas actually show up.
  const areaOptions = useMemo(
    () => [...new Set(groups.map((g) => g.area).filter(Boolean))].sort(),
    [groups],
  );

  // Derived filtered list.
  const filtered = useMemo(() => {
    if (person) {
      return groups.filter(
        (g) => person.days.includes(g.day) && g.area === person.area,
      );
    }
    return groups.filter((g) => {
      if (day !== "All" && g.day !== day) return false;
      if (area !== "All" && g.area !== area) return false;
      if (life !== "All" && g.life !== life) return false;
      if (q.trim()) {
        const hay = `${g.name} ${g.area} ${g.host}`.toLowerCase();
        if (!hay.includes(q.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [groups, person, day, area, life, q]);

  // Auto-select the first match when the person or filter set changes.
  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!filtered.some((g) => g.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]);

  // Drive time from the selected person to every visible group, batched
  // into one Routes API call. Depends on primitive lat/lng/id rather than
  // the `person` object itself so editing an unrelated field elsewhere
  // (e.g. in the Console, since state is shared) doesn't trigger a refetch.
  useEffect(() => {
    if (!person || person.lat == null || person.lng == null) {
      setTravelTimes({});
      return;
    }
    const destinations = filtered
      .filter((g): g is typeof g & { lat: number; lng: number } =>
        g.lat != null && g.lng != null,
      )
      .map((g) => ({ id: g.id, lat: g.lat, lng: g.lng }));
    if (destinations.length === 0) {
      setTravelTimes({});
      return;
    }
    let cancelled = false;
    getTravelTimesToGroups({ lat: person.lat, lng: person.lng }, destinations).then(
      (result) => {
        if (!cancelled) setTravelTimes(result);
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person?.id, person?.lat, person?.lng, filtered]);

  // Scroll the selected card into view within the list container.
  const listRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    if (!selectedId) return;
    const container = listRef.current;
    const card = cardRefs.current[selectedId];
    if (container && card) {
      container.scrollTo({ top: card.offsetTop - 14, behavior: "smooth" });
    }
  }, [selectedId]);

  const clearPerson = () => {
    setPersonId("");
    setSelectedId(null);
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col md:flex-row">
        {/* mobile-only List / Map switch */}
        <div className="flex shrink-0 gap-1 border-b border-[#eef3f8] px-3 py-2 md:hidden">
          {(["list", "map"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setMobileView(v)}
              className="flex-1 rounded-full px-4 py-1.5 text-[12.5px] font-bold capitalize transition-colors"
              style={
                mobileView === v
                  ? { background: "#088df9", color: "#fff" }
                  : { background: "#f2f6fb", color: "#5b7a97" }
              }
            >
              {v}
            </button>
          ))}
        </div>

        {/* list column */}
        <div
          className={`${mobileView === "list" ? "flex" : "hidden"} min-h-0 w-full flex-1 flex-col md:flex md:w-[380px] md:flex-none md:border-r md:border-[#eef3f8]`}
        >
          {/* filter area */}
          <div className="shrink-0 border-b border-[#eef3f8] px-[15px] py-3.5">
            {people.length > 0 && (
              <div className="mb-3">
                <label
                  htmlFor={findingForId}
                  className="mb-1 block text-[11.5px] font-extrabold uppercase tracking-wide text-[#8aa0b4]"
                >
                  Finding for
                </label>
                <PersonSearch
                  id={findingForId}
                  people={people}
                  selected={person}
                  onSelect={(id) => {
                    setPersonId(id);
                    setSelectedId(null);
                  }}
                  onClear={clearPerson}
                />
              </div>
            )}

            {person ? (
              <div className="rounded-xl border border-[#cfe3fb] bg-[#f2f8ff] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <Avatar initials={initialsOf(person.name)} size={34} />
                    <div>
                      <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#16324f]">
                        {person.name}
                        <StatusPill status={person.status} />
                      </div>
                      <div className="text-[11.5px] font-semibold text-[#5b7a97]">
                        {person.notes.split(",")[0]} · lives in {person.area}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={clearPerson}
                    className="flex items-center gap-1 rounded-full px-2 py-1 text-[11.5px] font-bold text-[#088df9] hover:bg-white"
                  >
                    <XIcon width={12} height={12} /> Clear
                  </button>
                </div>
                <div className="mt-2.5 text-[11px] font-extrabold uppercase tracking-wide text-[#8aa0b4]">
                  Matched on
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {person.days.map((d) => (
                    <MatchChip key={d}>{DAY_LONG[d]}</MatchChip>
                  ))}
                  <MatchChip>{person.area}</MatchChip>
                  <MatchChip>{person.life}</MatchChip>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <div className="relative">
                  <SearchIcon
                    width={15}
                    height={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8aa0b4]"
                  />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search groups or areas…"
                    aria-label="Search groups or areas"
                    className="w-full rounded-[9px] border border-[#dbe7f3] bg-[#f7fafd] py-2 pl-9 pr-3 text-[12.5px] font-semibold text-[#16324f] outline-none focus:border-[#088df9]"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {DAY_FILTERS.map((d) => {
                    const active = day === d;
                    return (
                      <button
                        key={d}
                        onClick={() => setDay(d)}
                        className="rounded-full border px-2.5 py-1 text-[11.5px] font-bold transition-all duration-100"
                        style={
                          active
                            ? { background: "#088df9", color: "#fff", borderColor: "#088df9" }
                            : { background: "#fff", color: "#5b7a97", borderColor: "#dbe7f3" }
                        }
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <label htmlFor={areaId} className="sr-only">
                    Filter by area
                  </label>
                  <select
                    id={areaId}
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    className="w-1/2 rounded-[9px] border border-[#dbe7f3] bg-[#f7fafd] px-2.5 py-2 text-[12px] font-semibold text-[#16324f] outline-none focus:border-[#088df9]"
                  >
                    <option value="All">All areas</option>
                    {areaOptions.map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                  <label htmlFor={lifeId} className="sr-only">
                    Filter by life stage
                  </label>
                  <select
                    id={lifeId}
                    value={life}
                    onChange={(e) => setLife(e.target.value)}
                    className="w-1/2 rounded-[9px] border border-[#dbe7f3] bg-[#f7fafd] px-2.5 py-2 text-[12px] font-semibold text-[#16324f] outline-none focus:border-[#088df9]"
                  >
                    <option value="All">All stages</option>
                    {LIFE_STAGES.map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* list scroll */}
          <div ref={listRef} className="hw-scroll min-h-0 flex-1 overflow-y-auto p-3.5">
            {filtered.length === 0 ? (
              <div className="mt-10 px-4 text-center text-[13px] font-semibold text-[#8aa0b4]">
                No groups match yet — try clearing a filter.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filtered.map((g, i) => (
                  <GroupCard
                    key={g.id}
                    ref={(el) => {
                      cardRefs.current[g.id] = el;
                    }}
                    group={g}
                    index={i}
                    selected={g.id === selectedId}
                    greatFit={!!person && g.life === person.life}
                    matchName={person?.name.split(" ")[0]}
                    travelTime={travelTimes[g.id]}
                    onSelect={() => setSelectedId(g.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* map column */}
        <div
          className={`${mobileView === "map" ? "block" : "hidden"} relative min-h-0 flex-1 md:block`}
        >
          <FinderMap
            groups={filtered}
            person={person}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
      </div>
  );
}

function MatchChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-white px-2 py-[3px] text-[10.5px] font-bold text-[#5b7a97] ring-1 ring-[#cfe3fb]">
      {children}
    </span>
  );
}
