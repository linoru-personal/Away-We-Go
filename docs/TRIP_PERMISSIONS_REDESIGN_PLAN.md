# Trip Sharing & Permissions Redesign – Implementation Plan

Concise plan for roles (admin, editor, viewer), permission helpers, RLS updates, packing inclusion, and invitations. **No code written**; implementation order only.

---

## Confirmed constraints

- Supabase is the source of truth; dev and prod use the same Supabase project.
- Trip owner remains `trips.user_id`; only the owner can delete a trip.
- Three member roles: **admin** (manage sharing + permissions), **editor** (edit trip content), **viewer** (read-only).
- Packing follows the same content-permission model as tasks, notes, places, budget, and photos.

---

## Current known issues

- **trip_members** has no role column; all members are effectively equivalent.
- Sharing works only for existing auth users (no pending invitations or email flow).
- No **trip_invitations** table.
- **trips_update** is too permissive: uses `has_trip_access(id)` so any member can change title/dates/cover.
- Delete is owner-only in DB but UI is not fully aligned (e.g. delete button visibility).
- Packing exists in the app but is not fully defined in migrations/RLS; no RLS on packing tables.

---

## 1. Recommended schema changes

- **trip_members:** Add a single column: `role text not null default 'editor'` with `check (role in ('admin','editor','viewer'))`. Keep existing columns and PK.
- **No other table changes** for permissions. Owner remains `trips.user_id`; no separate owner row in `trip_members`.

**Rationale:** Minimal change set. A single role column gives three distinct permission levels without a new table or junction model. Default `editor` keeps existing members behaving as they do today.

---

## 2. trip_members and role column

**Yes – add a `role` column to `trip_members`.**

- Values: `admin`, `editor`, `viewer` (no `owner` in members; owner is only `trips.user_id`).
- Default new members to `editor` for backward compatibility; existing rows get `editor` via migration.
- One row per (trip_id, user_id); role is the only new column.

**Rationale:** Owner is already represented by `trips.user_id`; duplicating it in `trip_members` would complicate RLS and app logic. Storing only member roles keeps a single source of truth for “who owns” and lets RLS express “owner or member with role X” clearly.

---

## 3. Separate trip_invitations table

**Not in the initial redesign.** Keep the “simplest robust” scope:

- **Current behavior:** Share by email via `share_trip(p_trip_id, p_email)`; if the user exists they are added as a member. No pending state.
- **Recommendation:** Keep this. Add an optional **Phase 7** (later) for `trip_invitations` if you want: pending invites by email, optional token/link, expiry, and role. For now, sharing = add existing user with a role (see RPC changes below).

**Rationale:** An invitations table implies sign-up flows, email delivery, and expiry—scope creep for the first cut. Fixing the permission model (roles + RLS) and packing first delivers secure sharing for existing users; invitations can follow once the base is stable.

---

## 4. Exact permission model

| Permission | Who has it | Notes |
|------------|------------|--------|
| **View trip** | Owner (`trips.user_id`) or any member (any role) | Same as current `has_trip_access`. |
| **Edit trip metadata** | Owner or admin | Title, dates, destination, cover, trip participants (who’s on the trip). |
| **Edit trip content** | Owner, admin, or editor | Tasks, notes, packing, budget, places, photos (tables + related storage). |
| **Manage sharing** | Owner or admin | Add/remove members, set/change member role. |
| **Delete trip** | Owner only | Unchanged; already enforced in RLS. |

Viewer: can only read trip and all content; no insert/update/delete on trip row, members, or content.

**Rationale:** Separating “edit metadata” (trip row, participants, cover) from “edit content” (tasks, notes, etc.) lets admins manage the trip setup without giving them a separate “content editor” role. Keeping delete as owner-only avoids accidental loss and aligns with “canonical owner” constraint.

---

## 5. Helper SQL functions to introduce

Keep existing helpers and add one new one:

| Function | Purpose |
|----------|---------|
| **is_trip_owner(p_trip_id)** | Existing. True iff `trips.user_id = auth.uid()`. |
| **has_trip_access(p_trip_id)** | Existing. True if owner or in `trip_members`. Used for “can see trip and content”. |
| **can_manage_trip_sharing(p_trip_id)** | **New.** True if owner or member with `role = 'admin'`. Use for: add/remove members, update member role. |
| **can_edit_trip_content(p_trip_id)** | **New.** True if owner or member with role in `('admin','editor')`. Use for all content table insert/update/delete and for content-related storage. |
| **can_edit_trip_metadata(p_trip_id)** | **New.** True if owner or admin. Use for `trips` update, `trip_participants` insert/update/delete, trip cover storage. |

Implement as `security definer`, `set search_path = public`, `stable`, and grant execute to `authenticated`. Suggested definitions:

- `can_manage_trip_sharing`: `is_trip_owner(p_trip_id) or exists (select 1 from trip_members where trip_id = p_trip_id and user_id = auth.uid() and role = 'admin')`
- `can_edit_trip_content`: `is_trip_owner(p_trip_id) or exists (select 1 from trip_members where trip_id = p_trip_id and user_id = auth.uid() and role in ('admin','editor'))`
- `can_edit_trip_metadata`: `is_trip_owner(p_trip_id) or exists (select 1 from trip_members where trip_id = p_trip_id and user_id = auth.uid() and role = 'admin')`

---

## 6. Existing RLS policies to change

Apply in a single migration (or two if you split helpers from policies) after the role column and helpers exist.

- **trips**
  - **Select:** Keep `has_trip_access(id)`.
  - **Insert:** Keep `user_id = auth.uid()`.
  - **Update:** Change to `can_edit_trip_metadata(id)` (today: `has_trip_access(id)`).
  - **Delete:** Keep `is_trip_owner(id)`.

