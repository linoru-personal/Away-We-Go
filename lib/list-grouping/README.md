# List grouping metadata

Page-level config that tells the UI **which item field** to update when moving an item between groups, and **what value** to prefill when adding an item from a group. No visual or behavioral changes—only a typed metadata layer for future drag-and-drop and add-from-section flows.

## Per-page summary

| Page    | Modes / grouping        | Field to update              | Group key → value |
|---------|--------------------------|-----------------------------|--------------------------------|
| Budget  | `category`, `date`       | `category_id`, `date`       | Category: key as-is. Date: `"__no_date__"` → `null`. |
| Packing | `category`, `participant`| `category_id`, `assigned_to_participant_id` | Category: key. Participant: key (null = Everyone). |
| Tasks   | status (todo/done)       | `status`                    | `"todo"` / `"done"` as-is. |
| Places  | category only            | `category_id`               | Key as-is (null = General). |

## Using this in drag-and-drop

1. **Resolve the current mode** from page state (e.g. `listView` on budget, `viewMode` on packing).
2. **Get the mode config**:  
   `const meta = getBudgetGroupingMode(listView)` (or `getPackingGroupingMode(viewMode)`, etc.).
3. **On drop** (item moved into a section):  
   - The section is identified by a **group key** (e.g. category id, `"__no_date__"`, `"todo"`, participant id or `null`).
   - Update the item: set `item[meta.field] = meta.groupKeyToFieldValue(targetGroupKey)` (then persist to Supabase).
4. **Section key**: Use the same key you use for the section’s `key` or drop target (e.g. `group.category?.id ?? null`, `group.dateKey`, `"todo"` / `"done"`, `participantId`).

## Using this when adding from a group

1. When opening “Add item” from a specific section, you have that section’s **group key**.
2. Get the mode config (as above).
3. **Prefill** the create form: set the field `meta.field` to `meta.groupKeyToFieldValue(sectionGroupKey)` (e.g. prefill category id, date, status, or assignee).

## Imports

```ts
import {
  getBudgetGroupingMode,
  getPackingGroupingMode,
  getTasksGroupingMode,
  getPlacesGroupingMode,
  getFieldValueForGroup,
} from "@/lib/list-grouping";
```

Use `getFieldValueForGroup(meta, groupKey)` if you want a single helper call instead of `meta.groupKeyToFieldValue(groupKey)`.

## Cross-group drag-and-drop (future)

Right now each group uses its own `DndContext` (e.g. in `SortableGroupList`), so drag is limited to one group. To support moving items **between** groups:

1. Use a **single** `DndContext` for the whole list (or page).
2. Make each group a **droppable** (e.g. `useDroppable({ id: groupKey })`) and keep items **sortable** within a shared `SortableContext` or use draggable + droppable semantics.
3. On drag end: if `over` is a different group, set `item[meta.field] = meta.groupKeyToFieldValue(over.id)` (the group key), then re-run sort_order assignment for both source and target groups and persist.
4. The grouping metadata (`getBudgetGroupingMode`, etc.) already answers which `field` to update and how to turn a group key into the value; the cross-group handler only needs to call that and then persist.

## Edge cases (cross-group move)

- **Same-group drop:** If the item is dropped on its own group (e.g. on the group droppable or on another item in the same group), the implementation treats it as reorder-only (no field change). Drop on another item in the same group → reorder; drop on same group’s empty zone → no-op (or append); drop on another group → move.
- **Empty destination group:** Dropping on an empty group is supported (droppable id = `group:{groupKey}`); `insertIndex` is 0.
- **Participant "Everyone":** The UI group key for unassigned is `PACKING_GROUP_KEY_EVERYONE` (`"__everyone__"`); `groupKeyToFieldValue("__everyone__")` returns `null` for the participant field so the item is unassigned.
- **Ordering:** After a move, both source and destination groups get new `sort_order` values (global 0..N-1) so that list order stays correct; only items in the two affected groups are updated in the DB.
