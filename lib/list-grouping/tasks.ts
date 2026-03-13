import type { GroupingModeMeta } from "./types";

/** Tasks section key: "todo" | "done" (matches TaskStatus). */
export type TasksSectionKey = "todo" | "done";

/**
 * Tasks have a single logical grouping: by status (To do / Completed).
 * There is no view toggle; both sections are always visible.
 */
const statusMode: GroupingModeMeta<TasksSectionKey, TasksSectionKey> = {
  modeId: "status",
  field: "status",
  groupKeyToFieldValue: (key) => key,
};

/** Grouping metadata for the tasks page. */
export const TASKS_GROUPING = {
  status: statusMode,
} as const;

/** Get the grouping config for tasks (always status). */
export function getTasksGroupingMode(): GroupingModeMeta<TasksSectionKey, TasksSectionKey> {
  return TASKS_GROUPING.status;
}
