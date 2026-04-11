import type { SupabaseClient } from "@supabase/supabase-js";
import type { TripCoverVariant } from "./types";
import { TRIP_MEDIA_BUCKET } from "./types";

const LEGACY_COVER_BUCKET = "trip-covers";

/** Do not reuse signed URLs in the last N ms of their TTL (clock skew / slow networks). */
const COVER_SIGNED_URL_REUSE_BUFFER_MS = 45_000;

type CoverSignedUrlCacheEntry = {
  signedUrl: string;
  /** Client-side estimate: `Date.now()` when the token is expected to expire (matches requested TTL). */
  expiresAtMs: number;
};

const coverSignedUrlCache = new Map<string, CoverSignedUrlCacheEntry>();

function coverSignedUrlCacheKey(
  bucket: string,
  path: string,
  variant: TripCoverVariant,
  expiresInSeconds: number
): string {
  return `${bucket}\0${path}\0${variant}\0${expiresInSeconds}`;
}

function isCoverSignedUrlCacheEntryValid(entry: CoverSignedUrlCacheEntry): boolean {
  return Date.now() < entry.expiresAtMs - COVER_SIGNED_URL_REUSE_BUFFER_MS;
}

/** Drops stale rows so the map stays bounded as trips churn. */
function pruneExpiredCoverSignedUrlCache(): void {
  const now = Date.now();
  for (const [key, entry] of coverSignedUrlCache) {
    if (now >= entry.expiresAtMs - COVER_SIGNED_URL_REUSE_BUFFER_MS) {
      coverSignedUrlCache.delete(key);
    }
  }
}

/**
 * When a requested tier is missing in `trips.media.cover.paths`, try the next
 * available path in this order only — never skip straight to "original" unless
 * the chain says so for that request (egress control).
 */
const VARIANT_RESOLUTION_ORDER: Record<
  TripCoverVariant,
  readonly TripCoverVariant[]
> = {
  thumb: ["thumb", "preview", "original"],
  preview: ["preview", "thumb", "original"],
  original: ["original", "preview", "thumb"],
};

function isNonEmptyPath(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Reads `trips.media.cover.paths` without requiring every variant to be present.
 * (Strict JSON validation lives in `parse.ts`; this is for Storage URL picking only.)
 */
function readPartialTripMediaCoverPaths(
  row: CoverImageRowLike
): Partial<Record<TripCoverVariant, string>> | null {
  const media = row.media;
  if (media == null || typeof media !== "object" || Array.isArray(media)) return null;
  const cover = (media as Record<string, unknown>).cover;
  if (cover == null || typeof cover !== "object" || Array.isArray(cover)) return null;
  const paths = (cover as Record<string, unknown>).paths;
  if (paths == null || typeof paths !== "object" || Array.isArray(paths)) return null;
  const po = paths as Record<string, unknown>;
  const out: Partial<Record<TripCoverVariant, string>> = {};
  (["thumb", "preview", "original"] as const).forEach((k) => {
    if (isNonEmptyPath(po[k])) out[k] = (po[k] as string).trim();
  });
  return Object.keys(out).length > 0 ? out : null;
}

function resolveTripMediaCoverStoragePath(
  partial: Partial<Record<TripCoverVariant, string>>,
  requestedVariant: TripCoverVariant
): string | null {
  for (const tier of VARIANT_RESOLUTION_ORDER[requestedVariant]) {
    const p = partial[tier];
    if (p) return p;
  }
  return null;
}

export type CoverImageRowLike = {
  media?: unknown;
  cover_image_path?: string | null;
  cover_image_url?: string | null;
};

/**
 * Picks a Storage path (or public URL) for the trip cover.
 *
 * - **New data (`trip-media`):** `requestedVariant` selects the tier; missing keys
 *   use `VARIANT_RESOLUTION_ORDER` (thumbnail / preview / original never implied
 *   without going through that chain).
 * - **Legacy:** one file in `trip-covers` or a public `cover_image_url` — same asset
 *   for every tier (backward compatible).
 *
 * Bandwidth / egress: there is **no** "default to original" here. Callers must pass
 * the tier they need; `getTripCoverDisplayUrl` alone may omit the argument and then
 * defaults to **preview only** — NEVER default to original.
 */
export function pickCoverStorageLocation(
  row: CoverImageRowLike,
  requestedVariant: TripCoverVariant
): { bucket: string; path: string } | { publicUrl: string } | null {
  const partial = readPartialTripMediaCoverPaths(row);
  if (partial) {
    const path = resolveTripMediaCoverStoragePath(partial, requestedVariant);
    if (path) return { bucket: TRIP_MEDIA_BUCKET, path };
  }

  const legacy = row.cover_image_path;
  if (legacy && typeof legacy === "string" && legacy.trim()) {
    return { bucket: LEGACY_COVER_BUCKET, path: legacy.trim() };
  }
  const url = row.cover_image_url;
  if (url && typeof url === "string" && url.trim()) return { publicUrl: url.trim() };
  return null;
}

/**
 * Mint a signed URL for a trip cover Storage object, with an in-memory cache
 * keyed by bucket + path + variant + TTL. Public URLs are not cached here.
 * Failures return `null` (callers keep existing UI fallbacks).
 */
export async function createSignedUrlForCoverLocation(
  supabase: SupabaseClient,
  loc: { bucket: string; path: string },
  expiresInSeconds: number,
  /** Tier used for cache key; must match how `path` was chosen (defaults to preview). */
  variant: TripCoverVariant = "preview"
): Promise<string | null> {
  const key = coverSignedUrlCacheKey(
    loc.bucket,
    loc.path,
    variant,
    expiresInSeconds
  );
  const hit = coverSignedUrlCache.get(key);
  if (hit && isCoverSignedUrlCacheEntryValid(hit)) {
    return hit.signedUrl;
  }

  pruneExpiredCoverSignedUrlCache();

  const { data, error } = await supabase.storage
    .from(loc.bucket)
    .createSignedUrl(loc.path, expiresInSeconds);
  if (error || !data?.signedUrl) return null;

  coverSignedUrlCache.set(key, {
    signedUrl: data.signedUrl,
    expiresAtMs: Date.now() + expiresInSeconds * 1000,
  });
  return data.signedUrl;
}

/**
 * Signed (or public) URL for a trip cover.
 *
 * **NEVER default to `original`:** omitting `variant` must not pull full-size bytes
 * by accident — this is a bandwidth / Supabase egress protection rule. The only
 * default tier is **`preview`**. Use `"thumb"` or `"original"` only when explicitly
 * needed (e.g. sidebar thumb, high-res crop source).
 */
export async function getTripCoverDisplayUrl(
  supabase: SupabaseClient,
  row: CoverImageRowLike,
  variant: TripCoverVariant = "preview",
  expiresInSeconds = 3600
): Promise<string | null> {
  const loc = pickCoverStorageLocation(row, variant);
  if (!loc) return null;
  if ("publicUrl" in loc) return loc.publicUrl;
  return createSignedUrlForCoverLocation(
    supabase,
    loc,
    expiresInSeconds,
    variant
  );
}
