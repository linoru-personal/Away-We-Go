# Image storage — final implementation decisions

Single chosen architecture. Private media by default, no public URLs persisted in Postgres, multi-user trip safety, egress minimized.

---

## A. Final decisions table

| Topic | Decision |
|--------|----------|
| Buckets | **One private bucket:** `trip-media` |
| Path root | **First segment = `trip_id` (UUID).** Second segment = asset class: `cover` \| `participants` \| `photos` \| `editable`. |
| Original retention — cover | **Keep** original until user replaces cover; then delete prior originals + variants for that asset. |
| Original retention — avatar | **Keep** original (small cardinality, re-crop). |
| Original retention — gallery photo | **Delete original** after derivatives are written and DB updated (keep thumb + display only). |
| Original retention — editable | **Keep** original always (re-crop contract). |
| Variants in DB | **`media jsonb`** per row (see §D). One pattern everywhere we add it; legacy path columns hold **primary display path** for v1 compatibility where they already exist. |
| Upload path | **Client → Next.js App Router API routes → Storage** (server uses service role for `put` after authz). |
| Read path | **Signed GET URLs** minted in API, **TTL 120s**, refreshed by TanStack Query / SWR. |
| Cache | **Immutable variant filenames** include `revision` integer in path; `Cache-Control: public, max-age=31536000, immutable` on variants. |
| SQL | Policies on `storage.objects` using **`split_part(name, '/', 1)::uuid`** as `trip_id`, **`split_part(name, '/', 2)`** as class. |

---

## B. Concrete storage architecture

### B.1 Bucket

- **Name:** `trip-media`
- **Public:** `false`
- **Rationale:** One place for policies, lifecycle, and auditing. Authorization is entirely path + SQL policy; multiple buckets only add operational cost without improving security for this product.

### B.2 Path patterns (final)

All objects live under:

```text
{trip_id}/{class}/{...}
```

`trip_id` is UUID string (36 chars), lowercase, no braces in path.

| Asset type | Pattern | Example |
|-------------|---------|---------|
| **Trip cover** | `{trip_id}/cover/r{revision}/{asset_id}/original.{ext}` and `{trip_id}/cover/r{revision}/{asset_id}/hero.webp`, `thumb.webp` | `a1b2…/cover/r3/c9f0…/hero.webp` |
| **Participant avatar** | `{trip_id}/participants/r{revision}/{participant_id}/{asset_id}/original.{ext}`, `avatar.webp`, `thumb.webp` | `a1b2…/participants/r1/p7…/d4…/avatar.webp` |
| **Gallery photo** | `{trip_id}/photos/r{revision}/{photo_id}/display.webp`, `thumb.webp` — **no `original.*` after processing** | `a1b2…/photos/r2/ph8…/thumb.webp` |
| **Editable (crop)** | `{trip_id}/editable/r{revision}/{asset_id}/original.{ext}`, `crop.webp`, `thumb.webp` | `a1b2…/editable/r1/e5…/original.jpg` |

**`r{revision}`** is a monotonic integer per (trip, class, logical id) bump on replace so URLs are immutable per revision and caches cannot serve stale bytes after replace.

**`asset_id`:** new UUID per upload/replace session (simplest garbage collection: delete whole prefix when abandoning).

**Why this secures policies:** `trip_id` is always segment 1; **class** is segment 2. Policies map `class` → `can_edit_trip_metadata` vs `can_edit_trip_content` without parsing deeper.

---

## C. SQL policies (`storage.objects`)

Assume bucket id `trip-media`. Adjust if you rename.

**Helper expressions (repeat in policies or wrap in SQL functions later):**

- `trip_id := nullif(split_part(name, '/', 1), '')::uuid`
- `class := nullif(split_part(name, '/', 2), '')`

### C.1 SELECT (read)

Anyone authenticated who can read the trip may read objects under that trip prefix.

```sql
create policy "trip_media_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'trip-media'
  and public.has_trip_access(nullif(split_part(name, '/', 1), '')::uuid)
);
```

### C.2 INSERT / UPDATE / DELETE — metadata classes (cover, participants, editable)

```sql
create policy "trip_media_write_metadata"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'trip-media'
  and split_part(name, '/', 2) in ('cover', 'participants', 'editable')
  and public.can_edit_trip_metadata(nullif(split_part(name, '/', 1), '')::uuid)
)
with check (
  bucket_id = 'trip-media'
  and split_part(name, '/', 2) in ('cover', 'participants', 'editable')
  and public.can_edit_trip_metadata(nullif(split_part(name, '/', 1), '')::uuid)
);
```

### C.3 INSERT / UPDATE / DELETE — gallery photos

```sql
create policy "trip_media_write_photos"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'trip-media'
  and split_part(name, '/', 2) = 'photos'
  and public.can_edit_trip_content(nullif(split_part(name, '/', 1), '')::uuid)
)
with check (
  bucket_id = 'trip-media'
  and split_part(name, '/', 2) = 'photos'
  and public.can_edit_trip_content(nullif(split_part(name, '/', 1), '')::uuid)
);
```

