"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PARTY_STATUSES, partyDisplayName, type Party, type PartyStatus, type Person } from "@/lib/types";
import { backfillPartyLocations, bulkAssignParties, bulkUpdatePartyStatus } from "@/app/actions";
import { PlusIcon, UploadIcon } from "@/components/icons";
import { BulkActionBar } from "./BulkActionBar";
import { useDirectoryData } from "./DirectoryData";
import { DirectoryNav } from "./DirectoryNav";
import { ListFilterBar, type ExtraFilter } from "./ListFilterBar";
import { EmptyState, PartyTable, type PartySortField, type SortDir } from "./tables";

const blankParty = (id: string): Party => ({
  id, partyName: "", area: "", address: "",
  age: null, days: [], timePref: "Flexible", life: "Everyone", interests: "",
  childcareNeeded: false, accessibility: "—", status: "New", group: null,
  joined: "", notes: "", assignedTo: null,
});

const blankMember = (partyId: string): Person => ({
  id: `new-${Date.now()}`, partyId, name: "New member", email: "", phone: "",
});

function compareParties(
  a: Party,
  b: Party,
  field: PartySortField,
  membersByParty: Map<string, Person[]>,
  profileNames: Map<string, string>,
): number {
  switch (field) {
    case "name":
      return partyDisplayName(a, membersByParty.get(a.id) ?? []).localeCompare(
        partyDisplayName(b, membersByParty.get(b.id) ?? []),
      );
    case "area":
      return a.area.localeCompare(b.area);
    case "life":
      return a.life.localeCompare(b.life);
    case "status":
      return PARTY_STATUSES.indexOf(a.status) - PARTY_STATUSES.indexOf(b.status);
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

export function PartiesListPage() {
  const router = useRouter();
  const { parties, setParties, people, setPeople, profiles, viewerId } = useDirectoryData();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PartyStatus | "All">("All");
  const [lifeFilter, setLifeFilter] = useState("All");
  const [areaFilter, setAreaFilter] = useState("All");
  const [assignedToFilter, setAssignedToFilter] = useState("All");
  const [sortField, setSortField] = useState<PartySortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);

  const onSort = (field: PartySortField) => {
    if (field === sortField) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const missingLocations = parties.filter(
    (p) => p.address.trim() && (p.lat == null || p.lng == null),
  ).length;

  // Placing new parties on the map used to require clicking a button — now
  // it just happens in the background the first time this list has any
  // parties with an address but no coordinates yet (e.g. bulk-inserted
  // sample data). Editing an address through the form already geocodes on
  // save; this only covers rows that never went through that path.
  const hasStartedBackfill = useRef(false);
  useEffect(() => {
    if (hasStartedBackfill.current || missingLocations === 0) return;
    hasStartedBackfill.current = true;
    let cancelled = false;
    setBackfillMsg(`Placing ${missingLocations} ${missingLocations === 1 ? "party" : "parties"} on the map…`);
    backfillPartyLocations().then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setBackfillMsg(result.error ?? "Couldn't place some parties on the map.");
        return;
      }
      if (result.updated.length > 0) {
        setParties((ps) =>
          ps.map((p) => {
            const u = result.updated.find((r) => r.id === p.id);
            return u ? { ...p, lat: u.lat, lng: u.lng, area: u.area ?? p.area } : p;
          }),
        );
      }
      setBackfillMsg(
        result.updated.length > 0
          ? `Placed ${result.updated.length} ${result.updated.length === 1 ? "party" : "parties"} on the map.`
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
    () => [...new Set(parties.map((p) => p.area).filter(Boolean))].sort(),
    [parties],
  );

  const membersByParty = useMemo(() => {
    const map = new Map<string, Person[]>();
    for (const person of people) {
      const list = map.get(person.partyId) ?? [];
      list.push(person);
      map.set(person.partyId, list);
    }
    return map;
  }, [people]);

  const profileNames = useMemo(() => new Map(profiles.map((p) => [p.id, p.fullName])), [profiles]);

  const extraFilters: ExtraFilter[] = useMemo(
    () => [
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
    [assignedToFilter, profiles],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = parties.filter((p) => {
      if (statusFilter !== "All" && p.status !== statusFilter) return false;
      if (lifeFilter !== "All" && p.life !== lifeFilter) return false;
      if (areaFilter !== "All" && p.area !== areaFilter) return false;
      if (assignedToFilter !== "All") {
        if (assignedToFilter === "unassigned" ? p.assignedTo != null : p.assignedTo !== assignedToFilter) {
          return false;
        }
      }
      if (q) {
        const members = membersByParty.get(p.id) ?? [];
        const hay = `${partyDisplayName(p, members)} ${members.map((m) => m.name).join(" ")} ${p.area}`;
        if (!hay.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    const sorted = [...rows].sort((a, b) => compareParties(a, b, sortField, membersByParty, profileNames));
    return sortDir === "asc" ? sorted : sorted.reverse();
  }, [
    parties,
    membersByParty,
    search,
    statusFilter,
    lifeFilter,
    areaFilter,
    assignedToFilter,
    sortField,
    sortDir,
    profileNames,
  ]);

  const handleNew = () => {
    const party = blankParty(`new-${Date.now()}`);
    const member = blankMember(party.id);
    setParties((ps) => [party, ...ps]);
    setPeople((ps) => [...ps, member]);
    router.push(`/directory/parties/${party.id}`);
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
      filtered.every((p) => prev.has(p.id)) ? new Set() : new Set(filtered.map((p) => p.id)),
    );

  const bulkSetStatus = async (status: PartyStatus) => {
    const ids = [...selectedIds];
    setBulkPending(true);
    const result = await bulkUpdatePartyStatus(ids, status);
    setBulkPending(false);
    if (!result.ok) return;
    setParties((ps) => ps.map((p) => (selectedIds.has(p.id) ? { ...p, status } : p)));
  };

  const bulkAssign = async (assignedTo: string | null) => {
    const ids = [...selectedIds];
    setBulkPending(true);
    const result = await bulkAssignParties(ids, assignedTo);
    setBulkPending(false);
    if (!result.ok) return;
    setParties((ps) => ps.map((p) => (selectedIds.has(p.id) ? { ...p, assignedTo } : p)));
  };

  const hasFilters =
    search.trim() !== "" ||
    statusFilter !== "All" ||
    lifeFilter !== "All" ||
    areaFilter !== "All" ||
    assignedToFilter !== "All";

  const filteredPeopleCount = useMemo(
    () => filtered.reduce((sum, p) => sum + (membersByParty.get(p.id)?.length ?? 0), 0),
    [filtered, membersByParty],
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--divider)] px-3 py-2.5 sm:px-[18px] sm:py-3">
        <DirectoryNav />
        <div className="flex items-center gap-2">
          <Link
            href="/directory/parties/import"
            className="flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3.5 py-1.5 text-[13px] font-bold text-[var(--muted)] transition-colors hover:bg-[var(--panel-1)]"
          >
            <UploadIcon width={15} height={15} />
            Import CSV
          </Link>
          <button
            onClick={handleNew}
            className="flex items-center gap-1.5 rounded-full border border-[var(--brand-blue-light)] px-3.5 py-1.5 text-[13px] font-bold text-[var(--brand-blue)] transition-colors hover:bg-[var(--panel-2)]"
          >
            <PlusIcon width={15} height={15} />
            New party
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
        searchPlaceholder="Search parties or people…"
        statusValue={statusFilter}
        onStatusChange={setStatusFilter}
        statusOptions={PARTY_STATUSES}
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
          statusOptions={PARTY_STATUSES}
          onSetStatus={bulkSetStatus}
          profiles={profiles}
          onAssign={bulkAssign}
          onClear={() => setSelectedIds(new Set())}
          pending={bulkPending}
        />
      )}

      <div className="shrink-0 px-4 py-2 text-[12px] font-extrabold uppercase tracking-wide text-[var(--faint)]">
        {filtered.length} of {parties.length} parties · {filteredPeopleCount} people
      </div>

      <div className="hw-scroll min-h-0 flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <EmptyState label="parties" hasFilters={hasFilters} />
        ) : (
          <PartyTable
            parties={filtered}
            people={people}
            profileNames={profileNames}
            sortField={sortField}
            sortDir={sortDir}
            onSort={onSort}
            onSelect={(id) => router.push(`/directory/parties/${id}`)}
            selectedIds={selectedIds}
            onToggleOne={toggleOne}
            onToggleAll={toggleAll}
          />
        )}
      </div>
    </div>
  );
}
