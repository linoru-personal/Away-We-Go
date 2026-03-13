/**
 * List grouping metadata: which item field defines the group and how to map
 * UI group keys to field values for move/create. Use in DnD and add-item flows.
 */

export type { GroupingModeMeta } from "./types";
export { getFieldValueForGroup } from "./types";

export {
  BUDGET_GROUPING,
  getBudgetGroupingMode,
  type BudgetListViewMode,
  type BudgetCategoryGroupKey,
  type BudgetDateGroupKey,
} from "./budget";

export {
  PACKING_GROUPING,
  PACKING_GROUP_KEY_EVERYONE,
  getPackingGroupingMode,
  type PackingViewMode,
  type PackingCategoryGroupKey,
  type PackingParticipantGroupKey,
} from "./packing";

export {
  TASKS_GROUPING,
  getTasksGroupingMode,
  type TasksSectionKey,
} from "./tasks";

export {
  PLACES_GROUPING,
  getPlacesGroupingMode,
  type PlacesCategoryGroupKey,
} from "./places";
