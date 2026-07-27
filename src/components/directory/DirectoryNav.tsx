"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/directory/groups", label: "Home Groups" },
  { href: "/directory/parties", label: "Parties" },
] as const;

export function DirectoryNav() {
  const pathname = usePathname();

  return (
    <div className="flex rounded-full bg-[var(--panel-4)] p-1">
      {TABS.map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className="rounded-full px-4 py-1.5 text-[13px] font-bold transition-colors"
            style={
              active
                ? { background: "var(--surface)", color: "var(--brand-blue)", boxShadow: "0 1px 2px rgba(22,50,79,.08)" }
                : { background: "transparent", color: "var(--muted)" }
            }
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
