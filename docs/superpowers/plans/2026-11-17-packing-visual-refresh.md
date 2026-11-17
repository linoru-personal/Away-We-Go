# Packing List Visual Refresh (A2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the packing page in the approved A2 look (one coral accent, hand-drawn icons, square checkboxes, progress card, list-wide "Show packed"), switch the app font to Rubik, and replace every Lucide icon in the app with the approved hand-drawn set.

**Architecture:** A new hand-drawn icon module becomes the only icon source (`CategoryIcon` keeps its API and renders from it). The packing page keeps its data logic, drag rules and dialogs in `packing-list.tsx`; the look moves into small presentational components (header, progress card, toolbar, group card, row, editor dialog). One small pure helper decides which rows are visible (show-packed + 4-second linger).

**Tech Stack:** Next.js 14 (app router), React 18, TypeScript, Tailwind 4, `@dnd-kit`, `next/font/google`, Supabase client.

**Spec:** `docs/superpowers/specs/2026-11-17-packing-visual-refresh-design.md` (approved 2026-11-17). Look and icon path data: `docs/superpowers/specs/assets/2026-11-17-packing-visual-refresh/` (`mockup-phone.dc.html`, `mockup-desktop.dc.html`, `icons-v2.dc.html`). Read both before starting any task.

## Global Constraints

- Work on branch `feature/packing-visual-refresh`. Commit after each task (local commits on this branch are approved with this plan). Do not push, merge or deploy.
- Do not run `next build` or `next dev` in the main checkout. There is no unit-test runner. Every task is verified with `npx tsc --noEmit -p .` (no output) and `npx eslint <changed files>` (no errors), then the user checks the listed behavior in a browser after the branch is pushed with their approval.
- No database change. Category icons stay free-text keys; old keys, legacy keys and emoji keep resolving through `getIconKey`.
- One accent color: coral `#E07A5F` (fills, bars, checked boxes, primary button). Text on coral: `#2B1610`. Dark coral for text/links: `#A9432C`. Cream page `#FFF8F2`, card white `#FFFFFF`, icon tile `#FBF1E9`, soft lines `#F6EEE7`, track `#F5EAE0`, text `#2E2A27`, secondary text `#6B5B50`, muted `#7A6A5E`, unchecked box border `#D9C3B3`, danger `#B42318`.
- Checkbox: square, radius 8px (7px on desktop 24px box), 26px on phone / 24px on desktop, inside a 44px (phone) / 40px (desktop) tap target. Checked = coral fill + white hand-drawn `check` icon.
- Interface copy is English. Item and category names may be Hebrew. Rows never flip direction: checkbox on the left; names use `dir="auto"`, `unicode-bidi: plaintext`, `text-align: left`.
- Touch targets at least 44px on the phone. Hover-only controls also appear on `:focus-within`.
- Font: Rubik, subsets `latin` and `hebrew`, weights 400, 500, 600, 700, 800, everywhere.
- Hand-drawn icons: stroke round caps and joins, `fill="none"`, approved line weight 1.2 at 32px. Render with `strokeWidth = (1.2 * 32) / size` so the line looks the same at every size, and the shared roughness filter `url(#awg-rough)`.
- "Save list to my usual stuff" is not built, even though the mockup menu shows it.

## Review Focus

1. **Quick ticks while packed items are hidden.** Ticking several items within seconds keeps each visible for its own 4 seconds; re-ticking one within its 4 seconds un-ticks it and it stays; turning "Show packed" on or leaving the page clears all timers with no error. Covered in Task 6.
2. **Reordering with packed items hidden.** Dragging among the visible rows must not move hidden packed items or lose their saved positions (the page's `onReorderGroup` already merges subsets back; the visible-row helper must keep the same order as today's shown list). Covered in Task 6.
3. **Filter + show packed + collapse together.** With a "who" chip selected and "Show packed" off, a category whose visible items are all packed shows "All packed"; a category with no items for that person is not rendered at all (as today); a collapsed category shows only its header. Covered in Task 6.
4. **Long and mixed-direction names on a 390px screen.** A long Hebrew name with a number ("מטען לטלפון 2") and a "×3" pill wraps onto more lines, never truncates, never overlaps the pill or the checkbox, and starts at the left edge. Covered in Task 4.
5. **Read-only viewers.** No add buttons, no "+", no "⋯", no drag, no edit/delete, checkboxes are not buttons, and "Show packed" and the filter chips still work. Covered in Task 5.

