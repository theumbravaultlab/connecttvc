import { formatDateTime as formatWhen } from "@/lib/format";

/** Read-only "who made this and when" footer for a Group/Party edit page.
 * createdAt/createdBy are set once, on insert; updatedBy refreshes on
 * every save (see groupToRow/partyToRow's `audit` param in actions.ts).
 * Either line is omitted entirely if its timestamp is missing — a
 * brand-new, not-yet-saved record has neither. */
export function AdminFooter({
  createdAt,
  createdBy,
  updatedAt,
  updatedBy,
}: {
  createdAt?: string;
  createdBy?: string | null;
  updatedAt?: string;
  updatedBy?: string | null;
}) {
  if (!createdAt && !updatedAt) {
    return (
      <p className="text-[12.5px] font-semibold text-[var(--faint)]">
        Not saved yet — record info appears after the first save.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1 text-[12.5px] font-semibold text-[var(--faint)]">
      {createdAt && (
        <p>
          Created {formatWhen(createdAt)}
          {createdBy ? ` by ${createdBy}` : ""}
        </p>
      )}
      {updatedAt && (
        <p>
          Last updated {formatWhen(updatedAt)}
          {updatedBy ? ` by ${updatedBy}` : ""}
        </p>
      )}
    </div>
  );
}
