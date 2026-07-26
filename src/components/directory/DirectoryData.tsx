"use client";

import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { Group, Person } from "@/lib/types";

type DirectoryData = {
  groups: Group[];
  setGroups: Dispatch<SetStateAction<Group[]>>;
  people: Person[];
  setPeople: Dispatch<SetStateAction<Person[]>>;
  persisted: boolean;
};

const Ctx = createContext<DirectoryData | null>(null);

/** Holds the groups/people lifted at the app shell so an edit on any
 * Directory page is instantly visible on the Map (and vice versa) without
 * needing to keep every route mounted at once. */
export function DirectoryDataProvider({
  groups: initialGroups,
  people: initialPeople,
  persisted,
  children,
}: {
  groups: Group[];
  people: Person[];
  persisted: boolean;
  children: ReactNode;
}) {
  const [groups, setGroups] = useState(initialGroups);
  const [people, setPeople] = useState(initialPeople);

  return (
    <Ctx.Provider value={{ groups, setGroups, people, setPeople, persisted }}>
      {children}
    </Ctx.Provider>
  );
}

export function useDirectoryData(): DirectoryData {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDirectoryData must be used within DirectoryDataProvider");
  return ctx;
}
