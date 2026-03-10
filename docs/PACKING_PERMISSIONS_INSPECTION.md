# Packing Feature – Permissions Inspection (Trip Permissions Redesign)

This document inspects the packing feature and specifies how to include it in the trip permissions redesign. **No code was changed**; this is analysis and a change spec only.

---

## 1. Current packing architecture

### 1.1 Tables (inferred from app usage; not in migrations)

| Table | Columns (from code) | FK / notes |
|-------|---------------------|------------|
| **packing_categories** | id, trip_id, name, icon, sort_order | trip_id → trips(id) |
| **packing_items** | id, trip_id, category_id, title, quantity, is_packed, assigned_to_participant_id | trip_id → trips(id), category_id → packing_categories(id), assigned_to_participant_id → trip_participants(id) |

### 1.2 RPCs

| RPC | Args | Usage |
|-----|------|--------|
| **ensure_default_packing_categories** | p_trip_id (uuid) | Called once when loading the packing page to ensure default categories exist for the trip. Not defined in any migration. |

### 1.3 Queries (Supabase client)

- **packing_categories**: `select` (by trip_id, ordered by sort_order, name); `insert` (trip_id, name, icon, sort_order); `update` (name, icon by id + trip_id); `delete` (by id, trip_id).
- **packing_items**: `select` (by trip_id); `insert` (trip_id, category_id, title, quantity, is_packed, assigned_to_participant_id); `update` (is_packed, or title/quantity/category_id/assigned_to_participant_id when editing); `delete` (by id). One bulk `update` in ManagePackingCategoriesDialog: reassign items from a category to another before deleting the category.

All app queries scope by `trip_id` (e.g. `.eq("trip_id", id)`). The database does not enforce this unless RLS is in place.

### 1.4 UI components and routes

| Location | Purpose |
|----------|---------|
| **app/dashboard/trip/[id]/packing/page.tsx** | Packing page: loads trip, calls `ensure_default_packing_categories`, fetches categories + items + participants, renders TripHero + PackingList. |
| **components/packing/packing-list.tsx** | Main list: view by category/participant, filters, add item, toggle packed, edit item, delete item, “Manage Categories” → ManagePackingCategoriesDialog. |
| **components/packing/manage-packing-categories-dialog.tsx** | Add/edit/delete packing categories; reassign items when deleting a category. |
| **components/packing/packing-summary-card.tsx** | Dashboard card: reads packing_items by trip_id, shows progress and sample items, links to `/dashboard/trip/[id]/packing`. |
| **components/trip/trip-dashboard-summary-strip.tsx** | Aggregates packing_items (packed/total) for the strip on the trip dashboard. |

There is **no** UI gating by role (viewer vs editor): every user who can open the trip can see and use all packing actions. Role-based gating will be part of the broader trip permissions redesign.

---

## 2. Migrations vs live database

- **Packing tables and RPC are not in the repository migrations.**  
  There is no `supabase/migrations/*.sql` file that creates `packing_categories`, `packing_items`, or `ensure_default_packing_categories`. Other trip content (tasks, trip_notes, trip_budget_*, trip_places) is created and secured in migrations.

- **Conclusion:** Packing schema and RPC exist only in the live database (or were created outside the tracked migrations). To bring packing into the redesign and under version control, migrations must be added that define the schema, RLS, and RPC.

---

## 3. Current RLS on packing

- **In the codebase:** There are no RLS policies for packing. No migration enables RLS or creates policies on `packing_categories` or `packing_items`.

- **In the live DB:** Unknown from code alone. If RLS was never added, then:
  - Any authenticated user could read/insert/update/delete any row in these tables (if they know table names and row IDs), i.e. no trip scoping at the DB level.
  - If RLS was added manually, it may or may not match the desired model (e.g. may use `has_trip_access` for all operations, with no viewer vs editor distinction).

- **Conclusion:** Treat packing as having **no RLS in source control**. The redesign should add a migration that enables RLS and defines policies that align with the desired owner/admin/editor/viewer model.

---

## 4. trip_id scoping

- **App:** All packing queries and the RPC call use `trip_id` (page uses `id` from route params). Scoping is correct in the UI and client calls.

- **Database:** Without RLS (or with permissive policies), the DB does not enforce that a user may only see or change packing for trips they can access. So:
  - A user could call the API/Supabase client with another trip’s IDs and potentially read or mutate that trip’s packing data if no RLS blocks it.

- **Conclusion:** Packing must be scoped by `trip_id` in RLS using the same access helpers as other trip content (e.g. `has_trip_access`, and for mutations a “can edit trip content” predicate once roles exist).

---

## 5. Viewer edit risk and permission gaps

- **Current trip_members model:** The schema has no role column. `trip_members` is (trip_id, user_id). Access is binary: either you have `has_trip_access` (owner or member) or you don’t. So today there is no “viewer” vs “editor” in the DB; the app does not restrict packing (or other content) by role.

- **Risks if packing stays as-is when roles are introduced:**
  - If RLS is added for packing using only `has_trip_access` for select/insert/update/delete (like current trip_notes/tasks pattern), then **viewers would still be able to edit packing** until a role-aware helper is used.
  - If packing has no RLS, viewers could edit packing from the client (and possibly from direct API access) until both RLS and UI are updated.

- **Desired model (from context):**
  - **owner:** full access; only owner can delete the trip.
  - **admin:** manage sharing/permissions and edit trip content.
  - **editor:** edit trip content.
  - **viewer:** read-only.

