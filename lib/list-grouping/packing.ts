import type { GroupingModeMeta } from "./types";

/** Packing list view mode (matches PackingList viewMode state). */
export type PackingViewMode = "category" | "participant";

/** Group key in category view: category id (required for packing items). */
export type PackingCategoryGroupKey = string;

/** Group key in participant view: participant id or null for "Everyone". */
export type PackingParticipantGroupKey = string | null;

const categoryMode: GroupingModeMeta<PackingCategoryGroupKey, string> = {
  modeId: "category",
  field: "category_id",
  groupKeyToFieldValue: (key) => key,
};

/** UI group key for "Everyone" (participant null). Use in droppable ids; groupKeyToFieldValue maps it to null. */
export const PACKING_GROUP_KEY_EVERYONE = "__everyone__";

const participantMode: GroupingModeMeta<PackingParticipantGroupKey, string | null> = {
  modeId: "participant",
  field: "assigned_to_participant_id",
  groupKeyToFieldValue: (key) => (key === PACKING_GROUP_KEY_EVERYONE ? null : key),
};

/** Grouping metadata for the packing page. Keyed by view mode. */
export const PACKING_GROUPING = {
  category: categoryMode,
  participant: participantMode,
} as const;

/** Get the grouping config for the current packing view mode. */
export function getPackingGroupingMode(viewMode: PackingViewMode) {
  return PACKING_GROUPING[viewMode];
}
