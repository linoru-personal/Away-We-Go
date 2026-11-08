# Packing list: reuse ("usual stuff") and WhatsApp sharing — design

- **Date:** 2026-11-08
- **Status:** Approved by the user on 2026-11-08
- **Beads:** design task `away-we-go-nxh.4`, under epic `away-we-go-nxh` (Packing List Redesign). The full decision log (Decisions 1–14) is in the task notes.
- **Wireframes:** `.superpowers/brainstorm/169-1794138158/content/reuse-overview.html` (local, not committed)

Labels used below: **(user)** = decided by the user. **(call)** = Claude's call, which the user was told about and can override.

## 1. Intent

Away We Go is used by a small family (two account holders today). Packing for a new trip means rebuilding the list each time. The only reuse path today is templates, and they are all-or-nothing: you import a whole template, then delete what doesn't fit this trip. Some items fit almost every trip (toiletries, chargers, basic clothing). Others depend on destination, weather, activities and who is coming.

The user thinks of reuse as "my usual stuff", not "what we took to trip X". They want to:

1. Start a trip from a personal base list, quickly picking whole categories or single items, then adjust.
2. Send a clean, readable packing list to family and fellow travelers in WhatsApp.

## 2. Goals, non-goals, anti-goals

**Goals**
- One personal "usual stuff" list per account, which replaces templates as the way to reuse.
- A picker that brings selected usual-stuff items into a trip, with explicit person matching.
- New trips start with the user's own categories.
- Category reordering, and a safe category delete.
- A one-tap share of the current packing view as WhatsApp-formatted text.

**Non-goals (for now)**
- Trip-type kits, collections or tags (no "Ski" or "Beach" kits).
- A shared household list. The model should allow it later, but it is not built now.
- Direct trip-to-trip copy as a main path. A past trip is used only as a one-time source to build usual stuff.
- Fixing bugs `away-we-go-nxh.3` and `away-we-go-nxh.6`. They ship separately.
- A test framework. The project has none today.

**Anti-goals (would count as failure even if it works)**
- Silent name matching that puts items on the wrong person.
- Duplicate items, whether in usual stuff or from picking the same thing twice.
- Deleting existing template data.
- Extra dialogs or controls on the main share action.

## 3. Current state (relevant facts)

- `packing_categories` (`trip_id`, `name`, `icon`, `sort_order`, …) and `packing_items` (`trip_id`, `category_id`, `title`, `quantity`, `is_packed`, `assigned_to_participant_id`, `sort_order`, …) are per trip. `packing_items.category_id` is `ON DELETE RESTRICT`.
- New trips get four fixed categories (Clothing, Toiletries, Documents, Electronics), with no icons, from `ensure_default_packing_categories`.
- Templates: `supabase/migrations/20260417120000_packing_templates.sql`, `lib/packing-templates/*`, `components/packing/packing-templates-dialog.tsx`. Reached through `components/packing/manage-packing-list-dialog.tsx`. Templates store category and person as plain text names, so icons, empty categories and item order are lost.
- The packing page is `app/dashboard/trip/[id]/packing/page.tsx`, which renders `components/packing/packing-list.tsx`. The list has a category view and a person view (`viewMode`), plus person filter chips (`assigneeFilter`: All / Everyone / each participant). The chips apply to both views through `filteredItems`.
- Ordering problems found in `away-we-go-nxh.5`:
  - A new item is inserted with `sort_order` 0, so it appears first in its group.
  - Reorders renumber from `minOrder + i`, which can collide across groups.
  - All template items share one `created_at`.
- Deleting a category moves its items to `others[0]` and then deletes the category, with no confirmation, in two separate requests (`manage-packing-categories-dialog.tsx:137-170`).
- There is no clipboard or share code anywhere in the app.

## 4. Design

### 4.1 Usual stuff (the personal list)

- **One list per account (user).** It contains:
  - Its own categories: name, icon and order.
  - Items: title, quantity, a person label, the "always" flag, and an order within the category.
