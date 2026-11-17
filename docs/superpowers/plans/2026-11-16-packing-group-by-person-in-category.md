# Packing list: group by person inside each category — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In By category view, show each category's items under person sub-headers (Everyone first) whenever the page has two or more distinct assignees, with drag and WhatsApp-share rules that never change who an item is assigned to.

**Architecture:** One pure helper module decides the page-wide rule and splits a category's items into person blocks. The By category list stays ONE sortable group per category (a flat list ordered by person blocks), and a sub-header row is rendered before the first item of each block, exactly the way By person view renders its category sub-headers today. Drag handlers are wrapped so a reorder is applied only inside one person's block, and cross-category moves keep the assignee. The share-text builder nests by person using the same helper.

**Tech Stack:** Next.js 14, React, TypeScript, dnd-kit (through `components/ui/grouped-sortable-list.tsx`), Supabase (no change).

**Spec:** `docs/superpowers/specs/2026-11-16-packing-group-by-person-in-category-design.md` (approved by the user on 2026-11-16). Beads issue `away-we-go-nxh.24`.

## Global Constraints

- No database or migration change. Items keep one assignee. Sort order stays per category.
- Never reassign an item by dragging. No silent "Everyone".
- Rule: person sub-headers show in EVERY category when the trip's items (all items, not the filtered ones) have two or more distinct assignees, where "no assignee" (Everyone) counts as one. Otherwise the By category view must look and behave exactly as it does today.
- Person order: Everyone first, then participants in the order of the `participants` prop. A person with no items in a category has no sub-header there.
- By person view and the "who" filter chips must not change.
- Source files use CRLF line endings. Use the Edit tool for exact replacements, never whole-file shell rewrites.
- Do not run `next build` or `next dev` in the main checkout. Verify with `npx tsc --noEmit -p .` (must be clean). The project has no unit-test runner for `lib/`, so behaviour is verified by the controller in a browser after the tasks.
- Do not connect to any database. Never read or print `.env` files.
- Commit messages in plain prose, conventional style, ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- One person on the whole page: the view and the share text are unchanged (no sub-headers).
- Filter chip set to one person: sub-headers stay (the rule uses all items), and the layout does not jump when switching chips.
- A category where one person has no items shows no empty sub-header for them.
- A drop inside the SAME category onto another person's block leaves the list exactly as before and does not call the save functions. A drop into a DIFFERENT category always moves the item there and keeps its assignee, even when that person has no group in the target yet.
- Items with a Hebrew/RTL title or person name: the sub-header and share text keep the existing direction handling (`dir`, `personTag` marks are not needed once the tag is gone, but the sub-header line must not be mirrored).

---

### Task 1: Person-block helper and nested share text

**Files:**
- Create: `lib/packing/person-groups.ts`
- Modify: `lib/packing/share-text.ts` (the `viewMode === "category"` branch of `buildPackingShareText`)

**Interfaces:**
- Produces, in `lib/packing/person-groups.ts`:
  - `export type PersonBlock = { participantId: string | null; label: string; items: PackingItem[] }`
  - `export function hasMultipleAssignees(items: PackingItem[]): boolean` — true when `items` contain two or more distinct values of `assigned_to_participant_id ?? null`.
  - `export function splitByPerson(items: PackingItem[], participants: PackingParticipant[]): PersonBlock[]` — blocks in the order Everyone (label `"Everyone"`, `participantId: null`) then each participant in `participants` order; blocks with no items are omitted; items inside a block keep their input order. Items assigned to a participant id that is not in `participants` must not be lost and must never be folded into Everyone (no silent Everyone): append one extra block per unknown id, labelled `"Unknown"`, with `participantId` set to that id, after the participant blocks.
- Types `PackingItem` and `PackingParticipant` come from `@/components/packing/packing-list` (as `share-text.ts` already imports them).

- [ ] **Step 1: Create `lib/packing/person-groups.ts`** with the three exports above, following the signatures and ordering rules exactly. Pure functions, no React.

- [ ] **Step 2: Nest the share text.** In `buildPackingShareText`, in the `viewMode === "category"` branch: compute `const nested = hasMultipleAssignees(items)` from ALL trip `items` (not `filtered`). When `nested` is false, keep today's code path unchanged. When `nested` is true, for each category with items in `sorted`/`filtered`, output `*Category*`, then for each block from `splitByPerson(list, participants)` the line `_PersonLabel_` followed by that block's items using `itemLine(i, null)` (no person tag). The `showPerson`/tag logic is not used on the nested path. By person view's branch and the title/summary logic are unchanged.