- **Gap:** Packing is trip content but is not yet covered by any role-aware RLS or UI. To align packing with the rest of the trip:
  - **Select:** allowed for anyone with `has_trip_access` (owner + any member with any role).
  - **Insert/update/delete:** allowed only for roles that may edit content (owner, admin, editor); denied for viewer.

---

## 6. Exact schema / RLS / RPC changes needed

The following should be implemented in migrations (and, where noted, in app code) as part of the trip permissions redesign. Do not change code yet; this is the spec.

### 6.1 Schema migration (create packing tables if missing)

Add a migration that creates packing tables and structure to match current app usage. Example (adjust if live schema differs):

```sql
-- Packing: categories and items, trip-scoped. RLS added in same or follow-up migration.

-- packing_categories
create table if not exists public.packing_categories (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null,
  icon text,
  sort_order integer not null default 0
);
create index if not exists idx_packing_categories_trip_id on public.packing_categories(trip_id);

-- packing_items
create table if not exists public.packing_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  category_id uuid not null references public.packing_categories(id) on delete cascade,
  title text not null,
  quantity integer not null default 1,
  is_packed boolean not null default false,
  assigned_to_participant_id uuid references public.trip_participants(id) on delete set null
);
create index if not exists idx_packing_items_trip_id on public.packing_items(trip_id);
create index if not exists idx_packing_items_category_id on public.packing_items(category_id);
```

- If the redesign introduces `trip_members.role` (e.g. owner/admin/editor/viewer) in an earlier migration, this migration should assume that and the RLS below should use the new helper.

### 6.2 RLS migration (packing as trip content, role-aware)

Assume a helper exists that encodes “can edit trip content” (e.g. owner, admin, or editor; not viewer). In the existing codebase the pattern is `has_trip_access(trip_id)` for all operations; the redesign will introduce something like `can_edit_trip_content(p_trip_id uuid)` so that:

- **Select:** `has_trip_access(trip_id)` (viewer can read).
- **Insert / update / delete:** `can_edit_trip_content(trip_id)` (only owner/admin/editor).

Concrete steps:

1. **Enable RLS** on both tables (if not already):
   - `alter table public.packing_categories enable row level security;`
   - `alter table public.packing_items enable row level security;`

2. **Policies for packing_categories** (replace or create; use same naming pattern as trip_notes/trip_budget):

   - **Select:** `using (public.has_trip_access(trip_id))`
   - **Insert:** `with check (public.can_edit_trip_content(trip_id))`  -- or `has_trip_access` until `can_edit_trip_content` exists
   - **Update:** `using (public.can_edit_trip_content(trip_id))`
   - **Delete:** `using (public.can_edit_trip_content(trip_id))`

3. **Policies for packing_items** (same idea):

   - **Select:** `using (public.has_trip_access(trip_id))`
   - **Insert:** `with check (public.can_edit_trip_content(trip_id))`
   - **Update:** `using (public.can_edit_trip_content(trip_id))`
   - **Delete:** `using (public.can_edit_trip_content(trip_id))`

If the redesign is done in phases, a first step can use `has_trip_access` for all four operations (matching current tasks/notes), then a second migration can tighten insert/update/delete to `can_edit_trip_content` once that function and `trip_members.role` exist.

### 6.3 RPC: ensure_default_packing_categories

- **Define in a migration** (currently not in repo). Signature used by app: `ensure_default_packing_categories(p_trip_id uuid)`.
- **Behavior:** Create default categories for the trip if none exist. Should only run for users who are allowed to “edit” packing (i.e. create categories); so inside the RPC, enforce access, e.g.:
  - `if not public.has_trip_access(p_trip_id) then return;` (or raise), and optionally
  - `if not public.can_edit_trip_content(p_trip_id) then return;` once that helper exists, so viewers cannot create default categories.
- Use `security definer` and `set search_path = public` so the function runs with definer rights and only performs the intended inserts for `p_trip_id`.
- **Grants:** `grant execute on function public.ensure_default_packing_categories(uuid) to authenticated;`

This way packing is treated as trip content: same permission model as tasks, notes, places, budget, and photos, and viewers cannot create or modify packing data.

### 6.4 App (UI) changes (for the redesign, not in this inspection)

- Once `can_edit_trip_content` (or equivalent) is available on the client (e.g. via trip member role or a small API), the packing UI should:
  - **Viewer:** Hide or disable add/edit/delete/toggle for packing (list and categories). Show read-only list and progress.
  - **Editor / admin / owner:** Show full packing UI as today.

No UI changes were made in this inspection; the above is the target behavior.

---

## 7. Summary

| Item | Status |
|------|--------|
| Packing tables in migrations | ❌ Missing; add schema migration |
| Packing RLS in migrations | ❌ Missing; add RLS with has_trip_access + can_edit_trip_content |
| Packing RPC in migrations | ❌ ensure_default_packing_categories not in repo; add with access check |
| trip_id scoping in app | ✅ All queries use trip_id |
| trip_id scoping in DB | ❌ Not enforced until RLS is added |
| Viewer can edit packing today | ⚠️ No role in DB yet; once roles exist, viewers could edit unless RLS/UI restrict |
| Align packing with trip content permissions | Add schema + RLS + RPC migrations; use can_edit_trip_content for mutations; then gate UI by role |

This completes the packing inspection and the exact schema/RLS/RPC changes needed to include packing in the trip permissions redesign.
