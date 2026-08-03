"use client";

import { useMemo } from "react";
import { DAY_LONG, partyDisplayName, partyMemberNames } from "@/lib/types";
import { formatExportedAt } from "@/lib/format";
import { useDirectoryData } from "./DirectoryData";
import { BackLink } from "./form-bits";

/** A clean, printable roster for one Home Group — every currently-
 * assigned party's name, members, and contact info. Deliberately a
 * separate route from the edit page rather than a print-only section
 * bolted onto GroupForm.tsx: that form has ~30 input fields that would all
 * need individual print:hidden treatment, versus one small self-contained
 * page here. Opens in a new tab from GroupForm's "Print roster" link so a
 * coordinator doesn't lose their place mid-edit. */
export function GroupRosterPage({ id }: { id: string }) {
  const { groups, parties, people } = useDirectoryData();
  const group = groups.find((g) => g.id === id);
  const roster = useMemo(
    () => parties.filter((p) => p.group === id),
    [parties, id],
  );
  const exportedAt = useMemo(() => formatExportedAt(new Date()), []);

  if (!group) {
    return (
      <div className="p-6">
        <BackLink fallbackHref="/directory/groups" />
        <p className="mt-4 text-[13px] font-semibold text-[var(--muted)]">
          Group not found.
        </p>
      </div>
    );
  }

  return (
    <div className="hw-scroll min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 print:h-auto print:overflow-visible print:flex-none">
      <div className="mx-auto flex w-full max-w-[680px] flex-col gap-4">
        <div className="print:hidden">
          <BackLink fallbackHref={`/directory/groups/${id}`} />
        </div>

        {/* Print-only header — invisible on screen, same idiom as
            ReportsPage's export header. */}
        <div className="hidden print:flex print:items-baseline print:justify-between print:border-b print:border-[var(--ink)] print:pb-3">
          <span className="font-[family-name:var(--font-fredoka)] text-[20px] font-semibold text-[var(--ink)]">
            Connect TVC — {group.name} Roster
          </span>
          <span className="text-[12px] font-semibold text-[var(--muted)]">Printed {exportedAt}</span>
        </div>

        <div className="flex items-start justify-between gap-3 print:hidden">
          <div>
            <h1 className="font-[family-name:var(--font-fredoka)] text-[21px] font-semibold text-[var(--ink)]">
              {group.name}
            </h1>
            <p className="text-[13px] font-semibold text-[var(--muted)]">
              {DAY_LONG[group.day] ?? group.day}s · {group.time} · Hosted by {group.host || "—"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="shrink-0 rounded-full bg-[var(--brand-blue)] px-4 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-[var(--brand-blue-dark)]"
          >
            Print
          </button>
        </div>

        {/* Same day/time/host line, shown on the print page too (the
            screen-only header above is print:hidden, so this is the only
            copy that actually prints). */}
        <p className="hidden text-[13px] font-semibold text-[var(--muted)] print:block">
          {DAY_LONG[group.day] ?? group.day}s · {group.time} · Hosted by {group.host || "—"}
        </p>

        {roster.length === 0 ? (
          <p className="text-[13px] font-semibold text-[var(--faint)]">
            No one is currently assigned to this group.
          </p>
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-[var(--divider-2)] text-left text-[11px] font-extrabold uppercase tracking-wide text-[var(--faint)]">
                <th className="py-2 pr-3">Party</th>
                <th className="py-2 pr-3">Members</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2">Phone</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((pt) => {
                const members = people.filter((p) => p.partyId === pt.id);
                return (
                  <tr key={pt.id} className="border-b border-[var(--divider)] align-top">
                    <td className="py-2.5 pr-3 font-bold text-[var(--ink)]">
                      {partyDisplayName(pt, members)}
                    </td>
                    <td className="py-2.5 pr-3 text-[var(--muted)]">
                      {members.length > 1 ? partyMemberNames(members) : "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-[var(--muted)]">
                      {members.map((m) => m.email).filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="py-2.5 text-[var(--muted)]">
                      {members.map((m) => m.phone).filter(Boolean).join(", ") || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
