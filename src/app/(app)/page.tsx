"use client";

import { useDirectoryData } from "@/components/directory/DirectoryData";
import { Finder } from "@/components/finder/Finder";

export default function MapPage() {
  const { groups, parties, people } = useDirectoryData();
  return <Finder groups={groups} parties={parties} people={people} />;
}
