# Packing List Reuse and WhatsApp Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace packing templates with a personal "usual stuff" list and a picker, fix item/category ordering, make category delete safe, and add a one-tap WhatsApp share of the packing list.

**Architecture:** New Supabase tables for usual stuff (owned through a `usual_lists` row so a household list can be added later). All multi-row writes (reorder, pick, seed, delete) go through `security definer` Postgres RPCs, so each one is a single atomic call. The UI reuses the existing packing page and dialogs. A shared category-manager component serves both trip and usual-stuff categories.

**Tech Stack:** Next.js 14 (app router, client components), Supabase (Postgres + RLS, `supabase-js` v2), Tailwind v4, `@dnd-kit/sortable`, `lucide-react`.

**Spec:** `docs/superpowers/specs/2026-11-08-packing-list-reuse-and-sharing-design.md`. Read it before any task. Section numbers below (§4.x) refer to it.

## Milestones

- **Milestone 1 (Tasks 0–4): local test database, then ordering, safe category delete, WhatsApp share.** It ships on its own.
  - After Task 4: a whole-branch review, then the user verifies (preview or `npm run dev`) and decides whether to merge to `main`.
  - **Task 5 doesn't start until the user explicitly approves moving on to Milestone 2.**
- **Milestone 2 (Tasks 5–12): usual stuff.** It ends with a whole-branch review and the user's verification and merge decision.

## Execution

- Approach: subagent-driven (`superpowers:subagent-driven-development`).
- **Models:**
  - Implementer subagents and task-level reviewers run on **Sonnet 5.5** (`model: "sonnet"`).
  - **Opus** handles the whole-branch review at the end of each milestone. Opus is also used for any architectural question an implementer escalates: schema or RLS changes beyond what this plan specifies, or a conflict between the plan and the code.

## Migrations: environments, backup, rollback

The user approves and applies every migration. Agents only write the files and never connect to any database.

