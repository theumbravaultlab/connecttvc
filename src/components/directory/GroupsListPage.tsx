"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DAYS, GROUP_STATUSES, type DayShort, type Group, type GroupStatus } from "@/lib/types";
import { backfillGroupLocations, bulkAssignGroups, bulkUpdateGroupStatus } from "@/app/actions";
import { PlusIcon } from "@/components/icons";
import { BulkActionBar } from "./BulkActionBar";
import { useDirectoryData } from "./DirectoryData";
import { DirectoryNav } from "./DirectoryNav";
import { ListFilterBar, type ExtraFilter } from "./ListFilterBar";
import { EmptyState, GroupTable, type GroupSortField, type SortDir } from "./tables";

const blankGroup = (id: string): Group => ({
  id, name: "New Home Group", day: "Tue", time: "7:00 PM", area: "",
  host: "", mentor: "—", life: "Everyone", status: "New", format: "In-person",
  freq: "Weekly", capacity: 12, members: 0, childcare: false, topic: "",
  ageRange: "All ages", startDate: "", contactEmail: "", address: "", desc: "",
  placementDetails: "", assignedTo: null,
});

function compareGroups(a: Group, b: Group, field: GroupSortField, profileNames: Map<string, string>): number {
  switch (field) {
    case "name":
      return a.name.localeCompare(b.name);
    case "day":
      return DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
    case "area":
      return a.area.localeCompare(b.area);
    case "life":
      return a.life.localeCompare(b.life);
    case "status":
      return GROUP_STATUSES.indexOf(a.status) - GROUP_STATUSES.indexOf(b.status);
    case "spots":
      return (a.capacity - a.members) - (b.capacity - b.members);
    case "assignedTo": {
      const an = a.assignedTo ? (profileNames.get(a.assignedTo) ?? "") : "";
      const bn = b.assignedTo ? (profileNames.get(b.assignedTo) ?? "") : "";
      return an.localeCompare(bn);
    }
    case "createdAt":
      // ISO 8601 strings sort lexicographically in chronological order;
      // a not-yet-saved record has no createdAt yet, sorts first.
      return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
    default:
      return 0;
  }
}

