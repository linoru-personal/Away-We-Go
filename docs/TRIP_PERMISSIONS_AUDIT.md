# Trip Permissions Implementation — Audit Report

Audit of the current trip permissions implementation before moving to application/UI changes. **No code was changed.**

---

## 1. Confirmed correct areas

### Tables and RLS (final state after all migrations)

| Area | Status |
|------|--------|
| **trips** | Select: `has_trip_access(id)`. Insert: `user_id = auth.uid()`. Update: `can_edit_trip_metadata(id)` (Phase 3). Delete: `is_trip_owner(id)` — **owner-only, correct.** |
| **trip_members** | Select: `has_trip_access(trip_id)`. Insert/update/delete: `can_manage_trip_sharing(trip_id)` (Phase 3). |
| **trip_participants** | Select: `has_trip_access(trip_id)`. Insert/update/delete: `can_edit_trip_metadata(trip_id)` (Phase 3). |
| **tasks** | Select: `has_trip_access(trip_id)`. Insert/update/delete: `can_edit_trip_content(trip_id)` (Phase 4). |
| **trip_notes** | Select: `has_trip_access(trip_id)`. Insert/update/delete: `can_edit_trip_content(trip_id)` (Phase 4). |
| **trip_places** | Select: `has_trip_access(trip_id)`. Insert/update/delete: `can_edit_trip_content(trip_id)` (Phase 4). |
| **trip_place_categories** | Select: `has_trip_access(trip_id)`. Insert/update/delete: `can_edit_trip_content(trip_id)` (Phase 4). |
| **trip_photos** | Select: `has_trip_access(trip_id)`. Insert/update/delete: `can_edit_trip_content(trip_id)` (Phase 4). |
| **trip_budget_categories** | Select: `has_trip_access(trip_id)`. Insert/update/delete: `can_edit_trip_content(trip_id)` (Phase 4). |
| **trip_budget_items** | Select: `has_trip_access(trip_id)`. Insert/update/delete: `can_edit_trip_content(trip_id)` (Phase 4). |
| **trip_currencies** | Select: `has_trip_access(trip_id)`. Insert/update/delete: `can_edit_trip_content(trip_id)` (Phase 4). |
| **trip_exchange_rates** | Select: `has_trip_access(trip_id)`. Insert/update/delete: `can_edit_trip_content(trip_id)` (Phase 4). |
| **packing_categories** | Select: `has_trip_access(trip_id)`. Insert/update/delete: `can_edit_trip_content(trip_id)` (Phase 5). |
| **packing_items** | Select: `has_trip_access(trip_id)`. Insert/update/delete: `can_edit_trip_content(trip_id)` (Phase 5). |

No table write policy in the **final** state relies on `has_trip_access` for insert/update/delete; Phase 3/4/5 replaced them with the role-aware helpers.

### Storage policies (final state)

| Bucket | Select | Insert/update/delete |
|--------|--------|----------------------|
| **trip-notes** | `has_trip_access` (first path segment) — from original migration, not dropped in Phase 4 | `can_edit_trip_content` (Phase 4). |
| **trip-photos** | `has_trip_access` — not dropped | `can_edit_trip_content` (Phase 4). |
| **trip-covers** | `has_trip_access` — not dropped | `can_edit_trip_metadata` (Phase 4). |
| **avatars** | `has_trip_access` — not dropped | `can_edit_trip_metadata` (Phase 4). |

Path assumption: first folder segment is `trip_id` (`(storage.foldername(name))[1]::uuid`). Matches app usage (trip_id/filename or trip_id/participant_id, etc.). Safe and consistent.

### Helper functions

- **is_trip_owner(p_trip_id)** — owner only; used for trip delete and inside other helpers.
- **has_trip_access(p_trip_id)** — owner or any member; used for all selects and RPC guards.
- **can_manage_trip_sharing(p_trip_id)** — owner or admin; used for trip_members and (when RPCs updated) sharing.
- **can_edit_trip_metadata(p_trip_id)** — owner or admin; used for trips update, trip_participants, covers, avatars.
- **can_edit_trip_content(p_trip_id)** — owner, admin, or editor; used for all content tables and content storage.

All are `security definer`, `set search_path = public`, and granted to `authenticated`. Logic matches the intended model.

### Packing RPC

- **ensure_default_packing_categories(p_trip_id)** — Requires `has_trip_access` then `can_edit_trip_content`; only then inserts defaults. Viewers get a no-op. Correct.

### Tracked migrations and RLS coverage

- Every trip-related table the app uses (trips, trip_members, trip_participants, tasks, trip_notes, trip_places, trip_place_categories, trip_photos, trip_budget_*, trip_currencies, trip_exchange_rates, packing_categories, packing_items) has a migration and RLS enabled with the correct policy set. **profiles** is non–trip-scoped and is out of scope.

