"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Party, Person } from "@/lib/types";
import { parseCSV } from "@/lib/csv";
import {
  buildImportRow,
  guessField,
  IMPORT_FIELD_LABELS,
  type ImportField,
  type ImportPartyRow,
} from "@/lib/importParties";
import { findDuplicates } from "@/lib/duplicates";
import { bulkImportParties } from "@/app/actions";
import { AlertIcon, UploadIcon } from "@/components/icons";
import { useDirectoryData } from "./DirectoryData";
import { BackLink } from "./form-bits";

const IMPORT_FIELDS = Object.keys(IMPORT_FIELD_LABELS) as ImportField[];
const PREVIEW_LIMIT = 20;

type Stage =
  | { stage: "pick-file"; error?: string }
  | { stage: "mapping"; headers: string[]; rows: string[][]; mapping: ImportField[] }
  | { stage: "importing" }
  | { stage: "done"; imported: number; skipped: number };

/** Bulk CSV import for Parties — the highest-priority pending item before
 * real coordinator data can replace the sample dataset (real data lives in
 * Asana today, per PROJECT_STATUS.md's "Product direction"). Column
 * mapping rather than a fixed schema, since the exact Asana export shape
 * isn't known yet. Each row becomes one Party of one member — merging
 * rows into multi-person households isn't attempted here, see the
 * in-file comment on the scope decision. */
