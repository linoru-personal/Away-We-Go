import type { GroupingModeMeta } from "./types";

/** Places list: single grouping by category. Group key = category id or null for "General". */
export type PlacesCategoryGroupKey = string | null;

const categoryMode: GroupingModeMeta<PlacesCategoryGroupKey, string | null> = {
  modeId: "category",
  field: "category_id",
  groupKeyToFieldValue: (key) => key,
};

/** Grouping metadata for the places page (always by category). */
export const PLACES_GROUPING = {
  category: categoryMode,
} as const;

/** Get the grouping config for places (always category). */
export function getPlacesGroupingMode(): GroupingModeMeta<
  PlacesCategoryGroupKey,
  string | null
> {
  return PLACES_GROUPING.category;
}
