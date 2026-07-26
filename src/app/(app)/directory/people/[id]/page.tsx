"use client";

import { useParams } from "next/navigation";
import { PersonEditPage } from "@/components/directory/PersonEditPage";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <PersonEditPage id={id} />;
}