**Notes**

- `for all` covers insert/update/delete. Split into four policies per class if you prefer clearer error messages.
- **Service role** bypasses Storage RLS; your API must still enforce the same rules when using the service key.
- **Anon:** no policies → no access (correct).
- Validate **depth** in application (reject paths not matching exact pattern); policies only gate by trip + class.

---

## D. DB–storage contract

### D.1 Global `media jsonb` shape (canonical)

Every `media` (or merged into existing rows) follows:

```jsonc
{
  "bucket": "trip-media",           // constant in v1; allows future bucket migration
  "revision": 3,                    // bumps on replace; must match path segment r{revision}
  "status": "ready" | "processing" | "failed",
  "mime_original": "image/jpeg",    // when original retained or at upload receipt
  "bytes_original": 2400000,        // optional; set when known
  "width_original": 4032,           // optional
  "height_original": 3024,          // optional
  "variants": {
    "thumb":   { "path": "…/thumb.webp",   "w": 320,  "h": 320,  "format": "webp", "bytes": 12000 },
    "display": { "path": "…/display.webp", "w": 1440, "h": null, "format": "webp", "bytes": 180000 },
    "hero":    { "path": "…/hero.webp",    "w": 1920, "h": 720,  "format": "webp", "bytes": 220000 },
    "avatar":  { "path": "…/avatar.webp",  "w": 512,  "h": 512,  "format": "webp", "bytes": 35000 },
    "crop":    { "path": "…/crop.webp",    "w": null, "h": null, "format": "webp", "bytes": 90000 }
  },
  "original_path": "…/original.jpg", // omit or null when policy deletes original (gallery)
  "crop_metadata": { },              // only editable + cover if you use shared cropper; else null
  "error": null                      // string on failed pipeline
}
```

**Rules:** Only include variant keys that exist for that asset type (see §E). Do **not** store full Supabase URLs.

### D.2 Per table (minimal churn + v1 clarity)

| Table / entity | Postgres fields | Notes |
|----------------|-----------------|--------|
| **`trips`** | `cover_image_path` → **canonical path to `hero`** variant (fast legacy reads). Add **`cover_media jsonb`** with full `media` shape; `variants.hero.path` must match `cover_image_path` or migrate to jsonb-only in v2. | No `cover_image_url`. |
| **`trip_participants`** | `avatar_path` → path to **`avatar`** variant. Add **`avatar_media jsonb`**. | `avatar_path` = primary display; jsonb holds thumb + original paths. |
| **`trip_photos`** | `image_path` → **`display`** variant. Add **`photo_media jsonb`** with `thumb`, `display`; **`original_path` absent** after processing. | `status` inside jsonb. |
| **`editable_image_assets`** | Keep **`original_path`**, **`cropped_path`** (active crop = **`crop`** variant path, sync with `media.variants.crop.path`**), **`crop_metadata`**, **`aspect_preset`**. Add **`media jsonb`** for `thumb` + revision + status; migrate to single source of truth in v2. | Original always kept. |

**Timestamps:** use existing `created_at` / `updated_at` on rows; add **`processed_at timestamptz`** on `trip_photos` / `editable` if needed for pipeline—optional v1: use `media.status` only.

---

## E. Upload / retrieval flow

### E.1 Upload architecture (final)

**Client → Next.js Route Handlers → Supabase Storage** (server uses **service role** key for `upload` / `remove` after authorization). **No** client-signed upload URLs in v1 (fewer footguns, one place for validation and cleanup).

**Route structure (App Router):**

```text
app/api/trips/[tripId]/media/cover/route.ts          POST, DELETE
app/api/trips/[tripId]/media/participants/[participantId]/avatar/route.ts  POST, DELETE
app/api/trips/[tripId]/media/photos/route.ts       POST  (create photo row + upload)
app/api/trips/[tripId]/media/photos/[photoId]/route.ts  PATCH, DELETE
app/api/trips/[tripId]/media/editable/[assetId]/route.ts  POST, PATCH
app/api/trips/[tripId]/media/signed-url/route.ts   GET  ?path=&variant=
```

**Permission checks (server, before any storage call):**