export function ImportPartiesPage() {
  const router = useRouter();
  const { parties, people, setParties, setPeople } = useDirectoryData();
  const [state, setState] = useState<Stage>({ stage: "pick-file" });

  const handleFile = async (file: File) => {
    const text = await file.text();
    const parsed = parseCSV(text);
    if (parsed.length < 2) {
      setState({ stage: "pick-file", error: "That file has no data rows to import." });
      return;
    }
    const [headers, ...rows] = parsed;
    setState({ stage: "mapping", headers, rows, mapping: headers.map(guessField) });
  };

  return (
    <div className="hw-scroll min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto flex w-full max-w-[900px] flex-col gap-4">
        <BackLink fallbackHref="/directory/parties" />
        <div>
          <h1 className="font-[family-name:var(--font-fredoka)] text-[21px] font-semibold text-[var(--ink)]">
            Import parties from CSV
          </h1>
          <p className="mt-1 text-[13px] font-semibold text-[var(--faint)]">
            Each row becomes one party (household) with one linked member. Addresses are
            geocoded automatically in the background after import, same as bulk-inserted sample
            data — no need to wait here.
          </p>
        </div>

        {state.stage === "pick-file" && (
          <FilePicker error={state.error} onFile={handleFile} />
        )}

        {state.stage === "mapping" && (
          <MappingStep
            headers={state.headers}
            rows={state.rows}
            mapping={state.mapping}
            existingParties={parties}
            existingPeople={people}
            onMappingChange={(mapping) => setState({ ...state, mapping })}
            onCancel={() => setState({ stage: "pick-file" })}
            onImport={async () => {
              setState({ stage: "importing" });
              const importRows = state.rows.map((r) => buildImportRow(r, state.mapping));
              const result = await bulkImportParties(importRows);
              if (!result.ok) {
                setState({
                  stage: "mapping",
                  headers: state.headers,
                  rows: state.rows,
                  mapping: state.mapping,
                });
                return;
              }
              setParties((ps) => [...ps, ...result.parties]);
              setPeople((ps) => [...ps, ...result.people]);
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
              Imported {state.imported} {state.imported === 1 ? "party" : "parties"}
              {state.skipped > 0 ? ` — skipped ${state.skipped} row${state.skipped === 1 ? "" : "s"} with no name` : ""}.
            </p>
            <p className="text-[12.5px] font-semibold text-[var(--muted)]">
              Open Directory → Parties to trigger automatic geocoding for the addresses just
              imported.
            </p>
            <button
              type="button"
              onClick={() => router.push("/directory/parties")}
              className="w-fit rounded-full bg-[var(--brand-blue)] px-4 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-[var(--brand-blue-dark)]"
            >
              Go to Parties
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function FilePicker({ error, onFile }: { error?: string; onFile: (file: File) => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--panel-1)] px-6 py-10 text-center">
      <UploadIcon width={28} height={28} className="text-[var(--faint)]" />
      <div>
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
      </div>
      <p className="text-[12px] font-semibold text-[var(--faint)]">
        The first row should be column headers (Name, Email, Phone, Address, etc.).
      </p>
      {error && <p className="text-[12px] font-bold text-[oklch(0.55_0.18_20)]">{error}</p>}
    </div>
  );
}

function MappingStep({
  headers,
  rows,
  mapping,
  existingParties,
  existingPeople,
  onMappingChange,
  onCancel,
  onImport,
}: {
  headers: string[];
  rows: string[][];
  mapping: ImportField[];
  existingParties: Party[];
  existingPeople: Person[];
  onMappingChange: (mapping: ImportField[]) => void;
  onCancel: () => void;
  onImport: () => void;
}) {
  const nameMapped = mapping.includes("name");
  const preview = useMemo(() => rows.slice(0, PREVIEW_LIMIT), [rows]);
  const previewRows: { row: ImportPartyRow; duplicates: ReturnType<typeof findDuplicates> }[] = useMemo(
    () =>
      preview.map((cells) => {
        const row = buildImportRow(cells, mapping);
        return {
          row,
          duplicates: row.name
            ? findDuplicates(
                { name: row.partyName || row.name, email: row.email, phone: row.phone },
                existingParties,
                existingPeople,
              )
            : [],
        };
      }),
    [preview, mapping, existingParties, existingPeople],
  );
  const totalDuplicates = previewRows.filter((r) => r.duplicates.length > 0).length;

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
              <select
                value={mapping[i]}
                onChange={(e) => {
                  const next = [...mapping];
                  next[i] = e.target.value as ImportField;
                  onMappingChange(next);
                }}
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-1.5 py-1 text-[11.5px] font-semibold text-[var(--ink)] outline-none"
              >
                {IMPORT_FIELDS.map((f) => (
                  <option key={f} value={f}>
                    {IMPORT_FIELD_LABELS[f]}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        {!nameMapped && (
          <p className="mt-2 flex items-center gap-1.5 text-[12px] font-bold text-[oklch(0.55_0.18_20)]">
            <AlertIcon width={13} height={13} />
            Map a column to &quot;Name&quot; — rows with no name are skipped, not imported.
          </p>
        )}
      </div>

      <div>
        <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-[var(--faint)]">
          Preview (first {preview.length} of {rows.length} rows){totalDuplicates > 0 ? ` — ${totalDuplicates} possible duplicate${totalDuplicates === 1 ? "" : "s"}` : ""}
        </p>
        <div className="hw-scroll max-h-80 overflow-auto rounded-xl border border-[var(--divider)]">
          <table className="w-full min-w-[640px] border-collapse text-[12.5px]">
            <thead className="sticky top-0 bg-[var(--panel-1)]">
              <tr className="border-b border-[var(--divider)] text-left text-[10.5px] font-extrabold uppercase tracking-wide text-[var(--faint)]">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Party name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Address</th>
                <th className="px-3 py-2">Life stage</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map(({ row, duplicates }, i) => (
                <tr key={i} className="border-b border-[var(--divider)]">
                  <td className={`px-3 py-2 font-bold ${row.name ? "text-[var(--ink)]" : "text-[oklch(0.55_0.18_20)]"}`}>
                    {row.name || "(no name — will be skipped)"}
                  </td>
                  <td className="px-3 py-2 text-[var(--muted)]">{row.partyName || "—"}</td>
                  <td className="px-3 py-2 text-[var(--muted)]">{row.email || "—"}</td>
                  <td className="px-3 py-2 text-[var(--muted)]">{row.phone || "—"}</td>
                  <td className="px-3 py-2 text-[var(--muted)]">{row.address || "—"}</td>
                  <td className="px-3 py-2 text-[var(--muted)]">{row.life}</td>
                  <td className="px-3 py-2 text-[var(--muted)]">{row.status}</td>
                  <td className="px-3 py-2">
                    {duplicates.length > 0 && (
                      <span className="flex items-center gap-1 text-[10.5px] font-bold text-[var(--amber-fg)]">
                        <AlertIcon width={11} height={11} />
                        Possible duplicate
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
