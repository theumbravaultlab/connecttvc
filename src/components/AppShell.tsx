"use client";

import { useState } from "react";
import type { Group, Person } from "@/lib/types";
import { initialsOf } from "@/lib/types";
import { signOut } from "@/app/actions";
import { Avatar } from "@/components/ui";
import { HomeMark } from "@/components/icons";
import { Finder } from "@/components/finder/Finder";
import { Console } from "@/components/console/Console";

type View = "map" | "console";

export function AppShell({
  groups,
  people,
  userEmail,
  persisted,
}: {
  groups: Group[];
  people: Person[];
  userEmail: string | null;
  persisted: boolean;
}) {
  const [view, setView] = useState<View>("map");

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-white">
      {/* unified header */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#eef3f8] px-4 py-2.5 sm:px-6 sm:py-3">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <HomeMark />
          <span className="font-[family-name:var(--font-fredoka)] text-[17px] font-semibold text-[#16324f] sm:text-[19px]">
            Connect TVC
          </span>
          <span className="hidden rounded-full bg-[#eef6ff] px-2.5 py-1 text-[11px] font-extrabold text-[#088df9] sm:inline-flex">
            Coordinator
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="text-right leading-tight">
            <div className="max-w-[120px] truncate text-[12px] font-bold text-[#16324f] sm:max-w-[180px] sm:text-[12.5px]">
              {userEmail ?? "Coordinator"}
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="text-[11px] font-bold text-[#088df9] hover:underline"
              >
                Sign out
              </button>
            </form>
          </div>
          <Avatar initials={initialsOf(userEmail ?? "Coordinator")} />
        </div>
      </header>

      {/* top-level tabs */}
      <div className="flex shrink-0 items-center gap-1 border-b border-[#eef3f8] px-3 py-2 sm:px-6 sm:py-2.5">
        {(["map", "console"] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className="flex-1 rounded-full px-4 py-2 text-[13px] font-bold transition-colors sm:flex-none sm:py-1.5"
            style={
              view === v
                ? { background: "#eef6ff", color: "#088df9" }
                : { background: "transparent", color: "#5b7a97" }
            }
          >
            {v === "map" ? "Map" : "Console"}
          </button>
        ))}
      </div>

      {/* both stay mounted so in-progress edits survive tab switches */}
      <div
        className={`min-h-0 flex-1 flex-col ${view === "map" ? "flex" : "hidden"}`}
      >
        <Finder groups={groups} people={people} />
      </div>
      <div
        className={`min-h-0 flex-1 flex-col ${view === "console" ? "flex" : "hidden"}`}
      >
        <Console
          initialGroups={groups}
          initialPeople={people}
          persisted={persisted}
        />
      </div>
    </div>
  );
}