- [ ] **Step 3: Typecheck.** Run `npx tsc --noEmit -p .`. Expected: no output.

- [ ] **Step 4: Commit** `feat(packing): add person-block helper and nest the share text by person in category view`.

---

### Task 2: Person sub-headers and drag rules in By category view

**Files:**
- Modify: `components/packing/packing-list.tsx` (the `itemsByCategory` memo around line 266, the By category blocks around lines 1179 to 1236, and a new sub-header renderer next to `renderPersonCategorySubHeader` around line 794)

**Interfaces:**
- Consumes: `hasMultipleAssignees`, `splitByPerson`, `PersonBlock` from Task 1. Existing props `onReorderGroup(newOrderedItems)` and `onMoveItem("category", item, fromGroupKey, toGroupKey, insertIndex)` and their page-level behaviour in `app/dashboard/trip/[id]/packing/page.tsx` stay unchanged: `onReorderGroup` already accepts a SUBSET of a category's items and puts them back into the slots they occupied; `onMoveItem` in category view inserts the item into the target category's whole order at `insertIndex`.

- [ ] **Step 1: Page-wide flag and ordered items.** Add `const showPersonGroups = useMemo(() => hasMultipleAssignees(items), [items])` (all items, not `filteredItems`). Change `itemsByCategory` so that when `showPersonGroups` is true each entry's `items` is `splitByPerson(catItems, participants).flatMap(b => b.items)` and the entry also carries `blocks: PersonBlock[]`; when false the memo's output is unchanged. Add a memo `personBlockStarts: Map<string, PersonBlock>` mapping the id of the first item of every block (in every category entry) to its block. When `showPersonGroups` is false the map is empty.

- [ ] **Step 2: Sub-header row.** Add `renderPersonBlockSubHeader(block: PersonBlock, categoryId: string)` returning `null` when `collapsedGroups.has(categoryId)`, else an `<li>` with the SAME classes and `dir` handling as `renderPersonCategorySubHeader` showing `block.label`. In every By category rendering path (the `GroupedSortableList` path, the `SortableGroupList` path, and the read-only path) render this sub-header before the row of each item that is in `personBlockStarts`, using a `Fragment` with a stable key, the way the By person paths already do with `personCategoryStarts`. When `showPersonGroups` is true, pass an empty string instead of `getAssigneeLabel(item, participants)` as the row's meta label in By category view (the sub-header now says whose item it is). Verify in `components/packing/packing-item-row.tsx` that an empty label renders no stray separator or empty element, and fix it there if it does.

- [ ] **Step 3: Reorder rule.** Replace `onReorder={(_groupKey, newOrderedItems) => onReorderGroup(newOrderedItems)}` in the By category `GroupedSortableList` with a handler that, when `showPersonGroups` is false, behaves exactly as today, and when true does the following with the category's current ordered `items` (the displayed flat list) and `newOrderedItems` (the list after the drop): if the assignee (`assigned_to_participant_id ?? null`) found at each index differs between the two lists, the drop crossed into another person's block: do nothing (return without calling `onReorderGroup`). Otherwise find the moved person's block, and call `onReorderGroup` with only that person's items in their new relative order. The same rule must apply to the `SortableGroupList` path's `onReorder`.

- [ ] **Step 4: Move rule.** In the By category `onMove` (a drop into a DIFFERENT category), when `showPersonGroups` is true and the item's assignee is `A`: the item always moves to the target category and keeps its assignee, wherever it is dropped, and is never rejected. Its place is decided by `A`'s block in the target: if `insertIndex` points at an item whose assignee is `A`, keep today's anchor logic (insert before that item). Otherwise (the drop is on another person's row, on the empty area, or at the end of the list) place it after the last item of `A`'s block in the target category's whole saved order, or at the end of the category's order when `A` has no items there yet (a new sub-header for `A` then appears). Compute positions against the whole category order (`items`), not only the displayed items. When `showPersonGroups` is false the handler is unchanged.

- [ ] **Step 5: Typecheck.** Run `npx tsc --noEmit -p .`. Expected: no output.

- [ ] **Step 6: Commit** `feat(packing): group items by person inside each category in By category view`.

---

## Verification (controller, after Task 2)

In a browser against the local Supabase (needs the user's OK first, as before): a trip with items for Everyone, Noa and Dan across two categories shows sub-headers in both categories; a trip with only Everyone items looks unchanged; reorder inside a block persists after reload; dropping into another person's block in the same category snaps back; dragging to another category (including onto another person's row, or into a category where that person has no group yet) moves the item there and keeps the assignee; the WhatsApp text matches the screen, with no `(Name)` after items; no horizontal scroll at 390px wide.
