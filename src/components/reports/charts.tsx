"use client";

/** Small, theme-aware chart primitives for the Reports section — hand-rolled
 * rather than a charting dependency, so they inherit the app's CSS custom
 * properties (and dark mode) for free, same as the rest of the app's
 * hand-built badges/bars in @/components/ui. */

export function StatCard({
  label,
  value,
  sublabel,
  accent,
}: {
  label: string;
  value: string;
  sublabel?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--divider)] bg-[var(--panel-1)] p-4">
      <div className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--faint)]">
        {label}
      </div>
      <div
        className="mt-1 font-[family-name:var(--font-fredoka)] text-[28px] font-semibold leading-none"
        style={{ color: accent ?? "var(--ink)" }}
      >
        {value}
      </div>
      {sublabel && (
        <div className="mt-1.5 text-[12px] font-semibold text-[var(--muted)]">{sublabel}</div>
      )}
    </div>
  );
}

export function ReportCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-[var(--divider)] bg-[var(--panel-1)] p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="font-[family-name:var(--font-fredoka)] text-[15px] font-semibold text-[var(--ink)]">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}

/** A single labeled bar — used for ordered/funnel-style breakdowns where
 * each row keeps its own place (e.g. person status stages). */
export function HBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[13px] font-semibold">
        <span className="text-[var(--body-detail)]">{label}</span>
        <span className="font-extrabold text-[var(--ink)]">{value}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--divider-2)]">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

/** One bar split into colored segments proportional to each value — a quick
 * "whole picture" read of a status breakdown, with a legend underneath. */
export function SegmentedBar({
  segments,
}: {
  segments: { label: string; value: number; color: string }[];
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-[var(--divider-2)]">
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <div
              key={s.label}
              style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
              title={`${s.label}: ${s.value}`}
            />
          ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {segments.map((s) => (
          <span
            key={s.label}
            className="flex items-center gap-1.5 text-[12px] font-bold text-[var(--muted)]"
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
            {s.label} <span className="text-[var(--ink)]">{s.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Two-series comparison (e.g. Groups vs People) across several categories —
 * each category gets a pair of bars, scaled against the shared max so bar
 * lengths are comparable across the whole chart, not just within a row. */
export function PairedBarChart({
  rows,
  legendA,
  legendB,
  colorA,
  colorB,
}: {
  rows: { label: string; a: number; b: number }[];
  legendA: string;
  legendB: string;
  colorA: string;
  colorB: string;
}) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.a, r.b]));
  return (
    <div>
      <div className="mb-4 flex items-center gap-4 text-[12px] font-bold text-[var(--muted)]">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorA }} />
          {legendA}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorB }} />
          {legendB}
        </span>
      </div>
      <div className="flex flex-col gap-3.5">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="mb-1 text-[13px] font-bold text-[var(--ink)]">{r.label}</div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--divider-2)]">
                  <div
                    className="h-full rounded-full transition-[width] duration-300"
                    style={{ width: `${(r.a / max) * 100}%`, background: colorA }}
                  />
                </div>
                <span className="w-7 shrink-0 text-right text-[11px] font-extrabold text-[var(--ink)]">
                  {r.a}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--divider-2)]">
                  <div
                    className="h-full rounded-full transition-[width] duration-300"
                    style={{ width: `${(r.b / max) * 100}%`, background: colorB }}
                  />
                </div>
                <span className="w-7 shrink-0 text-right text-[11px] font-extrabold text-[var(--ink)]">
                  {r.b}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
