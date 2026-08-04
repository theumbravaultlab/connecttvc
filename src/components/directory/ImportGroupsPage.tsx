"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { parseCSV } from "@/lib/csv";
import { buildTemplateCsv, downloadCsv } from "@/lib/csvTemplate";
import {
  buildGroupImportRow,
  guessGroupField,
  groupTemplateExampleRow,
  groupTemplateFields,
  GROUP_FIELD_PRIORITY,
  GROUP_IMPORT_FIELD_LABELS,
  type GroupImportField,
  type ImportGroupRow,
} from "@/lib/importGroups";
import { bulkImportGroups } from "@/app/actions";
import { AlertIcon } from "@/components/icons";
import { FilePicker, PriorityBadge } from "./CsvImportShared";
import { useDirectoryData } from "./DirectoryData";
import { BackLink } from "./form-bits";

const IMPORT_FIELDS = Object.keys(GROUP_IMPORT_FIELD_LABELS) as GroupImportField[];
const PREVIEW_LIMIT = 20;
// Guards against the coordinator forgetting to delete the template's own
// example row before uploading — buildTemplateCsv() always prefixes it
// with this exact marker.
const EXAMPLE_ROW_PREFIX = "EXAMPLE —";

type Stage =
  | { stage: "pick-file"; error?: string }
  | { stage: "mapping"; headers: string[]; rows: string[][]; mapping: GroupImportField[] }
  | { stage: "importing" }
  | { stage: "done"; imported: number; skipped: number };

