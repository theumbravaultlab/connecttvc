"use client";

import { DownloadIcon, UploadIcon, AlertIcon } from "@/components/icons";

/** The file-pick screen, shared between the Groups and Parties CSV
 * importers — genuinely identical between the two (a file input plus a
 * "download a template" escape hatch), unlike the mapping/preview step
 * which differs by entity and stays separate per the pattern
 * GroupForm/PartyForm etc. already establish throughout this app. */
export function FilePicker({
  error,
  onFile,
  onDownloadTemplate,
  templateLabel,
}: {
  error?: string;
  onFile: (file: File) => void;
  onDownloadTemplate: () => void;
  templateLabel: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--panel-1)] px-6 py-10 text-center">
      <UploadIcon width={28} height={28} className="text-[var(--faint)]" />
      <div className="flex flex-wrap items-center justify-center gap-2">
        <label
          htmlFor="csv-file"
          className="cursor-pointer rounded-full bg-[var(--brand-blue)] px-4 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-[var(--brand-blue-dark)]"
        >
          Choose CSV file
        </label>
        <input
          id="csv-file"
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={onDownloadTemplate}
          className="flex items-center gap-1.5 rounded-full border border-[var(--border)] px-4 py-2 text-[12.5px] font-bold text-[var(--muted)] transition-colors hover:bg-[var(--panel-2)]"
        >
          <DownloadIcon width={13} height={13} />
          {templateLabel}
        </button>
      </div>
      <p className="text-[12px] font-semibold text-[var(--faint)]">
        Not sure where to start? Download the template — every column is labeled with whether
        it&apos;s high or low priority to fill in.
      </p>
      {error && (
        <p className="flex items-center gap-1.5 text-[12px] font-bold text-[oklch(0.55_0.18_20)]">
          <AlertIcon width={13} height={13} />
          {error}
        </p>
      )}
    </div>
  );
}

/** Small priority badge, used in both importers' column-mapping UI so a
 * coordinator can see at a glance which unmapped columns actually matter. */
export function PriorityBadge({ priority }: { priority: "high" | "low" }) {
  return (
    <span
      className="shrink-0 rounded-full px-1.5 py-[1px] text-[9.5px] font-extrabold uppercase tracking-wide"
      style={
        priority === "high"
          ? { background: "var(--amber-bg)", color: "var(--amber-fg)" }
          : { background: "var(--divider)", color: "var(--faint)" }
      }
    >
      {priority === "high" ? "High" : "Low"}
    </span>
  );
}