---

### Task 1: Rubik font app-wide

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Produces: CSS variable `--font-rubik` on `<html>`; Tailwind `font-sans` resolves to Rubik.

- [ ] **Step 1:** In `app/layout.tsx` replace `Inter` with `Rubik` from `next/font/google`: `Rubik({ subsets: ["latin", "hebrew"], weight: ["400", "500", "600", "700", "800"], variable: "--font-rubik", display: "swap" })`. Put `rubik.variable` on `<html>` and `font-sans antialiased` on `<body>`.
- [ ] **Step 2:** In `app/globals.css` set `--font-sans: var(--font-rubik), system-ui, sans-serif;` in `@theme inline` and replace the body `font-family: Arial, Helvetica, sans-serif;` with `font-family: var(--font-sans);`.
- [ ] **Step 3:** Run `npx tsc --noEmit -p .` (expected: no output) and `npx eslint app/layout.tsx` (expected: no errors).
- [ ] **Step 4:** Commit: `git commit -m "feat: switch the app font to Rubik with Hebrew support"`.

### Task 2: Hand-drawn icon library and category icons

**Files:**
- Create: `components/ui/hand-drawn-icons.tsx`
- Modify: `components/ui/category-icons.tsx`
- Modify: `app/layout.tsx` (mount the filter once)

**Interfaces:**
- Produces:
  - `export type HandDrawnIconName` = every key below.
  - `export const HAND_DRAWN_PATHS: Record<HandDrawnIconName, readonly string[]>` (1–4 `d` strings per icon).
  - `export function HandDrawnIcon(props: { name: HandDrawnIconName; size?: number /* default 20 */; className?: string; title?: string }): JSX.Element` — 24×24 viewBox, `stroke="currentColor"`, `strokeWidth={(1.2 * 32) / size}`, `filter="url(#awg-rough)"`, `aria-hidden` unless `title` is given (then `role="img"` + `<title>`).
  - `export function HandDrawnFilterDefs(): JSX.Element` — a zero-size `<svg aria-hidden>` holding `<filter id="awg-rough">` with `feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3"` and `feDisplacementMap scale="0.7"`.
  - `CategoryIcon` keeps its props; `CATEGORY_ICON_KEYS` gains 16 keys.

Icon keys and their source names in `icons-v2.dc.html` (copy the path strings exactly):

| Group in the sheet | Keys (source name) |
|---|---|
| Today's 32 | the 32 existing `CATEGORY_ICON_KEYS`, same order (Ticket…Telescope; `utensils`=Utensils, `map_pin`=Map pin, `shopping_bag`=Shopping bag, `money`=Money, `hotel`=Hotel, `building_2`=Building, `landmark`=Landmark, `ferris_wheel`=Ferris wheel, `trees`=Trees, `tree_palm`=Palm tree, `train_front`=Train) |
| Suggested 16 | `passport`, `first_aid`, `toothbrush`, `charger`, `laptop`, `sunglasses`, `shoes`, `backpack`, `baby`, `pet`, `snow`, `sun`, `bike`, `book`, `coffee`, `music` |
| Interface 12 | `add`, `check`, `edit`, `delete`, `share`, `search`, `more`, `usual_stuff`, `back`, `open`, `close`, `drag` |
| New interface 11 | `chevron_down`, `chevron_up`, `chevron_left`, `menu`, `checklist`, `notes`, `photos`, `overview`, `link`, `map`, `wallet` |