export function GroupsListPage() {
  const router = useRouter();
  const { groups, setGroups, profiles, viewerId } = useDirectoryData();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<GroupStatus | "All">("All");
  const [lifeFilter, setLifeFilter] = useState("All");
  const [areaFilter, setAreaFilter] = useState("All");
  const [dayFilter, setDayFilter] = useState<DayShort | "All">("All");
  const [assignedToFilter, setAssignedToFilter] = useState("All");
  const [sortField, setSortField] = useState<GroupSortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);

  const onSort = (field: GroupSortField) => {
    if (field === sortField) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const missingLocations = groups.filter(
    (g) => g.address.trim() && (g.lat == null || g.lng == null),
  ).length;

  // Placing new groups on the map used to require clicking a button — now
  // it just happens in the background the first time this list has any
  // groups with an address but no coordinates yet (e.g. bulk-inserted
  // sample data). Editing an address through the form already geocodes on
  // save; this only covers rows that never went through that path.
  const hasStartedBackfill = useRef(false);
  useEffect(() => {
    if (hasStartedBackfill.current || missingLocations === 0) return;
    hasStartedBackfill.current = true;
    let cancelled = false;
    setBackfillMsg(`Placing ${missingLocations} group${missingLocations === 1 ? "" : "s"} on the map…`);
    backfillGroupLocations().then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setBackfillMsg(result.error ?? "Couldn't place some groups on the map.");
        return;
      }
      if (result.updated.length > 0) {
        setGroups((gs) =>
          gs.map((g) => {
            const u = result.updated.find((r) => r.id === g.id);
            return u ? { ...g, lat: u.lat, lng: u.lng, area: u.area ?? g.area } : g;
          }),
        );
      }
      setBackfillMsg(
        result.updated.length > 0
          ? `Placed ${result.updated.length} group${result.updated.length === 1 ? "" : "s"} on the map.`
          : null,
      );
      setTimeout(() => setBackfillMsg(null), 4000);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missingLocations]);

  const areaOptions = useMemo(
    () => [...new Set(groups.map((g) => g.area).filter(Boolean))].sort(),
    [groups],
  );

  const profileNames = useMemo(() => new Map(profiles.map((p) => [p.id, p.fullName])), [profiles]);

  const extraFilters: ExtraFilter[] = useMemo(
    () => [
      {
        key: "day",
        label: "Meeting day",
        value: dayFilter,
        onChange: (v) => setDayFilter(v as DayShort | "All"),
        allLabel: "All days",
        options: DAYS.map((d) => ({ value: d, label: d })),
      },
      {
        key: "assignedTo",
        label: "Assigned to",
        value: assignedToFilter,
        onChange: setAssignedToFilter,
        allLabel: "All coordinators",
        options: [
          { value: "unassigned", label: "Unassigned" },
          ...profiles.map((p) => ({ value: p.id, label: p.fullName })),
        ],
      },
    ],
    [dayFilter, assignedToFilter, profiles],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = groups.filter((g) => {
      if (statusFilter !== "All" && g.status !== statusFilter) return false;
      if (lifeFilter !== "All" && g.life !== lifeFilter) return false;
      if (areaFilter !== "All" && g.area !== areaFilter) return false;
      if (dayFilter !== "All" && g.day !== dayFilter) return false;
      if (assignedToFilter !== "All") {
        if (assignedToFilter === "unassigned" ? g.assignedTo != null : g.assignedTo !== assignedToFilter) {
          return false;
        }
      }
      if (q && !`${g.name} ${g.area} ${g.host}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const sorted = [...rows].sort((a, b) => compareGroups(a, b, sortField, profileNames));
    return sortDir === "asc" ? sorted : sorted.reverse();
  }, [groups, search, statusFilter, lifeFilter, areaFilter, dayFilter, assignedToFilter, sortField, sortDir, profileNames]);

  const handleNew = () => {
    const g = blankGroup(`new-${Date.now()}`);
    setGroups((gs) => [g, ...gs]);
    router.push(`/directory/groups/${g.id}`);
  };

  const toggleOne = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelectedIds((prev) =>
      filtered.every((g) => prev.has(g.id)) ? new Set() : new Set(filtered.map((g) => g.id)),
    );

  const bulkSetStatus = async (status: GroupStatus) => {
    const ids = [...selectedIds];
    setBulkPending(true);
    const result = await bulkUpdateGroupStatus(ids, status);
    setBulkPending(false);
    if (!result.ok) return;
    setGroups((gs) => gs.map((g) => (selectedIds.has(g.id) ? { ...g, status } : g)));
  };

  const bulkAssign = async (assignedTo: string | null) => {
    const ids = [...selectedIds];
    setBulkPending(true);
    const result = await bulkAssignGroups(ids, assignedTo);
    setBulkPending(false);
    if (!result.ok) return;
    setGroups((gs) => gs.map((g) => (selectedIds.has(g.id) ? { ...g, assignedTo } : g)));
  };

  const hasFilters =
    search.trim() !== "" ||
    statusFilter !== "All" ||
    lifeFilter !== "All" ||
    areaFilter !== "All" ||
    dayFilter !== "All" ||
    assignedToFilter !== "All";

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--divider)] px-3 py-2.5 sm:px-[18px] sm:py-3">
        <DirectoryNav />
        <div className="flex items-center gap-2">
          <button
            onClick={handleNew}
            className="flex items-center gap-1.5 rounded-full border border-[var(--brand-blue-light)] px-3.5 py-1.5 text-[13px] font-bold text-[var(--brand-blue)] transition-colors hover:bg-[var(--panel-2)]"
          >
            <PlusIcon width={15} height={15} />
            New group
          </button>
        </div>
      </div>
      {backfillMsg && (
        <div className="shrink-0 border-b border-[var(--divider)] bg-[var(--panel-1)] px-4 py-1.5 text-[12px] font-bold text-[var(--muted)] sm:px-[18px]">
          {backfillMsg}
        </div>
      )}

      <ListFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search groups…"
        statusValue={statusFilter}
        onStatusChange={setStatusFilter}
        statusOptions={GROUP_STATUSES}
        lifeValue={lifeFilter}
        onLifeChange={setLifeFilter}
        areaValue={areaFilter}
        onAreaChange={setAreaFilter}
        areaOptions={areaOptions}
        extraFilters={extraFilters}
        hasFilters={hasFilters}
        onClear={() => {
          setSearch("");
          setStatusFilter("All");
          setLifeFilter("All");
          setAreaFilter("All");
          setDayFilter("All");
          setAssignedToFilter("All");
        }}
        assignedToMeActive={viewerId != null && assignedToFilter === viewerId}
        onToggleAssignedToMe={
          viewerId == null
            ? undefined
            : () => setAssignedToFilter((v) => (v === viewerId ? "All" : viewerId))
        }
      />

      {selectedIds.size > 0 && (
        <BulkActionBar
          count={selectedIds.size}
          statusOptions={GROUP_STATUSES}
          onSetStatus={bulkSetStatus}
          profiles={profiles}
          onAssign={bulkAssign}
          onClear={() => setSelectedIds(new Set())}
          pending={bulkPending}
        />
      )}

      <div className="shrink-0 px-4 py-2 text-[12px] font-extrabold uppercase tracking-wide text-[var(--faint)]">
        {filtered.length} of {groups.length} groups
      </div>

      <div className="hw-scroll min-h-0 flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <EmptyState label="groups" hasFilters={hasFilters} />
        ) : (
          <GroupTable
            groups={filtered}
            profileNames={profileNames}
            sortField={sortField}
            sortDir={sortDir}
            onSort={onSort}
            onSelect={(id) => router.push(`/directory/groups/${id}`)}
            selectedIds={selectedIds}
            onToggleOne={toggleOne}
            onToggleAll={toggleAll}
          />
        )}
      </div>
    </div>
  );
}
