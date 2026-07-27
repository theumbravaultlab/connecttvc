"use client";

import { Fragment } from "react";
import { useRouter } from "next/navigation";
import type { Group, Party, Person } from "@/lib/types";
import { initialsOf, partyDisplayName, partyMemberNames } from "@/lib/types";
import { Avatar, LifeTag, PartyTag, StatusPill } from "@/components/ui";
import { SearchIcon } from "@/components/icons";

export function EmptyState({ label, hasFilters }: { label: "groups" | "parties"; hasFilters: boolean }) {
  return (
    <div className="mt-10 px-4 text-center text-[13px] font-semibold text-[var(--faint)]">
      {hasFilters
        ? `No ${label} match your search/filters.`
        : `No ${label} yet — click "New ${label === "groups" ? "group" : "party"}" to add one.`}
    </div>
  );
}

const th = "px-4 py-2 text-left text-[11px] font-extrabold uppercase tracking-wide text-[var(--faint)]";
const td = "px-4 py-2.5 text-[13px] font-semibold text-[var(--ink)]";

export function GroupTable({
  groups,
  onSelect,
}: {
  groups: Group[];
  onSelect: (id: string) => void;
}) {
  return (
    <table className="w-full min-w-[640px] border-collapse">
      <thead className="sticky top-0 z-10 bg-[var(--surface)]">
        <tr className="border-b border-[var(--divider)]">
          <th className={th}>Name</th>
          <th className={th}>Meeting Day</th>
          <th className={th}>City</th>
          <th className={th}>Life Stage</th>
          <th className={th}>Status</th>
          <th className={th}>Spots Available</th>
        </tr>
      </thead>
      <tbody>
        {groups.map((g) => {
          const spots = Math.max(0, g.capacity - g.members);
          return (
            <tr
              key={g.id}
              onClick={() => onSelect(g.id)}
              className="cursor-pointer border-b border-[var(--panel-4)] transition-colors hover:bg-[var(--panel-1)]"
            >
              <td className={`${td} font-[family-name:var(--font-fredoka)] font-semibold`}>
                {g.name}
              </td>
              <td className={td}>{g.day}</td>
              <td className={td}>{g.area || "—"}</td>
              <td className={td}>
                <LifeTag life={g.life} />
              </td>
              <td className={td}>
                <StatusPill status={g.status} />
              </td>
              <td className={td}>
                {spots} of {g.capacity}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function PartyTable({
  parties,
  people,
  onSelect,
}: {
  parties: Party[];
  people: Person[];
  onSelect: (id: string) => void;
}) {
  const router = useRouter();

  return (
    <table className="w-full min-w-[600px] border-collapse">
      <thead className="sticky top-0 z-10 bg-[var(--surface)]">
        <tr className="border-b border-[var(--divider)]">
          <th className={th}>Name</th>
          <th className={th}>Home City</th>
          <th className={th}>Life Stage</th>
          <th className={th}>Status</th>
          <th className={th}></th>
        </tr>
      </thead>
      <tbody>
        {parties.map((pt) => {
          const members = people.filter((p) => p.partyId === pt.id);
          return (
            <Fragment key={pt.id}>
              <tr
                onClick={() => onSelect(pt.id)}
                className="cursor-pointer border-b border-[var(--panel-4)] transition-colors hover:bg-[var(--panel-1)]"
              >
                <td className={td}>
                  <span className="flex items-center gap-2">
                    <Avatar initials={initialsOf(partyDisplayName(pt, members))} size={24} tone="muted" />
                    <span className="flex flex-col">
                      <span className="flex items-center gap-1.5">
                        <span className="font-[family-name:var(--font-fredoka)] font-semibold">
                          {partyDisplayName(pt, members)}
                        </span>
                        <PartyTag partySize={members.length} />
                      </span>
                      {members.length > 1 && (
                        <span className="text-[11px] font-semibold text-[var(--faint)]">
                          {partyMemberNames(members)}
                        </span>
                      )}
                    </span>
                  </span>
                </td>
                <td className={td}>{pt.area || "—"}</td>
                <td className={td}>
                  <LifeTag life={pt.life} />
                </td>
                <td className={td}>
                  <StatusPill status={pt.status} />
                </td>
                <td className={`${td} text-right`}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/?party=${pt.id}`);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-blue-light)] px-2.5 py-1 text-[11.5px] font-bold text-[var(--brand-blue)] transition-colors hover:bg-[var(--panel-2)]"
                  >
                    <SearchIcon width={11} height={11} />
                    Find for
                  </button>
                </td>
              </tr>
              {members.length > 1 &&
                members.map((m) => (
                  <tr
                    key={m.id}
                    onClick={() => onSelect(pt.id)}
                    className="cursor-pointer border-b border-[var(--panel-4)] bg-[var(--panel-1)] transition-colors hover:bg-[var(--panel-2)]"
                  >
                    <td className={`${td} pl-11`}>
                      <span className="flex items-center gap-2">
                        <Avatar initials={initialsOf(m.name)} size={18} tone="muted" />
                        <span className="text-[12.5px] font-semibold">{m.name}</span>
                      </span>
                    </td>
                    <td colSpan={4} className={`${td} text-[12px] font-medium text-[var(--faint)]`}>
                      {[m.email, m.phone].filter(Boolean).join(" · ") || "No contact info on file"}
                    </td>
                  </tr>
                ))}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