The sheet builds `Compass`/`Money` from a shared `circle` string and `Ship`/`Waves` from `wave(y)`; expand those into literal strings.

- [ ] **Step 1:** Create `hand-drawn-icons.tsx` with the type, the path record, `HandDrawnIcon` and `HandDrawnFilterDefs` as specified.
- [ ] **Step 2:** In `category-icons.tsx` append the 16 suggested keys to `CATEGORY_ICON_KEYS` (after `telescope`), delete the Lucide imports and `ICON_MAP`, and make `CategoryIcon` render `<HandDrawnIcon name={getIconKey(iconKey, "star")} size={size} className={className} />`. Keep `getIconKey`, `LEGACY_KEY_MAP`, `EMOJI_TO_KEY`, the defaults and `CategoryIconPicker` behavior unchanged (the picker lists the 16 new keys automatically).
- [ ] **Step 3:** Render `<HandDrawnFilterDefs />` once as the first child of `<body>` in `app/layout.tsx`.
- [ ] **Step 4:** Run `npx tsc --noEmit -p .` (no output) and `npx eslint components/ui/hand-drawn-icons.tsx components/ui/category-icons.tsx app/layout.tsx` (no errors).
- [ ] **Step 5:** Browser check (user): `/category-icons-preview` shows 48 hand-drawn icons; budget, places and packing category icons are hand-drawn; an old category saved with an emoji still shows its mapped icon.
- [ ] **Step 6:** Commit: `git commit -m "feat: hand-drawn icon set replaces Lucide category icons"`.

### Task 3: Packing page shell and visual tokens

**Files:**
- Create: `components/packing/packing-styles.ts`
- Modify: `app/dashboard/trip/[id]/packing/page.tsx` (background only)

**Interfaces:**
- Produces from `packing-styles.ts` (Tailwind class strings using the Global Constraints colors): `PACKING_CARD_CLASS` (white, `rounded-[22px]`, shadow `0_2px_10px_rgba(120,70,40,0.06)`, `overflow-hidden`), `PACKING_ICON_TILE_CLASS` (42px phone / 44px `md:` tile, `rounded-[14px]`, `#FBF1E9`), `PACKING_PRIMARY_BUTTON_CLASS` (coral, `#2B1610` text, 52px phone / 48px `md:`, `rounded-[18px]` / `md:rounded-2xl`, bold, coral glow shadow), `PACKING_SECONDARY_BUTTON_CLASS` (white, 1.5px `#E9D5C6` border, same heights), `PACKING_ICON_BUTTON_CLASS` (44px square, `rounded-[14px]`, white, 1.5px `#EFE3D8` border), `PACKING_PROGRESS_TRACK_CLASS` (6px, `#F5EAE0`, full radius), `PACKING_PROGRESS_FILL_CLASS` (coral).

- [ ] **Step 1:** Create `packing-styles.ts` with those exports.
- [ ] **Step 2:** In the packing page change both `<main className="min-h-screen bg-[#FAFAF8]">` to `bg-[#FFF8F2]`. `TripHero` and `DASHBOARD_TRIP_SUBPAGE_SHELL` stay unchanged (spec decision 15).
- [ ] **Step 3:** `npx tsc --noEmit -p .` (no output); eslint on both files (no errors).
- [ ] **Step 4:** Commit: `git commit -m "feat(packing): cream page background and shared A2 style tokens"`.

### Task 4: Item row and item editor dialog

**Files:**
- Modify: `components/packing/packing-item-row.tsx` (row only; `PackingItemEditor` moves)
- Create: `components/packing/packing-item-editor-dialog.tsx`
- Modify: `components/ui/drag-handle.tsx`
- Modify: `components/packing/packing-list.tsx` (`renderItemRow`, `renderSortableRow`, edit state wiring)

