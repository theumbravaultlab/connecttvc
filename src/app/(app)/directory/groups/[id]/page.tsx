"use client";

import { useParams } from "next/navigation";
import { GroupEditPage } from "@/components/directory/GroupEditPage";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <GroupEditPage id={id} />;
}
