"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { APIProvider } from "@vis.gl/react-google-maps";
import type { Group, Party, Person, Profile } from "@/lib/types";
import { initialsOf } from "@/lib/types";
import { signOut } from "@/app/actions";
import { Avatar } from "@/components/ui";
import { HomeMark, MoonIcon, SunIcon } from "@/components/icons";
import { DirectoryDataProvider, useDirectoryData } from "@/components/directory/DirectoryData";
import { EditDisplayNameModal } from "@/components/EditDisplayNameModal";
import { useTheme } from "@/components/ThemeProvider";

const BROWSER_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? "";

const tabStyle = (active: boolean) =>
  active
    ? { background: "var(--panel-3)", color: "var(--brand-blue)" }
    : { background: "transparent", color: "var(--muted)" };

export function AppShell({
  groups,
  parties,
  people,
  profiles,
  viewerId,
  viewerEmail,
  persisted,
  children,
}: {
  groups: Group[];
  parties: Party[];
  people: Person[];
  profiles: Profile[];
  viewerId: string | null;
  viewerEmail: string | null;
  persisted: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const onDirectory = pathname.startsWith("/directory");
  const onReports = pathname.startsWith("/reports");
  const onMap = !onDirectory && !onReports;
  const { theme, toggleTheme } = useTheme();

  const groupsOpen = groups.filter((g) => g.status === "Open").length;
  const partiesNeedingPlacement = parties.filter(
    (p) => p.status === "New" || p.status === "Actively Searching" || p.status === "Waitlisted",
  ).length;

  return (
    <DirectoryDataProvider
      groups={groups}
      parties={parties}
      people={people}
      profiles={profiles}
      persisted={persisted}
    >
      <div className="flex h-full w-full flex-col overflow-hidden bg-[var(--surface)] print:h-auto print:overflow-visible">
        {/* unified header — hidden when printing/exporting a PDF */}
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--divider)] px-4 py-2.5 sm:px-6 sm:py-3 print:hidden">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <HomeMark />
            <span className="font-[family-name:var(--font-fredoka)] text-[17px] font-semibold text-[var(--ink)] sm:text-[19px]">
              Connect TVC
            </span>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <div className="flex items-center gap-1.5 rounded-full bg-[var(--panel-4)] px-3 py-1.5">
              <span className="text-[13px] font-extrabold text-[var(--ink)]">{groups.length}</span>
              <span className="text-[11px] font-bold text-[var(--muted)]">Groups</span>
              <span className="text-[var(--border)]">·</span>
              <span className="text-[13px] font-extrabold text-[oklch(0.5_0.14_150)]">{groupsOpen}</span>
              <span className="text-[11px] font-bold text-[var(--muted)]">Open</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-[var(--panel-4)] px-3 py-1.5">
              <span className="text-[13px] font-extrabold text-[var(--ink)]">{parties.length}</span>
              <span className="text-[11px] font-bold text-[var(--muted)]">Parties</span>
              <span className="text-[var(--border)]">·</span>
              <span className="text-[13px] font-extrabold text-[oklch(0.55_0.14_70)]">
                {partiesNeedingPlacement}
              </span>
              <span className="text-[11px] font-bold text-[var(--muted)]">Needing placement</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--panel-4)]"
            >
              {theme === "dark" ? <SunIcon width={17} height={17} /> : <MoonIcon width={17} height={17} />}
            </button>
            <AccountMenu viewerId={viewerId} viewerEmail={viewerEmail} />
          </div>
        </header>

        {/* top-level tabs — hidden when printing/exporting a PDF */}
        <div className="flex shrink-0 items-center gap-1 border-b border-[var(--divider)] px-3 py-2 sm:px-6 sm:py-2.5 print:hidden">
          <Link
            href="/"
            className="flex-1 rounded-full px-4 py-2 text-center text-[13px] font-bold transition-colors sm:flex-none sm:py-1.5"
            style={tabStyle(onMap)}
          >
            Map
          </Link>
          <Link
            href="/directory/groups"
            className="flex-1 rounded-full px-4 py-2 text-center text-[13px] font-bold transition-colors sm:flex-none sm:py-1.5"
            style={tabStyle(onDirectory)}
          >
            Directory
          </Link>
          <Link
            href="/reports"
            className="flex-1 rounded-full px-4 py-2 text-center text-[13px] font-bold transition-colors sm:flex-none sm:py-1.5"
            style={tabStyle(onReports)}
          >
            Reports
          </Link>
        </div>

        {/* the routed page (Map, or a Directory list/edit page) fills the rest */}
        <MapsScope>
          <div className="flex min-h-0 flex-1 flex-col print:min-h-0 print:flex-none">{children}</div>
        </MapsScope>
      </div>
    </DirectoryDataProvider>
  );
}

/** The header's name/avatar block, plus the modal it opens. A descendant
 * of DirectoryDataProvider (rendered inside AppShell's own JSX tree), so it
 * can read the live `profiles` list and patch it on save — the same
 * pattern every other piece of shared state in this app already uses. */
function AccountMenu({
  viewerId,
  viewerEmail,
}: {
  viewerId: string | null;
  viewerEmail: string | null;
}) {
  const { profiles, setProfiles } = useDirectoryData();
  const [open, setOpen] = useState(false);
  const me = profiles.find((p) => p.id === viewerId) ?? null;
  const displayName = me?.fullName || viewerEmail || "Coordinator";

  return (
    <>
      <div className="text-right leading-tight">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="max-w-[120px] truncate text-[12px] font-bold text-[var(--ink)] hover:underline sm:max-w-[180px] sm:text-[13px]"
        >
          {displayName}
        </button>
        <form action={signOut}>
          <button
            type="submit"
            className="block text-[11px] font-bold text-[var(--brand-blue)] hover:underline"
          >
            Sign out
          </button>
        </form>
      </div>
      <button type="button" onClick={() => setOpen(true)} aria-label="Edit your display name">
        <Avatar initials={initialsOf(displayName)} />
      </button>
      <EditDisplayNameModal
        open={open}
        initialName={me?.fullName ?? ""}
        onClose={() => setOpen(false)}
        onSaved={(newName) => {
          if (viewerId) {
            setProfiles((ps) =>
              ps.some((p) => p.id === viewerId)
                ? ps.map((p) => (p.id === viewerId ? { ...p, fullName: newName } : p))
                : [...ps, { id: viewerId, fullName: newName }],
            );
          }
          setOpen(false);
        }}
      />
    </>
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