**Interfaces:**
- Consumes: `HandDrawnIcon` (Task 2), style tokens (Task 3).
- Produces:
  - `PackingItemRow` props become: `item`, `personTag: string | null` (always `null` for now, decision 16), `canEdit`, `error?`, `onToggle`, `onOpenEditor`, `onDeleteRequest`, `fading?: boolean` (Task 6 sets it), `dragHandle?`, `isDragging?`. The props `metaLabel`, `rtl`, `editor`, `confirmingDelete`, `deleteLoading`, `onDeleteConfirm`, `onDeleteCancel` are removed.
  - `PackingItemEditorDialog(props: { open: boolean; onOpenChange(open: boolean): void; item: PackingItem | null; categories; participants; saving: boolean; error?: string | null; onSave(values: { title: string; quantity: number; categoryId: string; assignedTo: string | null }): void; onDelete(): void; deleting: boolean; usualSlot: React.ReactNode })`.

Row behavior (match `mockup-phone.dc.html` / `mockup-desktop.dc.html`):
- Layout `[grip] [checkbox] [name] [×N pill if quantity > 1] [desktop hover: edit, delete]`, min height 52px phone / 50px desktop, hairline `#F6EEE7` on top.
- Name: 16px/500 phone, 15px desktop, `#2E2A27`; packed = `#7A6A5E` + line-through, row background `#FFFBF7`. Wraps, never truncates.
- Phone: tapping the name (a `<button>` covering the name area) calls `onOpenEditor`. Desktop: same, plus pencil (`edit`) calls `onOpenEditor` and trash (`delete`) calls `onDeleteRequest`; both are 34px icon buttons shown on row hover and `:focus-within`, hidden on coarse pointers.
- Read-only (`canEdit` false): checkbox is a non-interactive `<span>`, name is plain text, no actions.

Delete: `onDeleteRequest` opens the editor dialog with the delete confirmation showing (`Delete "<title>"?` + red **Delete** + **Cancel**). The inline "Delete? Yes/No" in the row is removed.

Editor dialog: bottom sheet on phone (full width, rounded top 24px), centered dialog from `md:`. Fields as today's `PackingItemEditor` (title `dir="auto"`, quantity, category select, person select with "Everyone"), then `usualSlot` (the existing "Add to my usual stuff" button / "Already in your usual stuff…" prompt and error, moved out of `renderItemRow` unchanged), then Save (primary) and Cancel, then a red text button **Delete item** that switches the dialog to the confirmation. Uses the project's existing `Dialog` components.

Drag: `DragHandle` shows the hand-drawn `drag` icon; on `@media (pointer: coarse)` it is hidden (`hidden`), keeping today's hover reveal on fine pointers. In `renderSortableRow`, spread only `listeners.onTouchStart` (when present) onto the `<li>` so a press-and-hold anywhere on the row starts a drag on touch (the existing `TouchSensor` delay 200 / tolerance 8 makes a short tap still a tap); keep full `listeners` and `attributes` on the handle for mouse and keyboard.

- [ ] **Step 1:** Create `packing-item-editor-dialog.tsx` per the interface and move the field markup from `PackingItemEditor`.
- [ ] **Step 2:** Rewrite `PackingItemRow` per the interface and behavior above; delete `PackingItemEditor` and the inline icons (use `HandDrawnIcon`: `check`, `edit`, `delete`).
- [ ] **Step 3:** Update `DragHandle` as above.
- [ ] **Step 4:** In `packing-list.tsx`: replace inline edit (`editingId`, `editSessionView`, `clearInlineEdit`, the `editor` prop) with `editorItemId: string | null` + `editorConfirmDelete: boolean` driving one `<PackingItemEditorDialog>`; `handleSaveEdit` and `handleDelete` keep their Supabase calls and close the dialog on success; delete `listRtl`, `lastDirection`, `isRtlText` and every `dir={listRtl ...}`.
- [ ] **Step 5:** `npx tsc --noEmit -p .` (no output); eslint on the four files (no errors).
- [ ] **Step 6:** Browser check (user), phone width 390px: tap a name → sheet opens with values; Save updates the row; Delete item → confirm → row gone; long Hebrew name with "×3" wraps, starts at the left, no overlap (Review Focus 4); press-and-hold drags, quick tap opens the editor, the checkbox toggles without opening it. Desktop: hover shows grip, pencil, trash; Tab reaches them.
- [ ] **Step 7:** Commit: `git commit -m "feat(packing): A2 item row, editor sheet, touch drag"`.

