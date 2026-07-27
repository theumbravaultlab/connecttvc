"use client";

import { useParams } from "next/navigation";
import { PartyEditPage } from "@/components/directory/PartyEditPage";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <PartyEditPage id={id} />;
}
