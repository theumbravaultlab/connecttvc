"use client";

import { cloneElement, isValidElement, useId, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { FieldLabel } from "@/components/ui";
import { ChevronLeftIcon } from "@/components/icons";

/** Returns to wherever the user came from — the Map (if they got here via
 * an "Edit" button on a group/person card) or the Directory list (if they
 * clicked a row there). `fallbackHref` only kicks in when there's no
 * in-app history to go back to (e.g. the edit URL was opened directly). */
export function BackLink({ fallbackHref, label = "Back" }: { fallbackHref: string; label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 2) {
          router.back();
        } else {
          router.push(fallbackHref);
        }
      }}
      className="flex w-fit items-center gap-1 text-[13px] font-bold text-[var(--brand-blue)] hover:underline"
    >
      <ChevronLeftIcon width={16} height={16} />
      {label}
    </button>
  );
}

export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-5 mb-2.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--brand-blue)]">
      {children}
    </h3>
  );
}

/** A form field. `full` spans the row, otherwise ~half width (wraps). */
export function Field({
  label,
  tag,
  matching,
  full = false,
  children,
}: {
  label: string;
  tag?: string;
  matching?: boolean;
  full?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  const control = isValidElement<{ id?: string }>(children)
    ? cloneElement(children, { id })
    : children;

  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      <FieldLabel tag={tag} matching={matching} htmlFor={id}>
        {label}
      </FieldLabel>
      {control}
    </div>
  );
}