### Task 5: Page header, progress card, actions and toolbar

**Files:**
- Create: `components/packing/packing-progress-card.tsx`
- Create: `components/packing/packing-list-menu.tsx`
- Create: `components/packing/packing-toolbar.tsx`
- Create: `components/packing/packing-people-progress.tsx`
- Modify: `components/packing/packing-list.tsx` (the block from the `Packing` heading to the filter chips)

**Interfaces:**
- `PackingProgressCard({ packed: number; total: number })` — coral card, conic ring (white fill = percent, `rgba(255,255,255,0.35)` rest) with `{pct}%`, "`{total - packed}` left to pack", "`{packed}` of `{total}` packed". When `total === 0` render the empty state instead: "Nothing packed yet. Add your first item." (no ring).
- `PackingListMenu({ onManageCategories(): void; onDeleteAll(): void; canDeleteAll: boolean })` — `more` icon button (44px), `aria-haspopup="menu"`, `aria-expanded`; menu items "Manage categories" and "Delete all items…" (danger color, disabled when `!canDeleteAll`); closes on outside click and Escape.
- `PackingToolbar` — renders, in this order: "Add item" (primary, `add` icon), "From usual stuff" / "From my usual stuff" (`md:`) (secondary, `usual_stuff` icon), desktop-only search input (`search` icon, placeholder "Find an item", `onSearchChange(value)`), desktop-only `PackingListMenu`.
- `PackingPeopleProgress({ people: { key: string; label: string; avatarUrl: string | null; packed: number; total: number }[] })` — desktop "Who's packing" card.
- New state in `packing-list.tsx`: `searchQuery: string` (desktop filter: case-insensitive `title.includes`, applied in `filteredItems` after the assignee filter); `showPacked: boolean` persisted in `localStorage` key `packing-show-packed` exactly like `packing-view-mode`.

Layout (match the mockups):
- Phone (below `md`): title row (`Packing` 30px/800 + hand-drawn coral underline svg from the mockup; right: Share `PACKING_ICON_BUTTON_CLASS` with `share` icon, then `PackingListMenu`) → `PackingProgressCard` → Add item + From usual stuff side by side, each `flex-1` → By category / By person segmented switch → filter chips (scrollable row, decision 17: selected `bg-[#E07A5F] text-[#2B1610]`, others white with `#EFE3D8` border; keep avatars) → "Show packed items (N)" checkbox (square, same style as rows, `aria-pressed`) → groups.
- Desktop (`md:` and up): two columns, `flex flex-wrap gap-7`. Left `flex: 1 1 300px`: `Packing` 34px + underline, `PackingProgressCard`, `PackingPeopleProgress`, "Share list" secondary button. Right `flex: 999 1 560px; min-width: 0`: `PackingToolbar`, then a row with the switch on the left and the Show packed checkbox on the right, then the filter chips, then the groups. On a narrow window the left column stacks on top.
- The "Read-only — you can view but not edit" line stays under the title for read-only viewers; read-only hides Add item, From usual stuff, "+", the menu and the search (Review Focus 5). Share stays when there are items.
- Rename the switch labels to "By category" / "By person". The success banner (`listManagementMessage`) keeps its behavior, restyled with `rounded-2xl`.
- Remove the old "Manage Categories", "Manage packing list", trash and "+ Add Item" buttons and the old percentage/bar block. "Delete all items…" opens `ManagePackingListDialog` with `startAtDelete` true; "Manage categories" opens `ManagePackingCategoriesDialog`.

