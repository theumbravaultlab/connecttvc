"use client";

import { useDirectoryData } from "@/components/directory/DirectoryData";
import { Finder } from "@/components/finder/Finder";

export default function MapPage() {
  const { groups, people } = useDirectoryData();
  return <Finder groups={groups} people={people} />;
}