- **Build it so a shared household list can be added later (user).** For example, ownership can sit on a "list" row owned by a user, rather than every item pointing at the user directly. The exact schema is the builder's.
- **Categories are item types (user)**, such as Clothing and Toiletries, never trip types.
- **The person label is a plain name on the item (call, confirmed in playback).** It can also be "Everyone". It is not a link to trip participants. Matching to a trip happens in the picker (4.4).
- **Item order lives inside categories only (user).** Usual-stuff order is carried into trips.
- **"Always" flag (user):** a per-item ★ that pre-selects the item in the picker.
- **Usual-stuff page (user):** its own page to add, edit, remove, star, label a person, and manage categories. That includes drag-reorder in the Manage categories dialog (4.5). Where the page sits in navigation is the builder's call.
- **Item identity (call, after the builder check):** a usual-stuff item is identified by **title + category + person label**, compared case- and whitespace-insensitively. So "Toothbrush (Noa)" and "Toothbrush (Dan)" can both exist. This identity is the uniqueness rule in the schema and is used for every duplicate check.
- **"Add to my usual stuff" from a trip (user):** works on a single trip item or a whole trip category. It lives in the item's and category's existing menus (call, confirmed).
  - The person label comes from the trip participant's display name, or "Everyone" if the item is unassigned (call).
  - If the category doesn't exist in usual stuff yet, it is created at the end, with the trip category's icon (call).
  - **Single item that already exists (call):** the app says "Already in your usual stuff" and offers to update the quantity, the only field that can differ. The ★ flag is never changed by this. The item is never duplicated.
  - **Whole category (call):** new items are added and existing ones are skipped. There is no per-item prompt. A toast reports the result, for example "Added 4 items, 2 were already there".
- **First-time start (user):** while usual stuff is empty, the page offers "Start from a trip or template". This opens the picker (4.4) with a past trip or an old template as the source, and the user ticks what to keep. Item order, icons and person names are copied where the source has them.

### 4.2 Templates are retired (user)

- Templates are removed from the UI: the menu entries in `manage-packing-list-dialog.tsx` and the templates dialog.
- **Template data is not deleted.** Templates stay readable as a source for the first-time start (4.1).
- Bug `away-we-go-nxh.2` (template re-import duplicates) becomes obsolete. Close it when templates leave the UI.

### 4.3 New trips start with the user's categories (user)

- A new trip gets all of the creator's usual-stuff categories, in usual-stuff order, with their icons. They start empty.
- If the creator's usual stuff has no categories, the trip falls back to the four fixed categories, **now with icons** (user). The builder picks the four icons from the existing icon set (call).
- **When and whose (call, after the builder check):**
  - Today, categories aren't created with the trip. `ensure_default_packing_categories` fills them in when any editor first opens the packing page.
  - New behavior: the categories are created **when the trip is created**, from the **creator's** list. This is one RPC called from the trip-creation flow (`components/trips/trip-form-modal.tsx`), so a co-editor who opens the page first never sets them.
  - `ensure_default_packing_categories` stays only as a fallback for any trip that still has no categories, including old trips whose packing page was never opened. It seeds the four fixed categories, now with icons, and never reads anyone's usual stuff.
- Existing trips that already have categories are not changed (call).

### 4.4 The picker: "Add from usual stuff"

- **Where:** a "+ From usual stuff" action on the trip's packing page, available at any time, not only at trip creation (call, confirmed). Owners and editors only.
- **Selection (user):**
  - ★ items start ticked, and everything else starts unticked.
  - The user can tick single items, or a category header to take the whole category.
  - A category header shows partial selection ("3 of 4").
- **Already on the trip (call, confirmed):** an item that is already in the trip is shown greyed out and is not added again.
  - Match on the same title, in a category with the same name, assigned to the participant the item resolves to through the who's-who rows (call).
  - So Dan's toothbrush isn't greyed out just because Noa's is already on the trip.
  - Changing a who's-who row re-evaluates which items are greyed out.
- **Who's who (user):**
  - At the top of the picker there is one row per distinct person label in the current selection: "Noa's items go to: [▾]".
  - The choices are each trip participant, "Everyone (shared)", and "Don't add their items".
  - If a participant has the same name, that participant is pre-filled. The suggestion is visible and can be changed; matching is never silent.
  - If there's no match, the row defaults to "Everyone (shared)".
  - Items labelled "Everyone" need no row and stay shared.
- **Categories:** a picked item goes into the trip category with the same name as its usual-stuff category. If there isn't one, that category is created at the end of the trip's category order, with its icon (call).
- **Order (user + call):** picked items are appended to the end of their trip group, keeping usual-stuff order.
- **Atomic (call, from the `nxh.5` investigation):** the whole pick, including any category creation, is one operation (one RPC), not one insert per category.
- **The same picker is reused for the first-time start**, with a trip or template as the source and usual stuff as the target. In that mode the who's-who rows aren't needed: person names are copied as labels.

### 4.5 Ordering

