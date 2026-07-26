"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GROUP_STATUSES, type Group, type GroupStatus } from "@/lib/types";
import { backfillGroupLocations } from "@/app/actions";
import { PlusIcon } from "@/components/icons";
import { useDirectoryData } from "./DirectoryData";
import { DirectoryNav } from "./DirectoryNav";
import { ListFilterBar } from "./ListFilterBar";
import { EmptyState, GroupTable } from "./tables";

const blankGroup = (id: string): Group => ({
  id, name: "New Home Group", day: "Tue", time: "7:00 PM", area: "",
  host: "", coHost: "—", life: "Everyone", status: "New", format: "In-person",
  freq: "Weekly", capacity: 12, members: 0, childcare: false, topic: "",
  ageRange: "All ages", startDate: "", contactEmail: "", address: "", desc: "",
  placementDetails: "",
});

export function GroupsListPage() {
  const router = useRouter();
  const { groups, setGroups } = useDirectoryData();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<GroupStatus | "All">("All");
  const [lifeFilter, setLifeFilter] = useState("All");
  const [areaFilter, setAreaFilter] = useState("All");
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups.filter((g) => {
      if (statusFilter !== "All" && g.status !== statusFilter) return false;
      if (lifeFilter !== "All" && g.life !== lifeFilter) return false;
      if (areaFilter !== "All" && g.area !== areaFilter) return false;
      if (q && !`${g.name} ${g.area} ${g.host}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [groups, search, statusFilter, lifeFilter, areaFilter]);

  const handleNew = () => {
    const g = blankGroup(`new-${Date.now()}`);
    setGroups((gs) => [g, ...gs]);
    router.push(`/directory/groups/${g.id}`);
  };

  const hasFilters =
    search.trim() !== "" || statusFilter !== "All" || lifeFilter !== "All" || areaFilter !== "All";

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
        hasFilters={hasFilters}
        onClear={() => {
          setSearch("");
          setStatusFilter("All");
          setLifeFilter("All");
          setAreaFilter("All");
        }}
      />

      <div className="shrink-0 px-4 py-2 text-[12px] font-extrabold uppercase tracking-wide text-[var(--faint)]">
        {filtered.length} of {groups.length} groups
      </div>

      <div className="hw-scroll min-h-0 flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <EmptyState label="groups" hasFilters={hasFilters} />
        ) : (
          <GroupTable groups={filtered} onSelect={(id) => router.push(`/directory/groups/${id}`)} />
        )}
      </div>
    </div>
  );
}
