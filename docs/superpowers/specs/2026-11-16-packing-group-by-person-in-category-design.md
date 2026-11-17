# Packing list: group by person inside each category (design)

Beads issue: away-we-go-nxh.24, under the epic away-we-go-nxh (Packing List Redesign).
Status: draft, waiting for the user's approval. Written on 2026-11-16.

## Intent

The packing page has two views. In "By person", each person's card shows category sub-headers. In "By category", each category shows one flat list of items. The user asked (2026-11-10) for By category to mirror By person: inside each category, items are grouped under a sub-header per person, with Everyone first. The goal is that, looking at one category such as Clothes, you can see at a glance whose items are whose.

## Goals

- In By category view, items inside each category are grouped under person sub-headers, Everyone first, then the participants in the same order By person view uses.
- Drag and drop keeps working, with clear rules that cannot change who is responsible for an item by accident.
- The WhatsApp share text, when shared from By category view, has the same grouping as the screen.

## Non-goals

- No change to By person view.
- No database change. Items still have one assignee, and sort order is still stored per category.
- No change to how items are assigned, edited, added or deleted.
- No collapsing of person sub-groups (categories already collapse).

## Anti-goals

- Dragging must never silently reassign an item to another person. This follows the project rule "no silent Everyone".
- A simple list (everyone's items assigned to the same person, or all shared) must look exactly as it does today, with no extra noise.

## Decisions made by the user

1. **Drag-reorder.** An item can be reordered only inside its own person's sub-group within a category. Dropping an item into another person's sub-group is not allowed, so there is no reassignment by dragging. Reassigning stays in the item edit dialog. A reorder inside one sub-group changes only the positions of that person's items among their own slots in the category's saved order, so no schema change is needed.
2. **Share text.** When the list is shared from By category view, each category nests its items by person (Everyone first), matching the screen.
3. **When sub-headers appear.** The decision is made for the whole page, not per category. If the page has two or more distinct assignees (Everyone counts as one), sub-headers appear in every category, including categories that contain a single person. If every item on the page has the same assignee, no sub-headers are shown, and the page looks as it does today.

## Calls I made (to check while reading)

- **Which items decide rule 3.** The rule uses all items on the trip, not only the items left visible by the "who" filter chips. Reason: the layout should not jump around when you switch the filter. Cost if wrong: with a filter on a single person, each category shows one sub-header with that person's name, which is slightly redundant.
- **Order of people.** Everyone first, then participants in the same order By person view uses.
- **Empty groups.** A person with no items in a category gets no sub-header in that category.
- **Dragging between categories.** (Corrected on 2026-11-16 at the user's request.) Dragging an item into another category always moves it there and it keeps its assignee, wherever it is dropped. It appears in its own person's sub-group of the target category, and if that person has no group there yet, a new one appears. Only a drop inside the same category onto another person's group is refused, because that would look like a reassignment.
- **Sub-header look.** Copy the look of the category sub-headers inside a person card in By person view, so the two views feel like mirror images.

## Share text details

The existing builder is `buildPackingShareText` in `lib/packing/share-text.ts`. From By category view with sub-headers on (rule 3), each category prints its name, then for each person group the person's name and that person's items. When sub-headers are off, the text stays exactly as it is today. By person view's share text is unchanged.

## Acceptance criteria

- With two or more distinct assignees on the page, every category in By category view shows person sub-headers, Everyone first. With one assignee on the page, the view is unchanged.
- Items can be reordered inside a person's sub-group, and the new order survives a reload. Items cannot be dropped into another person's sub-group, and a rejected drop leaves the list unchanged.
- Dragging an item to another category keeps its assignee.
- The share text from By category view matches the on-screen grouping, and is unchanged when sub-headers are off.
- By person view and the "who" filter chips behave as before. No horizontal scroll at 390px wide.

## Files likely involved

- `components/packing/packing-list.tsx`: By category rendering, grouping memos (`itemsByCategory`, `itemsByParticipant`) and the drag handlers.
- `components/ui/grouped-sortable-list.tsx`: shared drag list; each person sub-group becomes its own sortable group, and other users of this component must keep working.
- `lib/packing/share-text.ts`: nested output.
- The new drag-overlay change (commit `4255c11`) must keep working across sub-groups.

## Left to the builder

Group keys and naming, the exact component split, and how the page-wide rule is computed, as long as the decisions above hold.