---

## 2. Remaining risks

### RPCs still use owner-only checks (inconsistency with intended model)

| RPC | Current behavior | Intended behavior |
|-----|------------------|--------------------|
| **share_trip(p_trip_id, p_email)** | Guards with `is_trip_owner(p_trip_id)`. Inserts into `trip_members` without `role` (so default `viewer` is used). | Should allow **can_manage_trip_sharing(p_trip_id)** so admins can add members. Optionally accept a role argument (default `viewer`). |
| **unshare_trip(p_trip_id, p_user_id)** | Guards with `is_trip_owner(p_trip_id)`. | Should allow **can_manage_trip_sharing(p_trip_id)** so admins can remove members. |
| **get_trip_members(p_trip_id)** | Returns rows only when `is_trip_owner(p_trip_id)`; returns `(user_id, email)` — **no role**. | Should allow callers with **can_manage_trip_sharing(p_trip_id)** to get the list (so admins can manage sharing). Return **role** in the result so the app can show and change roles. |

**Risk:** Admins cannot add/remove members or see the member list until these RPCs are updated. UI that assumes “only owner sees share panel” will hide it from admins even though RLS allows them to mutate `trip_members`.

### App-visible behavior after RLS (no app changes yet)

- **Viewers:** RLS correctly blocks insert/update/delete on all content and metadata. The app still shows add/edit/delete controls; viewers will get **runtime errors** (e.g. 403 or Supabase RLS denial) when they try to act. No silent data corruption; UX is broken until the UI hides or disables those controls for viewers.
- **Editors:** Can edit content but not trip metadata or sharing. If the app shows “Edit trip” or “Share” to editors, some actions will fail at the DB (correct). UI should hide or disable metadata/sharing for non–owner/admin.
- **Admins:** Can manage sharing at the DB level, but **get_trip_members** returns no rows for them, so the share UI cannot show the member list. **share_trip** / **unshare_trip** will return “Not allowed” for admins until RPCs are updated.

### No regression identified

- Trip delete remains owner-only (`trips_delete` unchanged).
- Select policies were not dropped; all remain `has_trip_access` where intended.
- Phase 4 only replaced insert/update/delete policies; storage select policies are untouched.

---

## 3. Exact recommended fixes before moving to app/UI

### 3.1 Update sharing RPCs (one migration)

**File (suggested):** `supabase/migrations/20260222190600_share_rpc_role_aware.sql`

1. **share_trip**
   - Replace `if not public.is_trip_owner(p_trip_id)` with `if not public.can_manage_trip_sharing(p_trip_id)`.
   - Optionally add parameter `p_role text default 'viewer'` and validate `p_role in ('admin','editor','viewer')`; insert `(trip_id, user_id, role)` with that value. If omitted, keep current behavior (table default `viewer`).

2. **unshare_trip**
   - Replace `if not public.is_trip_owner(p_trip_id)` with `if not public.can_manage_trip_sharing(p_trip_id)`.

3. **get_trip_members**
   - Replace `and public.is_trip_owner(p_trip_id)` with `and public.can_manage_trip_sharing(p_trip_id)` so owner or admin can see the list.
   - Add **role** to the return: e.g. `returns table(user_id uuid, email text, role text)` and select `m.user_id, u.email::text, m.role` so the app can display and gate UI by role.

After this, admins can add/remove members and see the list; the app can use `role` for UI gating.

### 3.2 No other DB/storage changes required

- All table and storage policies are consistent with the intended model.
- No write policy still relies on overly broad `has_trip_access` in the final state.
- No storage path assumptions are unsafe or mismatched.
- All trip-related tables have tracked migrations and RLS.

---

## 4. Summary

| Check | Result |
|-------|--------|
| Any write policy still uses `has_trip_access` only? | **No** (Phase 3/4/5 replaced them). |
| Any table/storage inconsistent with intended model? | **No** (only sharing RPCs are owner-only). |
| Any RPC bypasses or assumes old binary model? | **Yes** — share_trip, unshare_trip, get_trip_members still use `is_trip_owner` and get_trip_members does not return role. |
| Storage path assumptions safe? | **Yes** (first segment = trip_id everywhere). |
| App-visible breakage from new RLS? | **Expected:** viewers get errors on write; admins get “Not allowed” and empty member list until RPCs + UI updated. |
| Any trip table without migration or RLS? | **No.** |
| New policies internally consistent and safe? | **Yes.** |

**Recommended fix:** Add one migration that updates **share_trip**, **unshare_trip**, and **get_trip_members** to use **can_manage_trip_sharing** and (for get_trip_members) return **role**. Then proceed to app/UI changes (role-based visibility and gating).
