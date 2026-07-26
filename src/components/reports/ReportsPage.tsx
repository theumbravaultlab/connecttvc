"use client";

import { useMemo } from "react";
import {
  GROUP_STATUSES,
  LIFE_STAGES,
  PERSON_STATUSES,
  type Group,
  type Person,
} from "@/lib/types";
import { statusSolid } from "@/lib/colors";
import { HBar, PairedBarChart, ReportCard, SegmentedBar, StatCard } from "./charts";

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

export function ReportsPage({ groups, people }: { groups: Group[]; people: Person[] }) {
  const stats = useMemo(() => computeStats(groups, people), [groups, people]);
  const exportedAt = useMemo(
    () =>
      new Date().toLocaleString(undefined, {
        dateStyle: "long",
        timeStyle: "short",
      }),
    [],
  );

  return (
    <div className="hw-scroll min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 print:h-auto print:overflow-visible print:flex-none">
      <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-5">
        {/* Print/PDF-only header — invisible on screen, shown only in the
            exported output so it's clear what this is and when it was
            pulled. The date/time is computed at render time, not at the
            moment of clicking Export, so a re-export from a stale tab still
            shows an accurate timestamp. */}
        <div className="hidden print:flex print:items-baseline print:justify-between print:border-b print:border-[var(--ink)] print:pb-3">
          <span className="font-[family-name:var(--font-fredoka)] text-[20px] font-semibold text-[var(--ink)]">
            Connect TVC — Reports
          </span>
          <span className="text-[12px] font-semibold text-[var(--muted)]">Exported {exportedAt}</span>
        </div>

        <div className="flex items-center justify-between print:hidden">
          <span className="text-[12px] font-bold text-[var(--faint)]">
            Data as of this page load
          </span>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-full bg-[var(--brand-blue)] px-4 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-[var(--brand-blue-dark)]"
          >
            Export PDF
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Total home groups" value={String(stats.totalGroups)} />
          <StatCard label="Total people" value={String(stats.totalPeople)} />
          <StatCard
            label="Groups open"
            value={`${stats.pctOpen}%`}
            sublabel={`${stats.groupsByStatus.Open} of ${stats.totalGroups}`}
            accent="oklch(0.5 0.14 150)"
          />
          <StatCard
            label="People placed"
            value={`${stats.pctPlaced}%`}
            sublabel={`${stats.peopleByStatus.Grouped} of ${stats.totalPeople}`}
            accent="oklch(0.5 0.14 150)"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <ReportCard title="Home group status">
            <SegmentedBar
              segments={GROUP_STATUSES.map((s) => ({
                label: s,
                value: stats.groupsByStatus[s],
                color: statusSolid(s),
              }))}
            />
          </ReportCard>

          <ReportCard title="Capacity utilization" action={<span className="text-[12px] font-bold text-[var(--faint)]">Open + New groups</span>}>
            <div className="flex items-baseline gap-2">
              <span className="font-[family-name:var(--font-fredoka)] text-[26px] font-semibold text-[var(--ink)]">
                {stats.utilizationPct}%
              </span>
              <span className="text-[13px] font-semibold text-[var(--muted)]">
                {stats.totalMembers} of {stats.totalCapacity} spots filled
              </span>
            </div>
            <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-[var(--divider-2)]">
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{
                  width: `${Math.min(100, stats.utilizationPct)}%`,
                  background:
                    stats.utilizationPct >= 100
                      ? "oklch(0.62 0.15 20)"
                      : stats.utilizationPct >= 80
                        ? "oklch(0.7 0.14 70)"
                        : "var(--brand-blue)",
                }}
              />
            </div>
            <div className="mt-2 text-[12px] font-semibold text-[var(--faint)]">
              {stats.spotsAvailable} spots still available across active groups
            </div>
          </ReportCard>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <ReportCard title="People placement funnel">
            <div className="flex flex-col gap-3">
              {PERSON_STATUSES.map((s) => (
                <HBar
                  key={s}
                  label={s}
                  value={stats.peopleByStatus[s]}
                  total={stats.totalPeople}
                  color={statusSolid(s)}
                />
              ))}
            </div>
          </ReportCard>

          <ReportCard title="Childcare: supply vs. demand">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[var(--panel-2)] p-3.5">
                <div className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--faint)]">
                  Groups offering
                </div>
                <div className="mt-1 font-[family-name:var(--font-fredoka)] text-[22px] font-semibold text-[var(--ink)]">
                  {stats.pctGroupsChildcare}%
                </div>
                <div className="mt-0.5 text-[12px] font-semibold text-[var(--muted)]">
                  {stats.groupsWithChildcare} of {stats.totalGroups} groups
                </div>
              </div>
              <div className="rounded-xl bg-[var(--panel-2)] p-3.5">
                <div className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--faint)]">
                  People needing
                </div>
                <div className="mt-1 font-[family-name:var(--font-fredoka)] text-[22px] font-semibold text-[var(--ink)]">
                  {stats.pctPeopleChildcare}%
                </div>
                <div className="mt-0.5 text-[12px] font-semibold text-[var(--muted)]">
                  {stats.peopleNeedingChildcare} of {stats.totalPeople} people
                </div>
              </div>
            </div>
          </ReportCard>
        </div>

        <ReportCard title="Supply vs. demand by life stage">
          <PairedBarChart
            rows={stats.byLifeStage}
            legendA="Groups"
            legendB="People"
            colorA="var(--brand-blue)"
            colorB="oklch(0.7 0.14 300)"
          />
        </ReportCard>

        <ReportCard title="Top cities by groups & people">
          <PairedBarChart
            rows={stats.byCity}
            legendA="Groups"
            legendB="People"
            colorA="var(--brand-blue)"
            colorB="oklch(0.7 0.14 300)"
          />
        </ReportCard>

        <ReportCard title="Needs attention">
          <div className="flex flex-col gap-2.5">
            <AttentionRow
              tone={stats.groupsByStatus.Closed > 0 ? "danger" : "ok"}
              label="Closed groups"
              value={stats.groupsByStatus.Closed}
            />
            <AttentionRow
              tone={stats.groupsByStatus.New > 0 ? "warn" : "ok"}
              label="New groups awaiting activation"
              value={stats.groupsByStatus.New}
            />
            <AttentionRow
              tone={stats.peopleByStatus.Waitlisted > 0 ? "warn" : "ok"}
              label="People waitlisted"
              value={stats.peopleByStatus.Waitlisted}
            />
          </div>

          {stats.underservedCities.length > 0 && (
            <div className="mt-4 border-t border-[var(--divider-2)] pt-3.5">
              <div className="mb-2 text-[12px] font-extrabold uppercase tracking-wide text-[var(--faint)]">
                Cities with people but no open group
              </div>
              <div className="flex flex-col gap-1.5">
                {stats.underservedCities.map((c) => (
                  <div
                    key={c.city}
                    className="flex items-center justify-between rounded-lg bg-[var(--panel-2)] px-3 py-2 text-[13px] font-semibold text-[var(--body-detail)]"
                  >
                    <span className="font-bold text-[var(--ink)]">{c.city}</span>
                    <span>
                      {c.people} {c.people === 1 ? "person" : "people"} waiting
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ReportCard>
      </div>
    </div>
  );
}

function AttentionRow({
  tone,
  label,
  value,
}: {
  tone: "danger" | "warn" | "ok";
  label: string;
  value: number;
}) {
  const color =
    tone === "danger"
      ? "oklch(0.55 0.18 20)"
      : tone === "warn"
        ? "oklch(0.6 0.14 70)"
        : "oklch(0.5 0.14 150)";
  return (
    <div className="flex items-center gap-2.5">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
      <span className="flex-1 text-[13px] font-semibold text-[var(--body-detail)]">{label}</span>
      <span className="text-[14px] font-extrabold" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

function computeStats(groups: Group[], people: Person[]) {
  const totalGroups = groups.length;
  const totalPeople = people.length;

  const groupsByStatus = Object.fromEntries(
    GROUP_STATUSES.map((s) => [s, groups.filter((g) => g.status === s).length]),
  ) as Record<(typeof GROUP_STATUSES)[number], number>;

  const peopleByStatus = Object.fromEntries(
    PERSON_STATUSES.map((s) => [s, people.filter((p) => p.status === s).length]),
  ) as Record<(typeof PERSON_STATUSES)[number], number>;

  const activeGroups = groups.filter((g) => g.status !== "Closed");
  const totalCapacity = activeGroups.reduce((s, g) => s + g.capacity, 0);
  const totalMembers = activeGroups.reduce((s, g) => s + g.members, 0);

  const groupsWithChildcare = groups.filter((g) => g.childcare).length;
  const peopleNeedingChildcare = people.filter((p) => p.childcareNeeded).length;

  const byLifeStage = LIFE_STAGES.map((life) => ({
    label: life,
    a: groups.filter((g) => g.life === life).length,
    b: people.filter((p) => p.life === life).length,
  }));

  const cities = [...new Set([...groups.map((g) => g.area), ...people.map((p) => p.area)])].filter(
    Boolean,
  );
  const byCityAll = cities.map((city) => ({
    label: city,
    a: groups.filter((g) => g.area === city).length,
    b: people.filter((p) => p.area === city).length,
  }));
  const byCity = [...byCityAll].sort((x, y) => y.a + y.b - (x.a + x.b)).slice(0, 8);

  const openCities = new Set(groups.filter((g) => g.status === "Open").map((g) => g.area));
  const underservedCities = byCityAll
    .filter((c) => c.b > 0 && !openCities.has(c.label))
    .map((c) => ({ city: c.label, people: c.b }))
    .sort((x, y) => y.people - x.people)
    .slice(0, 5);

  return {
    totalGroups,
    totalPeople,
    groupsByStatus,
    peopleByStatus,
    pctOpen: pct(groupsByStatus.Open, totalGroups),
    pctPlaced: pct(peopleByStatus.Grouped, totalPeople),
    totalCapacity,
    totalMembers,
    utilizationPct: pct(totalMembers, totalCapacity),
    spotsAvailable: Math.max(0, totalCapacity - totalMembers),
    groupsWithChildcare,
    peopleNeedingChildcare,
    pctGroupsChildcare: pct(groupsWithChildcare, totalGroups),
    pctPeopleChildcare: pct(peopleNeedingChildcare, totalPeople),
    byLifeStage,
    byCity,
    underservedCities,
  };
}
