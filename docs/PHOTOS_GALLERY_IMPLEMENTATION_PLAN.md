# Photos gallery — implementation plan (simplified)

This document supersedes informal planning threads. **No legacy gallery migration:** canonical storage is **`trip-media`** only; **`trip_photos.media`** is the sole source of truth for variant paths. No `trip-photos` bucket in app code, no `image_path` fallback, no backfill.

---

## Canonical architecture

| Layer | Choice |
|-------|--------|
| **Bucket** | `trip-media` (private) |
| **Path pattern** | `{tripId}/photos/{photoId}/thumb.webp` and `{tripId}/photos/{photoId}/display.webp` |
| **Revision segment** | **None** — no `r{n}` in paths |
| **DB truth** | `trip_photos.media` (JSON only for variant metadata) |
| **`image_path`** | **Not used** long-term — nullable after migration, then column dropped in a later migration once nothing references it |
| **Processing states** | **None** — row inserted **only after** both variants exist in Storage |

### `media` JSON shape (canonical)

```ts
{
  variants: {
    thumb: {
      bucket: "trip-media",
      path: "{tripId}/photos/{photoId}/thumb.webp",
      width: number,
      height: number,
    },
    display: {
      bucket: "trip-media",
      path: "{tripId}/photos/{photoId}/display.webp",
      width: number,
      height: number,
    },
  },
}
```

`photo_id` matches `trip_photos.id` (existing row UUID).

---

## Upload flow (single-shot API)

1. Client **`POST`** multipart **`file`** (+ optional caption / taken_at later) to **`app/api/.../photos`** (exact path TBD).
2. Route (server):
   - Resolve **`tripId`**; verify **`can_edit_trip_content(trip_id)`** for `auth.uid()` (mirror RLS semantics — use Supabase server client + same RPC/helpers as elsewhere).
   - **`photo_id`** = `crypto.randomUUID()` (or DB insert-first pattern — **prefer:** generate id once, use same id for paths and insert).
3. Load buffer → **Sharp**: decode → resize → **`thumb.webp`** and **`display.webp`** (dimensions chosen as constants, e.g. max edge 256 / 1600 — **finalize numbers in implementation**).
4. Upload **both** objects to **`trip-media`** at paths above (`upsert: false` or overwrite policy consistent with “replace” rules later).
5. **Only if both uploads succeed:** `insert` **`trip_photos`** with **`media`** populated, **`added_by_user_id`**, optional **`taken_at`** from EXIF if parsed server-side), **`caption`** if sent.
6. **On any failure** before DB insert: **delete** any uploaded objects under `{tripId}/photos/{photoId}/` (best-effort). **No DB row**.

No staging keys, no finalize endpoint, no client-side direct Storage upload for this iteration.

---

## Read / UI

- **Resolver:** given row `media`, pick variant → **`bucket` + `path`** → signed URL (reuse TTL + caching patterns from cover where practical).
- **Grid + dashboard Photos card:** **`thumb`** only.
- **Lightbox / fullscreen:** **`display`** only (load when opened — not all displays on first paint).

---

## Pagination

Implement **after** upload + read path are stable: **keyset** (`sort_at`, `id`), **Load more** button (or infinite scroll later).

---

## Cleanup

- **Delete photo:** delete **`trip_photos` row** + remove **`{tripId}/photos/{photoId}/`** prefix in Storage (both objects).

---

## Comparison to older docs

[`IMAGE_STORAGE_IMPLEMENTATION_DECISIONS.md`](IMAGE_STORAGE_IMPLEMENTATION_DECISIONS.md) mentions revision segments and processing Deletes originals after derivatives — **this plan simplifies paths** and **transaction semantics** (no status enum): either full success + row, or no row + cleaned storage.

---

# Cursor-safe implementation steps (ordered)

Execute **one step per PR / session** unless a step explicitly bundles tiny follow-ups. **Do not implement all phases at once.**

## Step 1 — Smallest safe first step (schema unblock only)

**Goal:** Allow future inserts that omit legacy `image_path` without lying in app code.

1. Add a **new Supabase migration** under `supabase/migrations/`:
   - `ALTER TABLE public.trip_photos ALTER COLUMN image_path DROP NOT NULL;`
   - Optional: `COMMENT ON COLUMN ... image_path` — deprecated / unused for new gallery (gallery uses `media`).
