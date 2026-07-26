"use client";

import { useDirectoryData } from "@/components/directory/DirectoryData";
import { ReportsPage } from "@/components/reports/ReportsPage";

export default function Page() {
  const { groups, people } = useDirectoryData();
  return <ReportsPage groups={groups} people={people} />;
}
