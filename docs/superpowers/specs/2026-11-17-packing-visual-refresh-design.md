# Packing list: visual refresh, A2 (design)

Beads issue: away-we-go-nxh.27, under the epic away-we-go-nxh (Packing List Redesign).
Status: approved by the user on 2026-11-17, including the 11 extra interface icons. Written on 2026-11-17.

Approved mockups (private Claude Design canvas): https://claude.ai/artifact/1PWotX1M2UdPHNd4GFLGc4
Copies of the approved boards, kept with this spec as the source of truth for the look and the icon path data:

- `assets/2026-11-17-packing-visual-refresh/mockup-phone.dc.html` (board "A2 · One accent, hand-drawn icons")
- `assets/2026-11-17-packing-visual-refresh/mockup-desktop.dc.html` (board "A2 · Desktop")
- `assets/2026-11-17-packing-visual-refresh/icons-v2.dc.html` (board "Hand-drawn icons v2")

## Intent

The packing page works, but the user finds it plain and dated, and hard to read at a glance: it is not obvious what is packed and what is left. The goal is a younger, fresher look built on Away We Go's own warm style (coral `#E07A5F` on cream), not a new brand. The page must read well with Hebrew and English item names mixed together, on a phone and on a computer.

This is the first page of a wider refresh. The trips list and other lists will follow in the same style later, so the shared pieces (font, icons, colors) are built to be reused.

## Goals

- The page looks like the approved A2 mockups on phone and desktop.
- At a glance you can see how much is packed and what is left: a progress card with the % packed and "N left to pack", plus a progress bar and "done/total" count on each category.
- Packed items are hidden by default. One list-wide checkbox, "Show packed items (N)", shows them again in place, faded and crossed out.
- Adding is easy to find: a prominent "Add item" button, "From usual stuff" beside it, and a "+" on every category.
- Hebrew and English names sit in the same row layout and both read correctly.
- Hand-drawn icons replace today's Lucide category icons everywhere in the app, and the set grows by 16 new category icons.
- Rubik replaces Inter as the app font everywhere.

## Non-goals

- No database change. Category icons are stored as free text keys, so the new keys need no migration.
- No change to how items, categories, assignees, sort order, sharing or "usual stuff" behave, except where this spec says so.
- No translation of the interface. It stays English; only item and category names may be Hebrew (decision 2).
- No redesign of other pages yet (trips list, budget, places). They only get the new font and the new icons (category and interface icons, decision 20).
- "Save list to my usual stuff" is not part of this work. It was removed from the design and filed as backlog idea away-we-go-vn0.

## Anti-goals

- No rainbow: there is one accent color (coral). Categories are told apart by their icons, not by colors (decision 5).
- No feature people use today may disappear: delete all items, manage categories, from usual stuff, drag to reorder, share, edit and delete per item, and add to my usual stuff must all still be reachable.
- No whole-list right-to-left flip that makes the layout jump when items change (decision 10).

## Decisions made by the user