function downloadGroupTemplate() {
  downloadCsv(
    "connect-tvc-groups-template.csv",
    buildTemplateCsv(groupTemplateFields(), groupTemplateExampleRow()),
  );
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/** Bulk CSV import for Home Groups — same column-mapping approach as
 * ImportPartiesPage.tsx (kept as a separate component rather than a
 * shared generic one, matching this app's established convention of
 * parallel-but-separate Group/Party components throughout the Directory).
 * Duplicate detection here is deliberately simpler than the Party
 * importer's multi-signal findDuplicates() — just an exact name match
 * against existing groups, since a group's identity really is its name
 * in a way a person's isn't. */
export function ImportGroupsPage() {
  const router = useRouter();
  const { groups, setGroups } = useDirectoryData();
  const [state, setState] = useState<Stage>({ stage: "pick-file" });
  const existingNames = useMemo(() => new Set(groups.map((g) => normalizeName(g.name))), [groups]);

  const handleFile = async (file: File) => {
    const text = await file.text();
    const parsed = parseCSV(text).filter((r) => !r[0]?.startsWith(EXAMPLE_ROW_PREFIX));
    if (parsed.length < 2) {
      setState({ stage: "pick-file", error: "That file has no data rows to import." });
      return;
    }
    const [headers, ...rows] = parsed;
    setState({ stage: "mapping", headers, rows, mapping: headers.map(guessGroupField) });
  };

  return (
    <div className="hw-scroll min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto flex w-full max-w-[900px] flex-col gap-4">
        <BackLink fallbackHref="/directory/groups" />
        <div>
          <h1 className="font-[family-name:var(--font-fredoka)] text-[21px] font-semibold text-[var(--ink)]">
            Import home groups from CSV
          </h1>
          <p className="mt-1 text-[13px] font-semibold text-[var(--faint)]">
            Each row becomes one Home Group. Addresses are geocoded automatically in the
            background after import, same as bulk-inserted sample data — no need to wait here.
          </p>
        </div>

        {state.stage === "pick-file" && (
          <FilePicker
            error={state.error}
            onFile={handleFile}
            onDownloadTemplate={downloadGroupTemplate}
            templateLabel="Download group template"
          />
        )}

        {state.stage === "mapping" && (
          <MappingStep
            headers={state.headers}
            rows={state.rows}
            mapping={state.mapping}
            existingNames={existingNames}
            onMappingChange={(mapping) => setState({ ...state, mapping })}
            onCancel={() => setState({ stage: "pick-file" })}
            onImport={async () => {
              setState({ stage: "importing" });
              const importRows = state.rows.map((r) => buildGroupImportRow(r, state.mapping));
              const result = await bulkImportGroups(importRows);
              if (!result.ok) {
                setState({
                  stage: "mapping",
                  headers: state.headers,
                  rows: state.rows,
                  mapping: state.mapping,
                });
                return;
              }
              setGroups((gs) => [...gs, ...result.groups]);
              setState({ stage: "done", imported: result.imported, skipped: result.skipped });
            }}
          />
        )}

        {state.stage === "importing" && (
          <p className="text-[13px] font-semibold text-[var(--faint)]">Importing…</p>
        )}

        {state.stage === "done" && (
          <div className="flex flex-col gap-3 rounded-xl border border-[var(--divider)] bg-[var(--panel-1)] p-5">
            <p className="text-[14px] font-bold text-[var(--ink)]">
              Imported {state.imported} {state.imported === 1 ? "group" : "groups"}
              {state.skipped > 0 ? ` — skipped ${state.skipped} row${state.skipped === 1 ? "" : "s"} with no name` : ""}.
            </p>
            <p className="text-[12.5px] font-semibold text-[var(--muted)]">
              Open Directory → Home Groups to trigger automatic geocoding for the addresses just
              imported.
            </p>
            <button
              type="button"
              onClick={() => router.push("/directory/groups")}
              className="w-fit rounded-full bg-[var(--brand-blue)] px-4 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-[var(--brand-blue-dark)]"
            >
              Go to Home Groups
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MappingStep({
  headers,
  rows,
  mapping,
  existingNames,
  onMappingChange,
  onCancel,
  onImport,
}: {
  headers: string[];
  rows: string[][];
  mapping: GroupImportField[];
  existingNames: Set<string>;
  onMappingChange: (mapping: GroupImportField[]) => void;
  onCancel: () => void;
  onImport: () => void;
}) {
  const nameMapped = mapping.includes("name");
  const preview = useMemo(() => rows.slice(0, PREVIEW_LIMIT), [rows]);
  const previewRows: { row: ImportGroupRow; duplicate: boolean }[] = useMemo(
    () =>
      preview.map((cells) => {
        const row = buildGroupImportRow(cells, mapping);
        return { row, duplicate: !!row.name && existingNames.has(normalizeName(row.name)) };
      }),
    [preview, mapping, existingNames],
  );
  const totalDuplicates = previewRows.filter((r) => r.duplicate).length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-[var(--faint)]">
          Map each column ({headers.length} found, {rows.length} data rows)
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {headers.map((header, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-[var(--divider)] bg-[var(--panel-1)] px-2.5 py-2">
              <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-[var(--ink)]" title={header}>
                {header || `Column ${i + 1}`}
              </span>
              {mapping[i] !== "skip" && <PriorityBadge priority={GROUP_FIELD_PRIORITY[mapping[i]]} />}
              <select
                value={mapping[i]}
                onChange={(e) => {
                  const next = [...mapping];
                  next[i] = e.target.value as GroupImportField;
                  onMappingChange(next);
                }}
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-1.5 py-1 text-[11.5px] font-semibold text-[var(--ink)] outline-none"
              >
                {IMPORT_FIELDS.map((f) => (
                  <option key={f} value={f}>
                    {GROUP_IMPORT_FIELD_LABELS[f]}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        {!nameMapped && (
          <p className="mt-2 flex items-center gap-1.5 text-[12px] font-bold text-[oklch(0.55_0.18_20)]">
            <AlertIcon width={13} height={13} />
            Map a column to &quot;Group name&quot; — rows with no name are skipped, not imported.
          </p>
        )}
      </div>

      <div>
        <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-[var(--faint)]">
          Preview (first {preview.length} of {rows.length} rows){totalDuplicates > 0 ? ` — ${totalDuplicates} name${totalDuplicates === 1 ? "" : "s"} already exist` : ""}
        </p>
        <div className="hw-scroll max-h-80 overflow-auto rounded-xl border border-[var(--divider)]">
          <table className="w-full min-w-[640px] border-collapse text-[12.5px]">
            <thead className="sticky top-0 bg-[var(--panel-1)]">
              <tr className="border-b border-[var(--divider)] text-left text-[10.5px] font-extrabold uppercase tracking-wide text-[var(--faint)]">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Day</th>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Host</th>
                <th className="px-3 py-2">Life stage</th>
                <th className="px-3 py-2">Capacity</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map(({ row, duplicate }, i) => (
                <tr key={i} className="border-b border-[var(--divider)]">
                  <td className={`px-3 py-2 font-bold ${row.name ? "text-[var(--ink)]" : "text-[oklch(0.55_0.18_20)]"}`}>
                    {row.name || "(no name — will be skipped)"}
                  </td>
                  <td className="px-3 py-2 text-[var(--muted)]">{row.day}</td>
                  <td className="px-3 py-2 text-[var(--muted)]">{row.time}</td>
                  <td className="px-3 py-2 text-[var(--muted)]">{row.host || "—"}</td>
                  <td className="px-3 py-2 text-[var(--muted)]">{row.life}</td>
                  <td className="px-3 py-2 text-[var(--muted)]">{row.capacity}</td>
                  <td className="px-3 py-2 text-[var(--muted)]">{row.status}</td>
                  <td className="px-3 py-2">
                    {duplicate && (
                      <span className="flex items-center gap-1 text-[10.5px] font-bold text-[var(--amber-fg)]">
                        <AlertIcon width={11} height={11} />
                        Name already exists
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!nameMapped}
          onClick={onImport}
          className="rounded-full bg-[var(--brand-blue)] px-4 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-[var(--brand-blue-dark)] disabled:opacity-50"
        >
          Import {rows.length} row{rows.length === 1 ? "" : "s"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-[var(--border)] px-4 py-2 text-[12.5px] font-bold text-[var(--muted)] transition-colors hover:bg-[var(--panel-1)]"
        >
          Choose a different file
        </button>
      </div>
    </div>
  );
}