2. **Deploy migration** to dev before any API inserts without `image_path`.

**Why first:** Baseline has `image_path text NOT NULL`; new canonical rows cannot omit it until this lands.

**Does not require:** API route, Sharp, or UI changes yet. Existing client code that still sets `image_path` keeps working until replaced.

---

## Step 2 — Types + path helpers (no behavior change)

1. Add **`lib/trip-photos/media-types.ts`** (or under `lib/trip-media/`) exporting:
   - TypeScript types matching **`media`** shape above.
   - **`galleryPhotoObjectPrefix(tripId, photoId)`** → `{tripId}/photos/{photoId}/`
   - **`galleryThumbPath` / `galleryDisplayPath`** helpers returning full object keys.
2. No UI wiring yet.

---

## Step 3 — API route: multipart upload, Sharp, Storage, DB insert

1. **`POST`** handler e.g. **`app/api/trips/[tripId]/photos/route.ts`** (exact naming follows App Router conventions).
2. Auth + trip edit permission check.
3. Multipart parse → Sharp → two WebPs → upload **`trip-media`** → **`trip_photos` insert** with **`media`**, **`image_path` omitted or null**.
4. Failure cleanup: delete partial prefix for that **`photo_id`**.
5. Dependencies: **`sharp`** (if not already in **API** bundle — add to `package.json`).

---

## Step 4 — Replace client upload UI

1. Replace [`components/trips/photos/photo-upload-form.tsx`](components/trips/photos/photo-upload-form.tsx) **trip-photos / insert image_path** flow with **`fetch`** to Step 3 API (**FormData**).
2. Remove **`trip-photos`** bucket constant from this flow.

---

## Step 5 — Read path: resolver + signed URLs for grid

1. Implement **`getTripPhotoThumbUrl` / `getTripPhotoDisplayUrl`** (or single resolver + variant arg) using **`media.variants`**.
2. Update [`app/dashboard/trip/[id]/photos/page.tsx`](app/dashboard/trip/[id]/photos/page.tsx): fetch rows **`select` including `media`**, sign **thumb** for grid cards.
3. Update [`components/trips/photos/photos-section.tsx`](components/trips/photos/photos-section.tsx): **`thumb`** in `<img>`; wire lightbox to **`display`** when implemented.

---

## Step 6 — Dashboard Photos summary card

1. Update [`components/trips/photos/photos-summary-card.tsx`](components/trips/photos/photos-summary-card.tsx): **`getTripPhotosPreview`** query selects **`media`**; sign **thumb** only; drop **`trip-photos`**.

---

## Step 7 — Delete flow + removal of legacy constants

1. Photo delete: Storage delete prefix **`{tripId}/photos/{photoId}/`** then DB delete (order per your orphan-risk preference — typically storage first or parallel with rollback).
2. Remove remaining **`PHOTOS_BUCKET` / `trip-photos`** references from gallery code.
3. Update [`lib/trip-photos/queries.ts`](lib/trip-photos/queries.ts) — **`select`** fields; remove **`queries.server.ts`** if duplicate/unused.

---

## Step 8 — Drop `image_path` column (optional cleanup migration)

1. Migration: **`ALTER TABLE public.trip_photos DROP COLUMN image_path;`** once grep shows zero reads/writes.

---

## Step 9 — Pagination / load-more

1. Paginated query + UI control as in planning doc above.

---

## Legacy code inventory (safe to remove/replace when executing steps)

| Item | When |
|------|------|
| `trip-photos` bucket usage in TS/TSX | Step 4–6 |
| `createSignedUrl(p.image_path)` paths | Step 5–6 |
| [`photo-upload-form.tsx`](components/trips/photos/photo-upload-form.tsx) direct Storage upload | Step 4 |
| [`photos-section.tsx`](components/trips/photos/photos-section.tsx) delete DB-only | Step 7 |
| `image_path` column | Step 8 |
| Duplicate [`queries.server.ts`](lib/trip-photos/queries.server.ts) | Step 7 if unused |

---

## Operational note

Empty or unused **`trip-photos`** bucket in Supabase dashboard is an **ops** task; migrations that created it remain historical. No blob migration required.