1. **Scope.** The packing list first; other lists later in the same style.
2. **Hebrew.** Hebrew content with an English interface. No language switch.
3. **What to fix.** The page looks plain and dated, and it is hard to see what is packed and what is left. Mobile ergonomics were not raised as a problem.
4. **Direction.** Direction A ("Warm Pop"), refined as A2.
5. **Fewer colors.** One coral accent. Categories use hand-drawn icons instead of colors.
6. **Checkboxes.** Square with rounded corners, not round. Checked = coral fill with a hand-drawn white tick.
7. **Show packed.** One list-wide "Show packed items (N)" checkbox instead of a show/hide toggle per category. When off, packed items are hidden; a category whose items are all packed shows "All packed". When on, packed items appear in place, faded and crossed out. The checkbox sits at the bottom of the list, below all the cards, on the phone and on desktop, and shows only when at least one item is packed or it is on (see decision 21).
8. **Adding.** "Add item" is the main coral button. "From usual stuff" sits beside it. Every category header has a "+" that adds straight into that category. On the phone both buttons sit side by side directly below the progress card, above the By category / By person switch. On desktop the toolbar above the list has the search box on the left and "Add item", "From my usual stuff" and the "⋯" menu on the right (see decision 21).
9. **List actions.** A "⋯" menu holds "Manage categories" and "Delete all items…" (red, with today's confirm step). On the phone it sits next to Share at the top right; on desktop it sits at the end of the toolbar.
10. **Hebrew rows.** Every row keeps the same layout, checkbox on the left. Hebrew names read right to left but are left-aligned, so every name starts at the same edge. This replaces today's whole-list right-to-left flip.
11. **Edit and delete.** On the phone, tapping an item's name opens its editor (name, quantity, category, person, "Add to my usual stuff", and a red Delete at the bottom). On desktop, a hand-drawn pencil and trash appear when you hover over a row (or focus it with the keyboard).
12. **Drag to reorder** stays, including moving items between categories and people under today's rules. On desktop a hand-drawn grip appears on row hover. On the phone you press and hold a row to pick it up; a short tap still opens the editor.
13. **Font.** Rubik replaces Inter for the whole app, with the Hebrew subset.
14. **Icons.** The hand-drawn set v2 (thin 1.2 line) is approved: today's 32 category icons redrawn, 16 new category icons, and 12 interface icons. They replace the Lucide icons in budget and places too, not only packing.
15. **Trip header.** The shared trip header (cover photo, back button, avatars) stays above the packing page, unchanged. The new page starts below it, so the mockup's own small "trip name · dates" line and back link are dropped where the shared header already shows them. The page background around the packing content uses the mockup cream (`#FFF8F2`) inside the packing page only; the shared page shell is not changed.
16. **Person sub-headers inside a category** (shipped 2026-11-16) stay, restyled to match A2, under the same rules as today. Rows show no person tag when sub-headers are on. When sub-headers are off (every item has the same assignee), rows show no person tag either, since there is only one person.
17. **"Who" filter chips** stay, as a scrollable row of pill chips under the By category / By person switch, restyled to A2 (coral for the selected chip, neutral for the rest).
18. **Collapsing a category** stays: tapping the category's icon or name collapses or expands it, remembered per trip as today. The "+" button still adds an item and never collapses.
19. **Ticking while packed items are hidden.** A ticked item stays visible for 4 seconds, crossed out, then fades away. Tapping it again within those 4 seconds un-ticks it and it stays. The counts and progress update at once when it's ticked.
20. **Interface icons everywhere.** All Lucide icons in the app are replaced by hand-drawn ones now, not only on packing. That includes the 11 extra interface icons drawn on 2026-11-17 for the sidebar and other pages (chevron down/up/left, menu, checklist, notes, photos, overview, link, map, wallet). They were approved by the user on 2026-11-17 (canvas board "Hand-drawn icons v2", last group). After this change, `lucide-react` is no longer imported anywhere and can be removed from `package.json`.
21. **Toolbar and Show packed, after the first build (2026-11-17).** Desktop feedback after the first build: buttons crowded the toolbar, so add buttons moved right and Show packed moved to the bottom (phone and desktop).

## The page, as approved

Order of the phone page, top to bottom:

1. Header: trip name and dates (small), "Packing" title with a hand-drawn coral underline, and on the right a Share button and the "⋯" menu.
2. Progress card: coral card with a ring showing the % packed, "N left to pack", and "X of Y packed".
3. "Add item" (coral, wide) and "From usual stuff" (white with a border), side by side.
4. By category / By person switch.
5. Category cards: white, rounded, soft shadow. Header = icon tile (cream tile, hand-drawn icon), name, "done/total", a thin coral progress bar, and a "+" button. Then the item rows.
6. Item row: square checkbox, name, "×N" pill when quantity is more than 1, and who it belongs to.
7. "Show packed items (N)" checkbox, last, below all the cards.

Desktop (and any wide window): a left column with the back link, title, progress card, "Who's packing" card (each person's packed/total with a small bar), and Share. On the right: a toolbar (search box on the left; Add item, From my usual stuff and "⋯" on the right), then the By category / By person switch, then the category cards in a grid of at least two columns, and the "Show packed items" checkbox below the cards. On a narrow window the left column moves above the cards.

Colors, sizes and spacing follow the mockup files. Text colors were chosen to pass 4.5:1 contrast; keep them.

## Calls I made (to check while reading)

- **By person view** was not drawn. It uses the same card and row style: the card header shows the person (photo or initial) instead of a category icon, with the same "done/total", progress bar and "+" (which adds an item already assigned to that person). The category sub-headers inside a person card stay as they are today, restyled.
- **Search** ("Find an item") is on desktop only, as drawn, and filters rows by name as you type. It is new. If it adds noticeable work, it can move to a follow-up.
- **Who's packing** card on desktop is new and uses data the page already has.
- **The editor** opens as a dialog (a bottom sheet on the phone) for both tap-to-edit on the phone and the pencil on desktop, replacing today's inline row editor. It reuses today's fields and save logic.
- **The "⋯" menu** opens the existing dialogs: Manage categories opens today's dialog; "Delete all items…" opens today's manage-list dialog straight on its delete confirmation.
- **"+" on a category** opens today's add-item dialog with that category preselected.
- **Hand-drawn look in code.** Icons are React components built from the path data in `icons-v2.dc.html`, with stroke 1.2 at their designed size. The slight roughness in the mockup comes from an SVG displacement filter; the builder may keep the filter (one shared definition) or bake the wobble into the paths, as long as the result matches the approved sheet.
- **Read-only viewers** (people who can view the trip but not edit it) see the same page without the add buttons, "+", "⋯", checkboxes that toggle, edit, delete and drag, as today.
- **Mockup leftovers:** the "⋯" menu in the mockup files still shows "Save list to my usual stuff". Ignore it; it was removed (see Non-goals).
- **Empty list:** the progress card is replaced by a friendly empty state ("Nothing packed yet. Add your first item.") with the two add buttons.

- **Hand-coded SVG icons** (inline `<svg>` written directly in components, not from Lucide) on pages other than packing stay as they are until those pages are redesigned. Decision 20 covers Lucide icons only.
- **Collapsed category with packed items shown:** collapsing hides all its rows, packed or not, as today.

## Constraints

- Next.js 14 app router, React 18, Tailwind 4, `@dnd-kit` for drag and drop. Fonts load with `next/font/google`.
- `components/ui/category-icons.tsx` is the single place that maps icon keys to icons (`CategoryIcon`, `CategoryIconPicker`, `getIconKey`, legacy and emoji mappings). New keys are added there; old keys keep working.
- `components/packing/packing-list.tsx` (about 1,500 lines) holds the page logic, drag rules, person sub-groups, filters and share text. Its behavior must be kept unless this spec changes it.
- There is no unit-test runner. Past work was checked with `npx tsc --noEmit -p .` and in a browser. Do not run `next build` or `next dev` in the main checkout.
- Touch targets at least 44 px on the phone. Keyboard users must reach every action (hover-only controls also show on focus).

## Left to the builder

- How to split `packing-list.tsx` and `packing-item-row.tsx` into components.
- Exact implementation of the progress ring, the bottom sheet and the menu, as long as they match the mockups and are accessible.
- Whether the shared colors become Tailwind theme tokens or shared class constants.
