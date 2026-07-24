import type { ReactNode } from "react";
import { FieldLabel } from "@/components/ui";

export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-5 mb-2.5 text-[11px] font-extrabold uppercase tracking-wide text-[#088df9]">
      {children}
    </h3>
  );
}

/** A form field. `full` spans the row, otherwise ~half width (wraps). */
export function Field({
  label,
  tag,
  full = false,
  children,
}: {
  label: string;
  tag?: string;
  full?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`flex-grow ${full ? "w-full" : "w-full sm:w-[48%]"}`}>
      <FieldLabel tag={tag}>{label}</FieldLabel>
      {children}
    </div>
  );
}
