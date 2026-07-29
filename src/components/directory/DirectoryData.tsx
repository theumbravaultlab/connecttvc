"use client";

import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { Group, Party, Person, Profile } from "@/lib/types";

type DirectoryData = {
  groups: Group[];
  setGroups: Dispatch<SetStateAction<Group[]>>;
  parties: Party[];
  setParties: Dispatch<SetStateAction<Party[]>>;
  people: Person[];
  setPeople: Dispatch<SetStateAction<Person[]>>;
  profiles: Profile[];
  setProfiles: Dispatch<SetStateAction<Profile[]>>;
  persisted: boolean;
};

const Ctx = createContext<DirectoryData | null>(null);

/** Holds the groups/parties/people lifted at the app shell so an edit on
 * any Directory page is instantly visible on the Map (and vice versa)
 * without needing to keep every route mounted at once. */
export function DirectoryDataProvider({
  groups: initialGroups,
  parties: initialParties,
  people: initialPeople,
  profiles: initialProfiles,
  persisted,
  children,
}: {
  groups: Group[];
  parties: Party[];
  people: Person[];
  profiles: Profile[];
  persisted: boolean;
  children: ReactNode;
}) {
  const [groups, setGroups] = useState(initialGroups);
  const [parties, setParties] = useState(initialParties);
  const [people, setPeople] = useState(initialPeople);
  const [profiles, setProfiles] = useState(initialProfiles);

  return (
    <Ctx.Provider
      value={{ groups, setGroups, parties, setParties, people, setPeople, profiles, setProfiles, persisted }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useDirectoryData(): DirectoryData {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDirectoryData must be used within DirectoryDataProvider");
  return ctx;
}
