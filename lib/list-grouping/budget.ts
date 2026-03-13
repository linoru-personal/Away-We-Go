import type { GroupingModeMeta } from "./types";

/** Budget list view mode (matches BudgetPage listView state). */
export type BudgetListViewMode = "category" | "date";

/** Group key in category view: category id or null for uncategorized. */
export type BudgetCategoryGroupKey = string | null;

/** Group key in date view: ISO date string or "__no_date__" for the "No date" section. */
export type BudgetDateGroupKey = string;

const categoryMode: GroupingModeMeta<BudgetCategoryGroupKey, string | null> = {
  modeId: "category",
  field: "category_id",
  groupKeyToFieldValue: (key) => key,
};

const dateMode: GroupingModeMeta<BudgetDateGroupKey, string | null> = {
  modeId: "date",
  field: "date",
  groupKeyToFieldValue: (key) => (key === "__no_date__" ? null : key),
};

/** Grouping metadata for the budget page. Keyed by list view mode. */
export const BUDGET_GROUPING = {
  category: categoryMode,
  date: dateMode,
} as const;

/** Get the grouping config for the current budget list view. */
export function getBudgetGroupingMode(listView: BudgetListViewMode) {
  return BUDGET_GROUPING[listView];
}
