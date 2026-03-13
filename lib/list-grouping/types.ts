/**
 * Lightweight grouping metadata for list pages that support grouped views.
 * Answers: "which item field changes when moving between groups?" and
 * "what value to prefill when adding an item from a group?"
 *
 * Use in drag-and-drop: on drop, update item[meta.field] = meta.groupKeyToFieldValue(targetGroupKey).
 * Use when opening "Add item" from a section: prefill that field with meta.groupKeyToFieldValue(currentSectionKey).
 */

/** Config for one grouping mode (e.g. "by category", "by date"). */
export type GroupingModeMeta<GroupKey = string | null, FieldValue = string | null> = {
  /** Stable id for this mode (matches page state, e.g. "category", "date"). */
  modeId: string;
  /** Item field that defines the group (e.g. "category_id", "date", "status"). */
  field: string;
  /**
   * Map UI group key → value to set on the item when dropping into that group or creating from that group.
   * Group key is whatever the section uses (category id, date string, "__no_date__", "todo", "done", etc.).
   */
  groupKeyToFieldValue: (groupKey: GroupKey) => FieldValue;
};

/**
 * Get the field value to use when moving an item to a group or creating an item in a group.
 * Typed helper for use in DnD and add-item flows.
 */
export function getFieldValueForGroup<G, V>(
  meta: GroupingModeMeta<G, V>,
  groupKey: G
): V {
  return meta.groupKeyToFieldValue(groupKey);
}
