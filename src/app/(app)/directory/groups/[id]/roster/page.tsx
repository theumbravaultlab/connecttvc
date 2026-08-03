"use client";

import { useParams } from "next/navigation";
import { GroupRosterPage } from "@/components/directory/GroupRosterPage";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <GroupRosterPage id={id} />;
}
