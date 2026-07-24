"use client";

import { useState } from "react";
import { APIProvider } from "@vis.gl/react-google-maps";
import type { Group, Person } from "@/lib/types";
import { initialsOf } from "@/lib/types";
import { signOut } from "@/app/actions";
import { Avatar } from "@/components/ui";
import { HomeMark } from "@/components/icons";
import { Finder } from "@/components/finder/Finder";
import { Console } from "@/components/console/Console";

type View = "map" | "console";

// Loaded once here (not per-tab) so the Map tab and Console's address
// autocomplete share a single Maps JS instance instead of each loading
// their own copy of the script.
const BROWSER_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? "";

export function AppShell({
  groups: initialGroups,
  people: initialPeople,
  userEmail,
  persisted,
}: {
  groups: Group[];
  people: Person[];
  userEmail: string | null;
  persisted: boolean;
}) {
  const [view, setView] = useState<View>("map");
  // Lifted above Finder/Console so a Console edit (or delete) is immediately
  // visible on the Map tab too, instead of each tab holding its own copy.
  const [groups, setGroups] = useState(initialGroups);
  const [people, setPeople] = useState(initialPeople);

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
      <MapsScope>
        <div
          className={`min-h-0 flex-1 flex-col ${view === "map" ? "flex" : "hidden"}`}
        >
          <Finder groups={groups} people={people} />
        </div>
        <div
          className={`min-h-0 flex-1 flex-col ${view === "console" ? "flex" : "hidden"}`}
        >
          <Console
            groups={groups}
            setGroups={setGroups}
            people={people}
            setPeople={setPeople}
            persisted={persisted}
          />
        </div>
      </MapsScope>
    </div>
  );
}

/** Only wraps in APIProvider (and loads the Maps JS script) when a browser
 * key is actually configured, so demo mode stays free of Google network
 * calls and console noise. */
function MapsScope({ children }: { children: React.ReactNode }) {
  if (!BROWSER_KEY) return <>{children}</>;
  return (
    <APIProvider apiKey={BROWSER_KEY} libraries={["places", "marker"]}>
      {children}
    </APIProvider>
  );
}