- [ ] **Step 1:** Create the four components per their interfaces.
- [ ] **Step 2:** Rebuild the top of `PackingList` with the phone and desktop layouts above, wiring existing handlers (`handleShare`, add modal open with `categories[0]?.id`, `setFromUsualOpen(true)`, dialogs) and the new `searchQuery` / `showPacked` state.
- [ ] **Step 3:** `npx tsc --noEmit -p .` (no output); eslint on the five files (no errors).
- [ ] **Step 4:** Browser check (user): phone order matches the mockup with Add item / From usual stuff directly below the progress card; desktop two columns; menu opens/closes with click, outside click, Escape; Delete all goes straight to its confirmation; empty trip shows the empty state with both add buttons; a read-only viewer sees no edit controls.
- [ ] **Step 5:** Commit: `git commit -m "feat(packing): A2 header, progress card, toolbar and list menu"`.

### Task 6: Group cards, show packed and the 4-second linger

**Files:**
- Create: `lib/packing/visible-items.ts`
- Create: `components/packing/packing-group-card.tsx`
- Modify: `components/packing/packing-list.tsx` (`renderGroupHeader`, `renderCategoryHeader`, `renderParticipantHeader`, both sub-header renderers, `renderAddItemButton`, the three By category and three By person rendering paths, `handleTogglePacked`)

**Interfaces:**
- `export function visibleItems<T extends { id: string; is_packed: boolean }>(items: readonly T[], showPacked: boolean, lingering: ReadonlySet<string>): T[]` — keeps input order; keeps an item when `!is_packed || showPacked || lingering.has(id)`.
- `PackingGroupCard` header props: `leading: ReactNode` (icon tile or avatar), `label`, `packed`, `total`, `collapsed`, `onToggleCollapsed()`, `onAdd?()` (absent when read-only), `extraAction?: ReactNode` (the existing "Add category to my usual stuff" button, now with the `usual_stuff` icon), `children` (rows), `allPacked: boolean` (renders "All packed" in `#6B5B50` when the category has items but none visible and it is not collapsed).
- `lingering: Set<string>` state + timer map in `packing-list.tsx`.

Behavior:
- Header: tile (`PACKING_ICON_TILE_CLASS` + `CategoryIcon` 26px) or the person avatar/initial; name 17px/700; `packed/total` 13px/600 `#6B5B50`; 6px progress bar; "+" button (`add` icon, 44px phone / 40px desktop, `bg-[#FDEDE6] text-[#A9432C]`). The tile and the name are one `<button aria-expanded>` that collapses (decision 18); "+" calls `openAddFromGroup(groupKey)` and never collapses. The bottom "+ Add item" row (`renderAddItemButton`) is removed. Counts use all items of the group after the assignee and search filters, before show-packed.
- Person sub-headers (decision 16) and person-view category sub-headers: same rules as today, restyled as 12px/600 uppercase `#8A4A35` with `tracking-wide`, padding `px-4 pt-3 pb-1`. Rows show no person tag.
- Desktop: groups in `grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-5 items-start`; phone: one column `gap-4`. Drag between categories and people keeps working (`GroupedSortableList` is unchanged).
- Show packed: every rendering path passes `visibleItems(groupItems, showPacked, lingering)` as the rows; `itemsByCategory`, `itemsByParticipant`, `personBlockStarts` and `personCategoryStarts` are computed from the visible lists so sub-headers and drag indices match what is shown.
- Linger (decision 19): in `handleTogglePacked`, after a successful update to packed while `showPacked` is false, add the id to `lingering` and start a 4000 ms timer that removes it; while lingering the row renders `fading` (crossed out, then a 300 ms opacity transition to 0 in its last 300 ms). Un-packing a lingering item clears its timer and removes it from `lingering`. Turning `showPacked` on clears all timers and the set. Clear all timers on unmount.