- **trip_members**
  - **Select:** Keep `has_trip_access(trip_id)`.
  - **Insert:** Change to `can_manage_trip_sharing(trip_id)` (today: `is_trip_owner(trip_id)`).
  - **Update:** Add policy: allow update only for `can_manage_trip_sharing(trip_id)` (so admin/owner can change role). Optional: restrict updatable columns to `role` via a separate policy or application logic.
  - **Delete:** Change to `can_manage_trip_sharing(trip_id)` (today: `is_trip_owner(trip_id)`).

- **trip_participants**
  - **Select:** Keep `has_trip_access(trip_id)`.
  - **Insert / Update / Delete:** Change from `is_trip_owner(trip_id)` to `can_edit_trip_metadata(trip_id)` so admins can manage participants.

- **Content tables (tasks, trip_notes, trip_budget_categories, trip_budget_items, trip_places, trip_photos, trip_currencies, trip_exchange_rates, trip_place_categories)**
  - **Select:** Keep `has_trip_access(trip_id)`.
  - **Insert / Update / Delete:** Change from `has_trip_access(trip_id)` to `can_edit_trip_content(trip_id)`.

- **Storage buckets**
  - **trip-covers:** Keep select/insert/update/delete as owner-only, or relax to `can_edit_trip_metadata(trip_id)` if admins should change covers. Recommendation: use `can_edit_trip_metadata` for consistency.
  - **trip-notes, trip-photos:** Change insert/update/delete from `has_trip_access` to `can_edit_trip_content(trip_id)` (derive trip_id from path). Select stays `has_trip_access`.
  - **avatars:** Change insert/update/delete from `is_trip_owner` to `can_edit_trip_metadata(trip_id)`. Select stays `has_trip_access`.

---

## 7. Packing under the same model

- **Schema:** Add migration that creates `packing_categories` and `packing_items` (as in `docs/PACKING_PERMISSIONS_INSPECTION.md`) if they do not already exist in migrations.
- **RLS:** Enable RLS on both. Select: `has_trip_access(trip_id)`. Insert/update/delete: `can_edit_trip_content(trip_id)`.
- **RPC:** Add `ensure_default_packing_categories(p_trip_id)` with `security definer`; inside the function require `can_edit_trip_content(p_trip_id)` (and optionally `has_trip_access`) before creating default categories. Grant execute to `authenticated`.

Packing then matches tasks, notes, places, budget, and photos: viewers read-only; editors and above can edit.

---

## 8. Phased implementation plan (safest order)

| Phase | What | Why this order |
|-------|------|----------------|
| **1. Role column** | Migration: add `role` to `trip_members` with default `'editor'`; backfill existing rows to `'editor'`. | No behavior change yet; everything still works. |
| **2. Helpers** | Migration: add `can_manage_trip_sharing`, `can_edit_trip_content`, `can_edit_trip_metadata`; grant execute. | Policies will depend on these. |
| **3. RLS – trips & members** | Migration: update trips update to `can_edit_trip_metadata`; trip_members insert/delete to `can_manage_trip_sharing`; add trip_members update for role changes. | Core sharing and metadata; admins gain intended powers. |
| **4. RLS – content & storage** | Migration: all content tables and content-related storage: insert/update/delete use `can_edit_trip_content`; trip_participants and trip-covers/avatars use `can_edit_trip_metadata`. | Viewers become read-only; editors and admins can edit content. |
| **5. Packing** | Migration: create packing tables (if missing), RLS (select `has_trip_access`, mutate `can_edit_trip_content`), and `ensure_default_packing_categories` RPC. | Packing in version control and aligned with content model. |
| **6. RPCs & app** | Update `share_trip` to accept role (default `editor`); `unshare_trip` allowed for `can_manage_trip_sharing`; `get_trip_members` returns members + role (and still only for callers with `can_manage_trip_sharing` or for self). App: pass role when sharing; show/hide edit/delete UI by role. | API and UI match the new model. |
| **7. (Optional) Invitations** | Later: `trip_invitations` table, invite-by-email flow, optional token/link and expiry. | Out of scope for initial redesign. |

**Safest approach:** One migration per phase so you can deploy and verify each step. Run migrations against the same Supabase project used in dev and prod.

**Rationale for order:** (1) Role column first so all later code can assume it exists; (2) helpers before RLS so policies reference valid functions; (3–4) tighten trips/members then content so viewers are read-only before touching packing; (5) packing as a single migration after content model is in place; (6) RPCs and UI last so backend is correct before exposing role in the app; (7) invitations deferred to avoid scope creep.

---

## Summary

- **Schema:** Add `role` to `trip_members` only; no `trip_invitations` in initial redesign.
- **Permission model:** View = `has_trip_access`; edit content = `can_edit_trip_content`; edit metadata & participants = `can_edit_trip_metadata`; manage sharing = `can_manage_trip_sharing`; delete trip = owner only.
- **Helpers:** Add `can_manage_trip_sharing`, `can_edit_trip_content`, `can_edit_trip_metadata`; keep `is_trip_owner` and `has_trip_access`.
- **RLS:** All content and content-storage mutate via `can_edit_trip_content`; trips update and participants/covers/avatars via `can_edit_trip_metadata`; trip_members mutate via `can_manage_trip_sharing`.
- **Packing:** New migration for tables, RLS, and RPC using the same content-permission model.
- **Phases:** 1) role column → 2) helpers → 3) trips & members RLS → 4) content & storage RLS → 5) packing → 6) RPCs & app; 7) invitations later if needed.

**Addresses known issues:** Role column fixes “no role”; RLS changes fix over-permissive `trips_update` and align delete with owner-only; packing migration brings packing under migrations/RLS; UI alignment (e.g. delete button) is part of phase 6; invitations remain out of scope for v1.
