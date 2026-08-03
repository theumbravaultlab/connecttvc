import { ageMatchesRange } from "./ageRange";
import { DAY_LONG, type Group, type Party } from "./types";

export interface MatchChecklistItem {
  key: "day" | "city" | "life" | "age" | "childcare";
  label: string;
  met: boolean;
}

/** Every criterion the Finder matches on, evaluated for one specific
 * group against one specific party's actual data — independent of
 * whichever "matched on" chips are currently toggled active/inactive, so
 * this always shows the real picture rather than just what's currently
 * being enforced. Age/childcare are omitted when the party hasn't stated
 * one (no age on file, doesn't need childcare), day is omitted when the
 * party hasn't stated any available days — same "only show what's
 * actually meaningful for this party" rule the "matched on" chips already
 * follow. Labels always show the group's own value (not the party's
 * request) so a mismatch reveals what the group actually offers instead
 * of just repeating what was searched for. */
export function buildMatchChecklist(party: Party, group: Group): MatchChecklistItem[] {
  const items: MatchChecklistItem[] = [];

  if (party.days.length > 0) {
    items.push({
      key: "day",
      label: `Day: ${DAY_LONG[group.day] ?? group.day}`,
      met: party.days.includes(group.day),
    });
  }

  if (party.area) {
    items.push({ key: "city", label: group.area || "No city on file", met: group.area === party.area });
  }

  if (party.life) {
    items.push({ key: "life", label: group.life, met: group.life === party.life });
  }

  if (party.age != null) {
    items.push({
      key: "age",
      label: `Age: ${party.age}`,
      met: ageMatchesRange(party.age, group.ageRange),
    });
  }

  if (party.childcareNeeded) {
    items.push({
      key: "childcare",
      label: group.childcare ? "Has Childcare" : "No Childcare",
      met: group.childcare,
    });
  }

  return items;
}