- [ ] **Step 1:** Create `lib/packing/visible-items.ts`.
- [ ] **Step 2:** Create `packing-group-card.tsx` per the interface.
- [ ] **Step 3:** Rewire the group headers, sub-headers and all six rendering paths in `packing-list.tsx` to `PackingGroupCard`, `visibleItems` and the linger state.
- [ ] **Step 4:** `npx tsc --noEmit -p .` (no output); eslint on the three files (no errors).
- [ ] **Step 5:** Browser check (user): tick three items quickly with Show packed off → each stays crossed out ~4 s then disappears; re-tick one within 4 s → it stays unpacked; toggle Show packed on mid-linger → no errors and packed items show in place, faded; a category with only packed items shows "All packed"; with a "who" chip selected the rules still hold; drag a visible row within a category with packed items hidden, then turn Show packed on → packed items kept their places (Review Focus 1–3); collapse persists after reload; "+" opens the add dialog with that category (or person) preselected.
- [ ] **Step 6:** Commit: `git commit -m "feat(packing): A2 group cards, show packed toggle and 4-second linger"`.

### Task 7: Replace the remaining Lucide icons and drop the dependency

**Files:**
- Modify: `components/dashboard/dashboard-sidebar.tsx`, `components/dashboard/dashboard-shell.tsx`, `components/ui/link-preview-thumbnail.tsx`, `components/trip/trip-assistant.tsx`, `components/usual-stuff/usual-stuff-page.tsx`, `components/usual-stuff/usual-stuff-picker.tsx`, `components/packing/manage-packing-list-dialog.tsx`, `components/packing/packing-list.tsx` (any import left)
- Modify: `package.json`, `package-lock.json`

**Interfaces:**
- Consumes: `HandDrawnIcon` (Task 2).

Mapping (Lucide → `HandDrawnIcon` name): `LayoutGrid`→`overview`, `Map`→`map`, `Luggage`→`luggage`, `Wallet`→`wallet`, `FileText`→`notes`, `ImageIcon`→`photos`, `CheckSquare`→`checklist`, `ChevronUp`→`chevron_up`, `ChevronDown`→`chevron_down`, `ChevronLeft`→`chevron_left`, `Home`→`house`, `Menu`→`menu`, `X`→`close`, `Link`→`link`, `Sparkles`→`sparkles`, `Star`→`star`, `Share2`→`share`, `Plus`→`add`, `Trash2`→`delete`, `BookmarkPlus`→`usual_stuff`. Keep each call site's size (`size-4` = 16, `size-5` = 20) and color classes; drop `strokeWidth` props. Inline hand-written `<svg>` icons elsewhere stay (spec, "Calls I made").

- [ ] **Step 1:** Replace every Lucide import and usage per the mapping.
- [ ] **Step 2:** Confirm nothing imports Lucide: `git grep -n "lucide-react" -- app components lib` → expected: no output.
- [ ] **Step 3:** `npm uninstall lucide-react`.
- [ ] **Step 4:** `npx tsc --noEmit -p .` (no output); `npx eslint app components lib` (no errors).
- [ ] **Step 5:** Browser check (user): sidebar, mobile menu open/close, link previews, trip assistant, usual stuff page and picker all show hand-drawn icons at their usual sizes.
- [ ] **Step 6:** Commit: `git commit -m "feat: hand-drawn interface icons everywhere; remove lucide-react"`.

---

## Done when

All seven tasks are committed on `feature/packing-visual-refresh`, typecheck and lint are clean, and the user has checked every browser step (including the five Review Focus items) on a preview and approved it. Merging to `main` (which deploys) needs the user's separate go-ahead.