- **Items (user):**
  - Order lives within categories.
  - The person view groups each person's items by category and follows category order.
  - Dragging in the person view only reassigns the person; it never reorders.
- **New items (call):** appended to the end of their group. This fixes today's insert-at-top behavior.
- **Saving order (call):**
  - A reorder is saved atomically.
  - `sort_order` is per group, with `created_at` then `id` as tie-breaks.
  - The renumbering collision (`minOrder + i`) is removed.
- **Categories (user):**
  - Reordered by drag in the existing Manage categories dialog, in trips and on the usual-stuff page.
  - Usual-stuff order is the starting order for new trips. After that each trip keeps its own order.
  - Category headers in the main list are not draggable.
  - A category order change is saved in one request (call).
  - Categories added later go to the end (call).

### 4.6 Safe category delete (user)

- Deleting a category asks for confirmation first and shows how many items the category has.
- If it has items, the user chooses either to move them to another category (they pick which) or to delete them too.
- The move-or-delete and the category delete happen as one atomic operation.
- This applies to trip categories and usual-stuff categories alike (call).

### 4.7 Share for WhatsApp

- **Control (user):** one "Share" button in the packing list header. No dialog and no extra controls.
  - On phones it opens the native share sheet with the text (user).
  - On desktop it copies the text to the clipboard and shows a toast (user).
  - **The choice goes by device, not by API support** (from the user's phone/desktop split). Desktop Chrome, Edge and Safari also support `navigator.share`, but desktop must still copy. Use the share sheet only on a touch/mobile device (for example `(pointer: coarse)`) where `navigator.share` exists. Otherwise copy.
  - If the user cancels the share sheet, nothing happens and no error is shown (call).
  - The button is available to everyone who can see the list, including viewers (call).
- **Scope = what's on screen (user):**
  - The current view, either by category or by person, plus the current person chip.
  - A one-person filter keeps the view's grouping.
  - A one-person copy leaves out shared ("Everyone") items, exactly as the screen does.
  - Collapsed groups are still included (call). Empty groups are left out (call).
- **Packed items (user):** all items in scope are included, with no packed or unpacked marks. The message is a plan, not a progress report.
- **Format (user):** WhatsApp bold headers and clean bullets, with no emoji.

  Category view, All chip:
  ```
  *Rome – packing list*

  *Clothing*
  • T-shirts ×5 (Noa)
  • Rain jacket

  *Toiletries*
  • Sunscreen
  ```

  - Quantity is shown only when it is greater than 1, as ` ×N` (call).
  - The person tag ` (Name)` is shown only in category view with the All chip (call).
  - In person view, each person is a bold header, followed by category sub-headers and their items. Shared items appear under an "Everyone" header (call). The builder chooses the sub-header style, but it must be distinguishable from the person header.
  - A one-person copy is titled `*Rome – Noa's packing list*` (call, confirmed in playback).
  - Groups and items follow on-screen order.
- **Toast (call):** it describes what was shared, for example "Copied Noa's items, by category".
- Right-to-left (Hebrew) item titles must read correctly in WhatsApp. The builder should check mixed-direction lines.

## 5. Constraints

- Stack: Next.js app router, Supabase (Postgres + RLS), Tailwind. Schema changes go in `supabase/migrations/`.
- RLS:
  - Usual stuff is private to its owner.
  - The picker writes only to trips the user can edit. The existing trip packing permissions apply (see `docs/PACKING_PERMISSIONS_INSPECTION.md`).
- Multi-row operations (picking, reordering, category delete) are atomic.
- There is no automated test framework. Verification is manual, plus lint and build. The plan should say how each part is checked by hand.
- Early-stage product with two users: avoid hardening beyond the anti-goals above.

## 6. Left to the builder

- The exact schema for usual stuff, including the "list" ownership row for a future shared list, and the RPC signatures.
- Where the usual-stuff page sits in navigation, and its route.
- How picking from a past trip or template maps template text names to categories and people.
- How to renumber existing `sort_order` values to the per-group scheme.
- The order to ship the pieces in. Suggested: ordering fixes, then usual stuff and the picker, then retiring templates. Share and category delete are independent.

## 7. Related Beads issues

- `away-we-go-nxh.2`: obsolete once templates leave the UI.
- `away-we-go-nxh.3` and `away-we-go-nxh.6`: separate silent-failure bugs, out of scope here.
- `away-we-go-nxh.5`: the ordering investigation that feeds 4.4 and 4.5.