| Route | Check |
|-------|--------|
| cover, participants/*, editable/* | `can_edit_trip_metadata(tripId)` |
| photos | `can_edit_trip_content(tripId)` |
| signed-url | `has_trip_access(tripId)` and path belongs to that `tripId` |

**Failure handling**

1. Create DB row with `media.status = 'processing'` (or reserved id) **first** for photos/cover/avatar where you need id in path.
2. Upload **original** (if retained) or **bytes** stream to temp key **or** final key.
3. Server generates variants; **update `media` jsonb**; set `status = 'ready'`.
4. On any failure after partial writes: **delete all objects under** `{trip_id}/{class}/r{rev}/{id}/` **best-effort**, set `media.status = 'failed'`, `media.error` message. Optionally **cron** deletes `processing` older than 1h.

**Cleanup:** transactional order **DB rollback** cannot undo storage—so **storage-first delete** on replace: upload new `r{revision+1}` prefix, update DB to point to new revision, **async delete** old prefix (queue or fire-and-forget with logging).

### E.2 Retrieval architecture

1. **UI never** calls `getPublicUrl`. It holds **`tripId`, logical keys (`photoId`, variant key `thumb` \| `display` \| `hero` \| `avatar` \| `crop`)** from Postgres `media` jsonb / path columns.
2. **Data fetching:** component calls **`GET /api/trips/[tripId]/media/signed-url?path=<url-encoded storage path>`** (path must be under that `tripId` prefix; server validates prefix + `has_trip_access`).
3. **Server** uses `createSignedUrl(bucket, path, { expiresIn: 120 })`.
4. **TTL:** **120 seconds**. Refresh: wrap in **TanStack Query** with `staleTime: 60_000`, `refetchInterval: 60_000`, or refresh when `expiresAt` − 30s (return `{ url, expiresAt }` from API).

---

## F. Caching strategy

| Item | Decision |
|------|----------|
| **Browser** | Signed URL is stable for 120s; use `<Image unoptimized>` only if needed—prefer **`unoptimized={false}`** with remote pattern for your API redirect **or** signed URL directly in `next/image` `remotePatterns` for Supabase host. |
| **CDN / Cache-Control** | On upload completion, set object metadata **`cache-control: public, max-age=31536000, immutable`** for **variant** objects (thumb, display, hero, avatar, crop). **Do not** mark `processing` temp keys immutable. |
| **Immutable filenames** | **Yes:** path includes **`r{revision}`**; bump revision on every replace so URL bytes never change under same URL string (they don’t—new URL). |
| **Replace / stale UI** | After successful replace, **increment `revision` in DB first**, then write new objects under new `r*`, then delete old prefix. UI keys include `revision` so React **remounts** `img`. |

---

## G. Rollout plan

### v1 (ship)

- Create bucket `trip-media` + policies §C.
- Implement **cover + gallery + avatar** upload/read routes + **`signed-url`** route.
- Add **`media jsonb`** (or minimal `photo_media` first) for new writes; keep **`image_path` / `cover_image_path` / `avatar_path`** populated as **display** path for compatibility.
- Variants: **thumb + display** for photos; **thumb + hero** for cover; **thumb + avatar** for participants; **original + crop + thumb** for editable when you wire it.
- Gallery **delete original** after processing.

### v2

- Consolidate legacy path columns into **`media` only**; single code path for URL minting.
- Async cleanup worker for orphaned prefixes and failed `processing`.
- Optional: move service-role uploads to **user JWT + tightened storage policies** once stable.

### Later optimizations

- CDN in front of bucket (same paths).
- **AVIF** variants if CPU budget allows.
- Tiered storage / lifecycle for old `editable` originals if size grows.

---

## 4–5. Variant strategy + exact sizes (reference)

**Strategy:** **`media jsonb`** (§D.1). No separate nullable column per variant except transitional **`image_path` / `cover_image_path` / `avatar_path`** pointing at primary display.

| Variant | Max dimensions | Format | Used for |
|---------|----------------|--------|----------|
| **thumb** | 320×320 box (contain/cover per UX) | WebP | grids, lists |
| **display** | long edge **1440** | WebP | lightbox, trip page |
| **hero** | **1920×720** (crop cover) | WebP | trip header |
| **avatar** | **512×512** | WebP | profile chip |
| **avatar thumb** | reuse **thumb** slot in participant `media.variants.thumb` | WebP | small lists |
| **crop** (editable) | user-driven; **max long edge 2048** export | WebP | editor canvas save |
| **editable thumb** | same **320** | WebP | asset picker |

**Gallery original:** **not stored** after success (§A).

---

## 11. Cost controls (explicit)

1. **No full-size in list UI** — only `thumb` signed URLs for grids.
2. **Cap display** at 1440px — never serve 4K to phone.
3. **Delete gallery originals** after derivatives — largest storage win.
4. **No `listBucket` in UI** — all enumeration from **Postgres**.
5. **Short signed URL TTL** — limits hotlink leakage window (120s).
6. **One replace = new `r{revision}` prefix** — delete old prefix async to reclaim space.
7. **Rate limit** upload API per user/trip (middleware)—prevent abuse.
8. **Max upload bytes** server-side (e.g. 15 MB per file v1)—reject early.

---

## Document control

- **Owner:** engineering  
- **Review with:** whoever owns Supabase project + billing  
- **Change process:** bump §A table and `revision` rules together when altering paths or policies.