- **Environments:**
  - **Production:** the hosted Supabase project in `.env.local`, which is shared by `main` deployments.
  - **Non-production (user's choice):** a local Supabase stack in Docker, set up in Task 0. Supabase CLI 2.75.0 and Docker 29.3.1 are installed.
    - It is rebuilt from `supabase/migrations/` with `supabase db reset`.
    - New migrations are applied there with `supabase migration up`, and the down scripts with `supabase db query -f supabase/rollbacks/<file>` (or psql against the local DB URL shown by `supabase status`).
    - The app points at it through `.env.development.local`, which overrides `.env.local` in `npm run dev`. Delete that file to point back at production.
- **Every migration ships as a pair:**
  - `supabase/migrations/<ts>_<name>.sql` (up)
  - `supabase/rollbacks/<ts>_<name>.down.sql` (down: it restores the exact previous state, including old function bodies)
- **Order for each migration:**
  1. Apply it to non-prod.
  2. Run the task's SQL checks there.
  3. Run the down script, then re-apply the up script, to prove the rollback works.
  4. Run the app against non-prod (local `.env` pointing at the local stack) and do the task's manual checks.
  5. Only then, back up production (next bullet).
  6. Apply it to production.
  7. Re-run the read-only SQL checks there.
- **Production backup before applying:**
  - `supabase db dump --linked -f backups/<date>-pre-<name>-schema.sql`
  - `supabase db dump --linked --data-only -f backups/<date>-pre-<name>-data.sql`
  - `backups/` is git-ignored (Task 1 adds it to `.gitignore`).
  - The migrations also keep in-database copies of anything they overwrite (Task 1: `packing_items_sort_order_backup_20261108`).
- **Rollback:** run the `.down.sql` in the SQL editor. If data is wrong, restore the affected tables from the backup dump.
- **Data preservation:** no migration drops, truncates or alters `packing_templates` or `packing_template_items`. The template feature is removed from the UI only (Task 12).

## Global Constraints

- **No test framework (spec non-goal).** Each task replaces "failing test, then pass" with:
  - SQL checks that the user runs in the Supabase SQL editor, for DB tasks, and
  - a manual check list in the running app (`npm run dev`), for UI tasks.
  - Every task ends with `npm run lint` and `npm run build`, both passing.
- **Migrations:** follow "Migrations: environments, backup, rollback" above. Agents **never apply them**. A task that depends on a migration waits for the user's confirmation that it passed in non-prod.
  - Migrations must be additive and must not break the code currently on `main`. Production deploys from `main`, and the database is shared.
- **No silent "Everyone":**
  - A person label with no matching trip participant is **never** assigned automatically, not even to Everyone. The user must pick a participant, "Everyone (shared)" or "Don't add their items".
  - Items labelled Everyone (null label) need no mapping.
- **Git:** work on `feature/packing-list-redesign`. Commit per task. Never push or merge without the user's approval.
- **Item identity:** usual-stuff item = `lower(btrim(title))` + `category_id` + `lower(btrim(coalesce(person_label,'')))`. Trip "already on trip" match = same normalized title + trip category whose `lower(btrim(name))` equals the usual category's + same `assigned_to_participant_id` (null = Everyone).
- **`person_label` null means "Everyone".** Display text is `Everyone`.
- **Order:** item `sort_order` is per category, from 0. New items go to `max(sort_order in group) + 1`. Ties are broken by `created_at`, then `id`. Category `sort_order` is per trip, or per usual list.
- **Fixed seed icons (call):** Clothing `shirt`, Toiletries `sparkles`, Documents `ticket`, Electronics `camera`. These are keys from `CATEGORY_ICON_KEYS` in `components/ui/category-icons.tsx`.
- **Share format (§4.7), exact:**
  - Title `*<Trip> – packing list*`, or `*<Trip> – <Name>'s packing list*` for a one-person copy. The dash is an en dash `–`.
  - Then a blank line, then the bold group header `*<Group>*`, then items as `• <title>` + ` ×N` when N > 1 + ` (<Name>)` only in category view with the All chip.
  - A blank line goes between groups.
- **Feedback text:** reuse the list's existing `listManagementMessage` banner in `packing-list.tsx` as the "toast". Don't add a toast library.
- **Styling:** reuse the palette and button class strings already in `components/packing/*` (`BTN_PRIMARY`, `BTN_SECONDARY`, `#E07A5F`, and so on).

## Review Focus

1. **Hebrew (RTL) titles in shared text.** Mixed Hebrew titles with an English `×3` or `(Noa)` must read correctly in WhatsApp. Owned by Task 4 (manual check 4.6).
2. **The same title with different case or spacing** ("Toothbrush" / "toothbrush "): it must count as one item, not a duplicate. Owned by Task 5 (SQL check 5.4) and Task 10 (check 10.4).
3. **Picker on a trip with zero participants, or a person label with no match:** who's-who offers only "Everyone (shared)" and "Don't add their items", starts with nothing chosen, and blocks adding until the user chooses. Owned by Task 8 (check 8.5).
4. **Deleting the only category, or one with items and no other category:** offer only "Delete items too". Never move items to nowhere. Owned by Task 3 (check 3.5).
5. **A co-editor added the same item since the picker opened:** the RPC must re-check on the server and skip it, not duplicate it. Owned by Task 5 (SQL check 5.6).

---

### Task 0: Local Supabase test environment

**Files:**
- Create: `supabase/config.toml` and the other files from `supabase init` (commit them; `supabase/.temp/` and `.branches/` stay ignored by the generated `.gitignore`)
- No `.gitignore` change is needed for env files: the existing `.env*` pattern (line 34) already ignores `.env.development.local`.

**Interfaces:**
- Produces: a local stack whose schema equals `supabase/migrations/`, and the workflow every later migration task uses.

- [ ] **Step 1: Run `supabase init`** in the repo root. Answer no to the VS Code/IntelliJ prompts. This only creates files; it connects to nothing.
- [ ] **Step 2: Hand off to the user:**
  1. Start Docker.
  2. Run `supabase start`, then `supabase db reset`.
  3. Run `supabase status` to get the local API URL and anon key.
  4. Create `.env.development.local` with `NEXT_PUBLIC_SUPABASE_URL=<local API URL>` and `NEXT_PUBLIC_SUPABASE_ANON_KEY=<local anon key>`, using the same variable names as `.env.example`.
- [ ] **Step 3: User checks:**
  - 0.1 `supabase db reset` finishes with no errors. If a baseline migration fails locally, stop and report it. That is an Opus-level question, and production is not affected.
  - 0.2 `npm run dev` against the local stack: sign up a test user, create a trip, and open its packing page. The four fixed categories appear.
  - 0.3 `git status` shows no `.env*` file as untracked.
- [ ] **Step 4: Commit** `chore: add local Supabase config for migration testing`.

### Task 1: Trip ordering and category RPCs (migration)

**Files:**
- Create: `supabase/migrations/20261108120000_packing_ordering_and_category_rpcs.sql`
- Create: `supabase/rollbacks/20261108120000_packing_ordering_and_category_rpcs.down.sql`
- Modify: `.gitignore` (add `backups/`)

**Interfaces:**
- Produces (all `security definer`, `set search_path to public`, granted to `authenticated`, each starting with a check of `public.can_edit_trip_content(trip)` that raises `'not allowed'` on failure):
  - `reorder_packing_items(p_trip_id uuid, p_category_id uuid, p_ids uuid[]) returns void`: for each id at array index i, sets `category_id = p_category_id` and `sort_order = i` (0-based). Only rows with `trip_id = p_trip_id` are touched.
  - `reorder_packing_categories(p_trip_id uuid, p_ids uuid[]) returns void`: sets `sort_order = i`.
  - `delete_packing_category(p_category_id uuid, p_move_to uuid default null) returns void`:
    - With `p_move_to` set (it must belong to the same trip and differ from the deleted category), items are appended to the end of `p_move_to` in their current order.
    - With null, the category's items are deleted.
    - Then the category is deleted. All of this happens in one transaction.
- `ensure_default_packing_categories` is replaced (`create or replace`) with the same body but the four icons from Global Constraints.
- A one-time data fix renumbers the existing `packing_items.sort_order` to `row_number() over (partition by category_id order by sort_order, created_at, id) - 1`.

- [ ] **Step 1: Write the migration** with the functions above, the renumber `update`, and `grant execute` lines.
  - Before renumbering, the migration copies `(id, sort_order)` into `packing_items_sort_order_backup_20261108`. RLS is enabled on that table with no policies, so only the service role can read it.
- [ ] **Step 2: Write the down script.** It drops the three new functions, restores the original `ensure_default_packing_categories` body (copied verbatim from `supabase/migrations/20260409100005_baseline_functions.sql`), and restores `sort_order` from the backup table. It leaves the backup table in place.
- [ ] **Step 3: Hand it to the user to apply, following the migration order (non-prod first).** Provide these SQL checks (replace `<trip>`, `<cat>`, `<cat2>` with real ids from a test trip):
  - 1.1 `select category_id, array_agg(sort_order order by sort_order) from packing_items where trip_id='<trip>' group by 1;` → each array is `{0,1,2,…}` with no gaps or repeats.
  - 1.2 `select reorder_packing_items('<trip>','<cat>', array[<ids reversed>]);` then re-run 1.1 → reversed order.
  - 1.3 `select delete_packing_category('<cat>','<cat2>');` → the items appear at the end of `<cat2>`, and `<cat>` is gone.
  - 1.5 **Production preflight (read-only, run on prod before applying; expect 0):** `select count(*) from packing_items pi where assigned_to_user_id is not null and not exists (select 1 from trips t where t.id=pi.trip_id and t.user_id=pi.assigned_to_user_id) and not exists (select 1 from trip_members m where m.trip_id=pi.trip_id and m.user_id=pi.assigned_to_user_id);` The renumber fires the `packing_items_trip_integrity` trigger on every row, so a stale `assigned_to_user_id` would abort the migration (it rolls back safely).
  - 1.4 As a viewer of the trip (or via `set request.jwt.claims`), calling any RPC → error `not allowed`.
- [ ] **Step 4: Wait for the user to confirm that 1.1–1.4 pass in non-prod and that down-then-up works, then commit.** The production apply happens later, when the user ships Milestone 1.

```bash
git add supabase/migrations/20261108120000_packing_ordering_and_category_rpcs.sql supabase/rollbacks/20261108120000_packing_ordering_and_category_rpcs.down.sql .gitignore
git commit -m "feat(db): atomic packing reorder and category delete RPCs"
```

### Task 2: Item ordering in the packing UI

**Files:**
- Modify: `lib/packing/packing-item-mutations.ts` (replace `updatePackingItemsSortOrders`)
- Modify: `app/dashboard/trip/[id]/packing/page.tsx:246-300` (`onReorderGroup`, `onMoveItem`)
- Modify: `components/packing/packing-list.tsx` (`handleAddItem` ~:335, `itemsByParticipant` :225-245, participant-view render branches ~:890-970)

**Interfaces:**
- Consumes: `reorder_packing_items` (Task 1).
- Produces: `reorderPackingItems(supabase: SupabaseClient, tripId: string, categoryId: string, orderedIds: string[]): Promise<{ error: Error | null }>` in `lib/packing/packing-item-mutations.ts`. `updatePackingItemsSortOrders` is deleted.

- [ ] **Step 1: Add `reorderPackingItems`** (one `supabase.rpc("reorder_packing_items", …)` call; on error, `console.warn` the same way as `updatePackingItem`).
- [ ] **Step 2: Category view in `page.tsx`:**
  - Within-group reorder calls `reorderPackingItems` with the group's ids in their new order.
  - A cross-category move calls it once for the destination category (the moved id goes in at `insertIndex`). Gaps left in the source group are fine.
  - Remove the `minOrder + i` logic.
- [ ] **Step 3: New items append.** In `handleAddItem`, insert with `sort_order = max(sort_order of items in that category) + 1`, or 0 if the category is empty.
- [ ] **Step 4: Person view groups by category (§4.5).**
  - `itemsByParticipant` returns, for each person group (Everyone first, then participants in order), `categories: { category: PackingCategory; items: PackingItem[] }[]`. Category order follows `categories` (`sort_order`, then name). Items within a category are sorted by `sort_order`, `created_at`, `id`.
  - Render a small category sub-header inside each person group.
  - Dragging in person view only changes `assigned_to_participant_id` (`updatePackingItem` with context `move-participant`). It never writes `sort_order`. A drop within the same person does nothing.
- [ ] **Step 5: Verify.** Run `npm run lint && npm run build` and expect both to pass. Then run `npm run dev` and check:
  - 2.1 A new item appears at the bottom of its category.
  - 2.2 Drag-reorder within a category survives a reload.
  - 2.3 Move an item to another category, then reload: it's where you dropped it.
  - 2.4 Person view shows category sub-headers in category order.
  - 2.5 Dragging to another person reassigns and survives a reload. The order within the category in category view is unchanged.
- [ ] **Step 6: Commit** `feat(packing): per-category item order, append new items, person view by category`.

### Task 3: Shared category manager with drag reorder and safe delete

**Files:**
- Create: `components/packing/category-manager-list.tsx`
- Modify: `components/packing/manage-packing-categories-dialog.tsx` (render the list from the new component; remove the delete logic at :137-170)

**Interfaces:**
- Consumes: `reorder_packing_categories`, `delete_packing_category` (Task 1).
- Produces:
  ```ts
  export type ManagedCategory = { id: string; name: string; icon: string | null; sort_order: number; itemCount: number };
  export interface CategoryManagerListProps {
    categories: ManagedCategory[];
    onAdd(name: string, icon: CategoryIconKey): Promise<void>;
    onUpdate(id: string, name: string, icon: CategoryIconKey): Promise<void>;
    onReorder(orderedIds: string[]): Promise<void>;
    onDelete(id: string, moveTo: string | null): Promise<void>;
  }
  export function CategoryManagerList(props: CategoryManagerListProps): JSX.Element;
  ```
  Task 7 reuses this component for usual-stuff categories.

- [ ] **Step 1: Build `CategoryManagerList`.**
  - Add/rename/icon UI is moved from the existing dialog.
  - Drag handles use `@dnd-kit/sortable`, following the pattern in `packing-list.tsx`.
  - On drop, call `onReorder` once.
  - Errors from any callback are shown inline in red, like `addError`.
- [ ] **Step 2: Safe delete UI (§4.6).** Clicking delete opens an inline confirm panel:
  - With `itemCount === 0`: "Delete "<name>"?" with **Delete** and **Cancel**.
  - With items: "Delete "<name>"? It has N items." Then a radio with **Move them to** [select of the other categories] (default: the first other category) and **Delete them too**, followed by **Delete** and **Cancel**.
  - With no other category: only "Delete them too" is shown (Review Focus 4).
- [ ] **Step 3: Wire the trip dialog.**
  - `itemCount` is computed from the trip items passed in. The dialog gets `items` as a new prop from `packing-list.tsx`.
  - `onReorder` calls `supabase.rpc("reorder_packing_categories", …)`, and `onDelete` calls `supabase.rpc("delete_packing_category", …)`. Both then call `onSuccess()`.
  - New categories are added at the end (this keeps the existing `max + 1`).
- [ ] **Step 4: Verify.** Run lint and build. Then check:
  - 3.1 Drag a category and reload: the order persists in both views.
  - 3.2 Delete an empty category: confirm, then it's gone.
  - 3.3 Delete with items, choosing "Move to X": the items are at the end of X.
  - 3.4 Delete with items, choosing "Delete them too": the items are gone.
  - 3.5 With a single category that has items, only "Delete them too" is offered.
- [ ] **Step 5: Commit** `feat(packing): drag-reorder categories and confirm category delete`.

### Task 4: Share for WhatsApp

**Files:**
- Create: `lib/packing/share-text.ts`
- Modify: `components/packing/packing-list.tsx` (header Share button, visible to all roles)

**Interfaces:**
- Produces:
  ```ts
  export type ShareScope = { viewMode: "category" | "participant"; assigneeFilter: string }; // same values as packing-list state
  export function buildPackingShareText(args: {
    tripTitle: string; scope: ShareScope;
    categories: PackingCategory[]; participants: PackingParticipant[]; items: PackingItem[];
  }): { text: string; summary: string };
  export function shouldUseShareSheet(): boolean; // matchMedia("(pointer: coarse)").matches && typeof navigator.share === "function"
  export async function sharePackingText(text: string): Promise<"shared" | "copied" | "cancelled">;
  ```
  - `summary` is the banner text:
    - `Copied the full list, by category`
    - `Copied the full list, by person`
    - `Copied <Name>'s items, by category`
    - `Copied <Name>'s items, by person`
    - `Copied shared items, by …` when the filter is `everyone`.
  - When the result is `shared`, the banner reads `Shared` instead of `Copied` (same wording otherwise).
  - `cancelled` (an `AbortError` from `navigator.share`) shows nothing.
  - `tripTitle` comes from a new `tripTitle: string` prop that `page.tsx` passes (`trip.title`).

- [ ] **Step 1: Implement `buildPackingShareText`** using the exact format in Global Constraints and these rules:
  - Apply the same filter as `filteredItems`.
  - In category view, groups follow category order.
  - In person view, use a person header `*<Name>*` (Everyone first, as `*Everyone*`), then a category sub-header `_<Category>_` (italic, call) on its own line, then its items.
  - Leave out empty groups. Include collapsed groups. Include packed and unpacked items with no marks.
  - Use the one-person title when the filter is a participant id.
- [ ] **Step 2: Implement `sharePackingText`.**
  - When `shouldUseShareSheet()` is true, call `navigator.share({ text })`.
  - Otherwise call `navigator.clipboard.writeText(text)`.
  - If both fail, set the banner to `Couldn't copy the list`.
- [ ] **Step 3: Add a "Share" button** (lucide `Share2`) next to the progress header. It is visible when `!loading && items.length > 0`. On click, build the text with the current `viewMode` and `assigneeFilter`, call `sharePackingText`, and set `listManagementMessage`.
- [ ] **Step 4: Verify.** Run lint and build. Then check:
  - 4.1 On desktop, category view, All: paste into WhatsApp Web and confirm it matches the spec example (§4.7): bold title, bold categories, `×5`, `(Noa)`.
  - 4.2 Filter to Noa: the title is `Noa's packing list`, there are no `(Noa)` tags, and there are no shared items.
  - 4.3 Person view, All: person headers, italic category sub-headers, and Everyone first.
  - 4.4 Collapse a group: it's still in the copy. An empty category isn't in it.
  - 4.5 On a phone (or DevTools touch emulation on a device that has `navigator.share`), the share sheet opens. Cancel it and confirm no banner appears.
  - 4.6 Share a list with Hebrew titles, quantities and person tags, and confirm in WhatsApp that each line reads correctly (Review Focus 1).
- [ ] **Step 5: Commit** `feat(packing): share packing list as WhatsApp text`.

### Task 5: Usual stuff schema and RPCs (migration)

**Files:**
- Create: `supabase/migrations/20261108130000_usual_stuff.sql`
- Create: `supabase/rollbacks/20261108130000_usual_stuff.down.sql` (drops the new RPCs, helper and tables in reverse order. Nothing existing is touched.)

**Interfaces:**
- **Tables** (RLS on, owner-only through a `usual_list_owned_by_user(p_list_id uuid)` helper written like `packing_template_owned_by_user`):
  - `usual_lists(id uuid pk, owner_user_id uuid not null unique references auth.users on delete cascade, created_at)`.
  - `usual_categories(id uuid pk, list_id uuid not null references usual_lists on delete cascade, name text not null, icon text, sort_order int not null default 0, created_at)`, with a unique index on `(list_id, lower(btrim(name)))`.
  - `usual_items(id uuid pk, list_id uuid not null references usual_lists on delete cascade, category_id uuid not null references usual_categories on delete restrict, title text not null check (char_length(btrim(title))>0), quantity int not null default 1 check (quantity>=1), person_label text, is_always boolean not null default false, sort_order int not null default 0, created_at)`, with a unique index on `(category_id, lower(btrim(title)), lower(btrim(coalesce(person_label,''))))`.
- **RPCs** (`security definer`, granted to `authenticated`). Each one acts only on the caller's own list unless stated otherwise.
  - `get_or_create_my_usual_list() returns uuid`.
  - `reorder_usual_items(p_category_id uuid, p_ids uuid[]) returns void`. Same semantics as `reorder_packing_items`, including setting `category_id`.
  - `reorder_usual_categories(p_ids uuid[]) returns void`.
  - `delete_usual_category(p_category_id uuid, p_move_to uuid default null) returns void`. Same semantics as `delete_packing_category`.
  - `add_to_my_usual_stuff(p_rows jsonb) returns jsonb`:
    - Each row is `{title, quantity, category_name, category_icon, person_label}`.
    - It finds or creates the category by normalized name. A new category goes at the end, with the given icon.
    - It skips a row that matches an existing item by identity.
    - It appends new items to the end of their category, in the order the rows were given.
    - It returns `{"added": int, "skipped": [{"index": int, "usual_item_id": uuid}]}`.
  - `add_usual_items_to_trip(p_trip_id uuid, p_rows jsonb) returns jsonb`:
    - It requires `can_edit_trip_content`.
    - Each row is `{usual_item_id, participant_id}`, where `participant_id` may be null (Everyone). Rows for "Don't add" are simply not sent.
    - For each row, in order: it finds the trip category by the usual category's normalized name, or creates it at the end with the usual category's icon. It then skips the row if it's already on the trip (identity in Global Constraints, checked server-side). Otherwise it appends the item to the end of its trip category with `is_packed=false`.
    - It returns `{"added": int, "skipped": int}`.
  - `seed_trip_categories_from_usual(p_trip_id uuid) returns void`:
    - It requires the caller to be the trip owner (`is_trip_owner`).
    - It does nothing if the trip already has categories.
    - If the caller's list has categories, it copies them (name, icon, sort_order). Otherwise it calls `ensure_default_packing_categories(p_trip_id)`.

- [ ] **Step 1: Write the migration** (tables, indexes, RLS policies for select/insert/update/delete, helper, RPCs, grants).
- [ ] **Step 2: Hand it to the user to apply, following the migration order (non-prod first),** with these SQL checks (run as a signed-in user through the app's SQL editor role or `set request.jwt.claims`):
  - 5.1 `select get_or_create_my_usual_list();` twice → the same uuid.
  - 5.2 `select add_to_my_usual_stuff('[{"title":"Toothbrush","quantity":1,"category_name":"Toiletries","category_icon":"sparkles","person_label":"Noa"},{"title":"Toothbrush","quantity":1,"category_name":"Toiletries","category_icon":"sparkles","person_label":"Dan"}]');` → `added: 2`.
  - 5.3 Repeat 5.2 → `added: 0`, with 2 entries in `skipped`.
  - 5.4 Repeat with `" toothbrush "` / `"toiletries"` → skipped. No new category is created.
  - 5.5 `add_usual_items_to_trip` on a test trip with Noa's toothbrush mapped to the Noa participant → `added: 1`. Running it again → `skipped: 1`.
  - 5.6 Insert the same item directly into `packing_items`, then call `add_usual_items_to_trip` for it → `skipped`, not duplicated.
  - 5.7 `seed_trip_categories_from_usual` on a trip with no categories → it copies the user's categories. With an empty list → the four fixed categories with icons.
- [ ] **Step 3: Wait for the user to confirm that 5.1–5.7 pass in non-prod and that down-then-up works, then commit** `feat(db): usual stuff tables and RPCs` (both files).

### Task 6: Usual stuff client queries and types

**Files:**
- Create: `lib/usual-stuff/types.ts`, `lib/usual-stuff/queries.ts`

**Interfaces:**
- Consumes: the Task 5 tables and RPCs.
- Produces:
  ```ts
  // types.ts
  export type UsualCategory = { id: string; list_id: string; name: string; icon: string | null; sort_order: number };
  export type UsualItem = { id: string; list_id: string; category_id: string; title: string; quantity: number; person_label: string | null; is_always: boolean; sort_order: number; created_at: string };
  export type UsualRowInput = { title: string; quantity: number; category_name: string; category_icon: string | null; person_label: string | null };
  // queries.ts
  export async function loadMyUsualStuff(s: SupabaseClient): Promise<{ listId: string; categories: UsualCategory[]; items: UsualItem[] }>;
  export async function addToMyUsualStuff(s: SupabaseClient, rows: UsualRowInput[]): Promise<{ added: number; skipped: { index: number; usual_item_id: string }[] }>;
  export async function addUsualItemsToTrip(s: SupabaseClient, tripId: string, rows: { usual_item_id: string; participant_id: string | null }[]): Promise<{ added: number; skipped: number }>;
  export async function updateUsualItem(s: SupabaseClient, id: string, patch: Partial<Pick<UsualItem, "title" | "quantity" | "category_id" | "person_label" | "is_always">>): Promise<void>;
  export async function deleteUsualItem(s: SupabaseClient, id: string): Promise<void>;
  export async function insertUsualItem(s: SupabaseClient, listId: string, item: Pick<UsualItem, "category_id" | "title" | "quantity" | "person_label" | "is_always">): Promise<UsualItem>; // sort_order = max in category + 1
  export async function reorderUsualItems(s: SupabaseClient, categoryId: string, ids: string[]): Promise<void>;
  export async function reorderUsualCategories(s: SupabaseClient, ids: string[]): Promise<void>;
  export async function deleteUsualCategory(s: SupabaseClient, id: string, moveTo: string | null): Promise<void>;
  export async function upsertUsualCategory(s: SupabaseClient, listId: string, c: { id?: string; name: string; icon: string }): Promise<UsualCategory>;
  export function sameName(a: string, b: string): boolean; // lower(trim) equality, used by every client-side match
  ```
  - All functions throw `Error(message)` on a Supabase error, the same as `lib/packing-templates/queries.ts`.
  - A unique-violation (`23505`) from `insertUsualItem` / `updateUsualItem` throws `Error("Already in your usual stuff")`.

- [ ] **Step 1: Write both files.**
- [ ] **Step 2: Verify** that `npm run lint && npm run build` pass. These functions are exercised by Tasks 7–11.
- [ ] **Step 3: Commit** `feat(usual-stuff): client queries and types`.

### Task 7: Usual stuff page

**Files:**
- Create: `app/dashboard/usual-stuff/page.tsx`, `components/usual-stuff/usual-stuff-page.tsx`, `components/usual-stuff/manage-usual-categories-dialog.tsx`
- Modify: `components/dashboard/dashboard-sidebar.tsx` (add a "My usual stuff" link under Home, lucide `Luggage`, active when the path starts with `/dashboard/usual-stuff`)

**Interfaces:**
- Consumes: Task 6 queries, and `CategoryManagerList` (Task 3).
- Produces: route `/dashboard/usual-stuff`.

- [ ] **Step 1: The page** loads `loadMyUsualStuff`. It shows categories in order (icon + name), with each item row showing:
  - a ★ toggle (`is_always`),
  - the title with ` ×N` when N > 1,
  - a person chip (`person_label ?? "Everyone"`).
  - Tapping a row opens an inline editor (title, quantity, category select, and a person text input with an "Everyone" option when empty), with Save, Delete (with a confirm) and Cancel.
  - "+ Add item" opens the same editor.
- [ ] **Step 2: Drag-reorder items within a category** using `reorderUsualItems`, with the same dnd-kit pattern as the packing list. Moving to another category also goes through `reorderUsualItems` with the destination id.
- [ ] **Step 3: "Manage categories"** opens `manage-usual-categories-dialog.tsx`, which wraps `CategoryManagerList` with the usual-stuff callbacks.
- [ ] **Step 4: Empty state** (no items and no categories): show the text from the wireframe and two buttons, "Start from a trip or template" (wired in Task 9; until then it can be hidden) and "+ Add item".
- [ ] **Step 5: Verify.** Run lint and build. Then check:
  - 7.1 The sidebar link opens the page.
  - 7.2 Add, edit, star, delete, then reload: everything persists.
  - 7.3 Adding a duplicate (same title, category and person) shows "Already in your usual stuff".
  - 7.4 Reordering categories and items persists.
  - 7.5 A safe delete of a usual-stuff category works the same as Task 3.
- [ ] **Step 6: Commit** `feat(usual-stuff): usual stuff page`.

### Task 8: Picker and "+ From usual stuff" on the trip page

**Files:**
- Create: `components/usual-stuff/usual-stuff-picker.tsx`, `components/usual-stuff/add-from-usual-stuff-dialog.tsx`, `lib/usual-stuff/match.ts`
- Modify: `components/packing/packing-list.tsx` (button next to "Add item", editors only)

**Interfaces:**
- Produces:
  ```ts
  // match.ts
  export function suggestParticipantId(label: string, participants: PackingParticipant[]): string | null; // sameName match or null
  export type WhoChoice = { kind: "participant"; id: string } | { kind: "everyone" } | { kind: "skip" } | { kind: "unset" };
  // usual-stuff-picker.tsx: presentational, reused by Task 9
  export type PickerItem = { key: string; title: string; quantity: number; categoryName: string; categoryIcon: string | null; personLabel: string | null; preselected: boolean; disabledReason?: string };
  export interface UsualStuffPickerProps {
    items: PickerItem[];                              // already in display order
    who?: { participants: PackingParticipant[] };    // present → render who's-who rows
    isDisabled?: (item: PickerItem, who: Record<string, WhoChoice>) => string | undefined; // re-evaluated on who change
    confirmLabel: (count: number) => string;          // "Add 5 items"
    onConfirm(selected: PickerItem[], who: Record<string, WhoChoice>): Promise<void>;
    onCancel(): void;
  }
  ```
  `who` is keyed by the normalized person label.

- [ ] **Step 1: Build `UsualStuffPicker` (§4.4, wireframe 3).**
  - Group items by `categoryName`. A tri-state category header checkbox shows "k of n".
  - Item checkboxes start from `preselected`. Disabled items are greyed out, show their `disabledReason`, and are never counted.
  - The who's-who block lists each distinct non-null `personLabel` among the *selected* items, as "<Label>'s items go to: [select]". Its choices are each participant, "Everyone (shared)" and "Don't add their items".
  - The initial choice is `suggestParticipantId(...)` when it matches. Otherwise it's `unset`: the select shows "Choose…" and the row is highlighted.
  - The confirm button is disabled when the count is 0 **or any who's-who row is `unset`**. A hint under the button says "Choose who gets <Label>'s items".
- [ ] **Step 2: `AddFromUsualStuffDialog`** loads `loadMyUsualStuff` and maps items to `PickerItem` (with `preselected = is_always`).
  - `isDisabled` returns `"already on this trip"` when the trip already has an item with the same normalized title, in a category whose name matches, for the resolved participant (Global Constraints).
  - On confirm it drops items whose person is "skip", calls `addUsualItemsToTrip`, then `onRefresh()`, and sets the banner to `Added N items` (adding `, K already there` when K > 0).
  - When usual stuff is empty, show a link to `/dashboard/usual-stuff` instead of the picker.
- [ ] **Step 3: Add the "+ From usual stuff" button** next to "Add item" for editors.
- [ ] **Step 4: Verify.** Run lint and build. Then check:
  - 8.1 ★ items start ticked, and the rest start unticked.
  - 8.2 Ticking a category header selects all of its items. The partial count is correct.
  - 8.3 With a participant named Noa, the Noa row is pre-filled. Changing it to Dan puts the items on Dan.
  - 8.4 Items already on the trip are greyed out. Changing a who's-who row updates which items are greyed out.
  - 8.5 On a trip with 0 participants, or for a label with no match: the row starts at "Choose…", Add is disabled until you choose, and after choosing Everyone or Don't add, adding works. Nothing is ever put on Everyone without a choice (Review Focus 3).
  - 8.6 Added items appear at the end of their category in usual-stuff order. A missing category is created at the end with its icon.
- [ ] **Step 5: Commit** `feat(packing): add items from usual stuff with who's-who matching`.

### Task 9: First-time start from a trip or template

**Files:**
- Create: `components/usual-stuff/start-usual-stuff-dialog.tsx`
- Modify: `components/usual-stuff/usual-stuff-page.tsx` (enable the empty-state button)

**Interfaces:**
- Consumes: `UsualStuffPicker` (without `who`), `addToMyUsualStuff`, and `lib/packing-templates/queries.ts` (existing read functions for listing templates and their items).

- [ ] **Step 1: Source step.** List the user's templates (name), then their trips (title + dates), loaded with `supabase.from("trips")` the same way the sidebar loads them. Picking one loads its items into `PickerItem`s:
  - **Template:** `categoryName = category?.trim() || "Other"`, `categoryIcon = null`, `personLabel = assigned_to?.trim() || null`, order = `created_at`, then `id`.
  - **Trip:** `categoryName` and icon come from its category, `personLabel` is the participant's name or null, and the order is category `sort_order` then item `sort_order`.
  - All items start ticked (call: it's a one-time import, so keeping everything is the common case).
- [ ] **Step 2: On confirm,** map the selection to `UsualRowInput[]` (`category_icon` defaults to `luggage` when null), call `addToMyUsualStuff`, reload the page, and show `Added N items`.
- [ ] **Step 3: Verify.** Run lint and build. Then check:
  - 9.1 Start from a template: the chosen items appear with their categories and person labels.
  - 9.2 Start from a trip: the icons and order carry over.
  - 9.3 Running it again from the same source adds 0 (everything is skipped).
- [ ] **Step 4: Commit** `feat(usual-stuff): build usual stuff from a trip or template`.

### Task 10: "Add to my usual stuff" from a trip

**Files:**
- Modify: `components/packing/packing-list.tsx` (inline item editor; category group header in category view)

**Interfaces:**
- Consumes: `addToMyUsualStuff`, `updateUsualItem` (Task 6).
- Deviation from the spec: the spec assumed existing "⋯" menus, but rows and headers have none today. **Call:** put a text button "Add to my usual stuff" inside the existing inline item editor, and a small icon button (lucide `BookmarkPlus`, `aria-label="Add category to my usual stuff"`) in the category group header, for editors only.

- [ ] **Step 1: Single item.**
  - Build a `UsualRowInput` from the item: title, quantity, the category's name and icon, and `person_label` = the participant's name or null.
  - If `added === 1`, the banner says `Added to your usual stuff`.
  - If it was skipped, show an inline prompt in the editor: "Already in your usual stuff. Update quantity to N?", with **Update** (`updateUsualItem(id, { quantity })`) and **Keep**. The ★ is never changed.
- [ ] **Step 2: Whole category.** Send all of the category's items in display order. The banner says `Added A items, S were already there` (leave out the second part when S = 0).
- [ ] **Step 3: Verify.** Run lint and build. Then check:
  - 10.1 Add a new item: it appears on the usual-stuff page at the end of its category, with the right person label.
  - 10.2 Add it again: the prompt appears, and Update changes only the quantity.
  - 10.3 Add a category whose name doesn't exist in usual stuff: the category is created with its icon.
  - 10.4 An item that differs only by case or spacing is reported as already there (Review Focus 2).
- [ ] **Step 4: Commit** `feat(packing): add trip items and categories to usual stuff`.

### Task 11: New trips start with the creator's categories

**Files:**
- Modify: `components/trips/trip-form-modal.tsx:723-740` (after a successful `trips` insert, in create mode only)

**Interfaces:**
- Consumes: `seed_trip_categories_from_usual` (Task 5). `ensure_default_packing_categories` stays on the packing page as the fallback, unchanged.

- [ ] **Step 1: After the insert succeeds,** call `await supabase.rpc("seed_trip_categories_from_usual", { p_trip_id: tripId })`. If it fails, `console.error` and continue: trip creation must not fail because of seeding, and the packing page fallback still seeds.
- [ ] **Step 2: Verify.** Run lint and build. Then check:
  - 11.1 Create a trip while having usual-stuff categories: the packing page shows your categories, in order, with icons, all empty.
  - 11.2 With empty usual stuff: the four fixed categories with icons.
  - 11.3 An existing trip that already has categories is unchanged.
- [ ] **Step 3: Commit** `feat(trips): seed new trip packing categories from usual stuff`.

### Task 12: Retire templates from the UI

**Files:**
- Modify: `components/packing/manage-packing-list-dialog.tsx` (remove the `import`, `save-new`, `add-to-existing` and `manage` views and their menu buttons; keep "delete all")
- Modify: `components/packing/packing-list.tsx:812-818` (rename the button "Manage packing lists" to "Manage packing list")
- Delete: `components/packing/packing-templates-dialog.tsx`, if nothing else imports it after Task 9. Keep `lib/packing-templates/queries.ts` (Task 9 reads from it). Remove any export that's now unused.

- [ ] **Step 1: Make the edits.** Confirm with a search that nothing still imports the removed code: Grep for `packing-templates-dialog`, `importTemplateToTrip` and `PackingTemplatesPanel`.
- [ ] **Step 2: Verify.** Run lint and build. Then check:
  - 12.1 No template option appears anywhere in the packing UI.
  - 12.2 "Delete all items" still works.
  - 12.3 The first-time start still lists templates.
  - 12.4 The template rows still exist in the DB (`select count(*) from packing_template_items;` is unchanged).
- [ ] **Step 3: Commit** `feat(packing): retire templates from the UI`, then close Beads issue `away-we-go-nxh.2` as obsolete.

---

**Milestone 1 ship order (required):** (1) production backup, (2) apply the Task 1 migration to production and run the read-only checks, (3) only then merge to `main`. The Task 2/3 code calls the new RPCs; without the migration, drag-reorder, cross-category drag and ANY category delete (even an empty one) fail. Rollback order is the reverse: revert the code first, then run the down script.

**Shipping:** see Milestones. The user decides when each milestone reaches `main` and when each migration reaches production.
