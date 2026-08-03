"use client";

import { forwardRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Group } from "@/lib/types";
import { DAY_LONG } from "@/lib/types";
import type { TravelTime } from "@/lib/routes";
import { lifeColors } from "@/lib/colors";
import { LifeTag, SpotsPill } from "@/components/ui";
import {
  CarIcon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  EditIcon,
  LockIcon,
  MailIcon,
  PinIcon,
  StarIcon,
} from "@/components/icons";

function CopyEmailRow({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex items-center gap-2 rounded-xl bg-[var(--panel-1)] px-3 py-2.5 text-[13px] font-semibold text-[var(--body-detail)]">
      <MailIcon width={15} height={15} className="shrink-0 text-[var(--faint)]" />
      <span className="min-w-0 flex-1 truncate">{email}</span>
      <button
        type="button"
        onClick={async (e) => {
          e.stopPropagation();
          await navigator.clipboard.writeText(email);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        aria-label="Copy email address"
        className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[var(--faint)] transition-colors hover:bg-[var(--panel-3)] hover:text-[var(--brand-blue)]"
      >
        {copied ? (
          <CheckIcon width={14} height={14} className="text-[oklch(0.55_0.15_150)]" />
        ) : (
          <CopyIcon width={14} height={14} />
        )}
      </button>
    </div>
  );
}

function InfoRow({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span
        className="mt-[5px] h-2 w-2 shrink-0 rounded-full"
        style={{ background: color }}
      />
      <span className="text-[13px] text-[var(--body-detail)]">
        <span className="font-bold text-[var(--ink)]">{label}</span> · {value}
      </span>
    </div>
  );
}

export const GroupCard = forwardRef<
  HTMLDivElement,
  {
    group: Group;
    index: number;
    selected: boolean;
    greatFit: boolean;
    matchName?: string;
    travelTime?: TravelTime;
    onSelect: () => void;
  }
>(function GroupCard(
  { group, selected, greatFit, matchName, travelTime, onSelect },
  ref,
) {
  const router = useRouter();
  const c = lifeColors(group.life);
  const dayLong = DAY_LONG[group.day] ?? group.day;
  // Falls back to the old derived guess for any group saved before this
  // field existed, so older records don't just show a blank line.
  const placementDetails =
    group.placementDetails ||
    (group.childcare ? "Childcare available on site" : group.topic || "All are welcome");

  return (
    <div
      ref={ref}
      data-card
      onClick={onSelect}
      className="cursor-pointer overflow-hidden rounded-2xl transition-shadow"
      style={{
        background: selected ? "var(--card-selected)" : "var(--surface)",
        boxShadow: selected
          ? "0 0 0 2px var(--brand-blue), 0 8px 20px rgba(8,141,249,.16)"
          : "0 1px 2px rgba(22,50,79,.05)",
      }}
    >
      {greatFit && matchName && (
        <div className="flex items-center gap-1.5 bg-[oklch(0.95_0.06_150)] px-4 py-1.5 text-[11px] font-extrabold text-[oklch(0.44_0.13_150)]">
          <StarIcon width={12} height={12} />
          Great match for {matchName}
        </div>
      )}
      <div className="flex">
        <div className="w-1.5 shrink-0" style={{ background: c.solid }} />
        <div className="flex-1 px-4 py-3.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="min-w-0 truncate font-[family-name:var(--font-fredoka)] text-[16px] font-semibold text-[var(--ink)]">
              {group.name}
            </h3>
            <div className="flex shrink-0 items-center gap-1.5">
              <SpotsPill members={group.members} capacity={group.capacity} status={group.status} />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/directory/groups/${group.id}`);
                }}
                aria-label="Edit group details"
                className="rounded-md p-1 text-[var(--faint)] transition-colors hover:bg-[var(--panel-4)] hover:text-[var(--brand-blue)]"
              >
                <EditIcon width={14} height={14} />
              </button>
            </div>
          </div>

          <div className="mt-1.5 flex items-center justify-between gap-2 text-[13px] font-semibold text-[var(--muted)]">
            <span className="flex items-center gap-1.5">
              <ClockIcon width={14} height={14} />
              {dayLong}s · {group.time}
            </span>
            {travelTime && (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--panel-2)] px-2 py-[3px] text-[11px] font-bold text-[var(--brand-blue)]">
                <CarIcon width={12} height={12} />
                {travelTime.text}
              </span>
            )}
          </div>

          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--muted)]">
              <PinIcon width={14} height={14} />
              {group.area}
            </span>
            <LifeTag life={group.life} />
          </div>

          <div className="mt-1 text-[12px] font-semibold text-[var(--faint)]">
            Hosted by {group.host}
          </div>

          {selected && (
            <div className="mt-3 flex flex-col gap-2.5 border-t border-[var(--divider-2)] pt-3">
              <p className="text-[13px] leading-[1.55] text-[var(--body-detail)]">
                {group.desc}
              </p>
              <div className="flex flex-col gap-1.5">
                <InfoRow
                  color={c.solid}
                  label="Group size"
                  value={`Up to ${group.capacity}`}
                />
                <InfoRow
                  color={c.solid}
                  label="Format"
                  value={`${group.format} · ${group.freq}`}
                />
                <InfoRow color={c.solid} label="Placement details" value={placementDetails} />
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-[var(--panel-2)] px-3 py-2.5 text-[12px] font-semibold text-[var(--muted)]">
                <LockIcon width={15} height={15} className="shrink-0" />
                {group.address
                  ? `Meets at ${group.address}`
                  : `Meets at a home in ${group.area}`}
                <span className="ml-auto shrink-0 rounded-full bg-[var(--surface)] px-1.5 py-[1px] text-[10px] font-bold text-[var(--faint)]">
                  Private
                </span>
              </div>
              {group.contactEmail && <CopyEmailRow email={group.contactEmail} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
