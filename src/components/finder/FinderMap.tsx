"use client";

import type { Group } from "@/lib/types";
import { lifeColors } from "@/lib/colors";

// ============================================================
// PHASE 3: replace this stylized placeholder with a real Google Map.
// Render a <div> map container, load the Maps JavaScript API with the
// browser key, and drop one AdvancedMarkerElement per group using the
// same teardrop markup below. Keep the list<->pin selection wiring.
// This is an internal, login-only coordinator tool, so the map may plot
// real group locations (getGroups). Keep addresses out of any future
// public-facing surface if one is ever added.
// ============================================================

export function FinderMap({
  groups,
  selectedId,
  onSelect,
}: {
  groups: Group[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#eaf3fc]">
      {/* soft terrain blobs */}
      <div
        className="absolute rounded-[46%]"
        style={{ left: "6%", top: "12%", width: 220, height: 180, background: "oklch(0.9 0.06 150)" }}
      />
      <div
        className="absolute rounded-[46%]"
        style={{ right: "8%", top: "8%", width: 190, height: 150, background: "oklch(0.9 0.05 150)" }}
      />
      <div
        className="absolute rounded-[50%]"
        style={{ left: "34%", bottom: "6%", width: 260, height: 150, background: "oklch(0.88 0.06 235)" }}
      />
      {/* roads */}
      <div className="absolute left-0 right-0 top-[42%] h-[6px] -rotate-3 bg-white/80" />
      <div className="absolute bottom-[26%] left-[20%] top-[-10%] w-[6px] rotate-6 bg-white/70" />

      {/* pins */}
      {groups.map((g, i) => {
        const c = lifeColors(g.life);
        const selected = g.id === selectedId;
        return (
          <button
            key={g.id}
            onClick={() => onSelect(g.id)}
            aria-label={`${g.name} pin`}
            className="absolute -translate-x-1/2 -translate-y-full transition-transform duration-150"
            style={{
              left: `${g.x ?? 50}%`,
              top: `${g.y ?? 50}%`,
              zIndex: selected ? 30 : 10,
              transform: `translate(-50%,-100%) scale(${selected ? 1.16 : 1})`,
            }}
          >
            <span
              className="flex h-[30px] w-[30px] items-center justify-center"
              style={{
                background: c.solid,
                borderRadius: "50% 50% 50% 0",
                transform: "rotate(-45deg)",
                boxShadow: selected
                  ? "0 8px 18px rgba(8,141,249,.42), 0 0 0 4px rgba(255,255,255,.95)"
                  : "0 3px 9px rgba(22,50,79,.3)",
              }}
            >
              <span
                className="text-[12px] font-extrabold text-white"
                style={{ transform: "rotate(45deg)" }}
              >
                {i + 1}
              </span>
            </span>
          </button>
        );
      })}

      <div className="absolute bottom-3 right-3 rounded-full bg-white/85 px-3 py-1 text-[10.5px] font-bold text-[#5b7a97] backdrop-blur">
        Map preview · Google Maps in production
      </div>
    </div>
  );
}
