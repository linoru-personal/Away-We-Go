import type { TripCoverVariant } from "./types";

/**
 * Tier fallback when a requested variant path is missing (never implies defaulting to original).
 */
export const VARIANT_RESOLUTION_ORDER: Record<
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

export function resolveVariantStoragePath(
  partial: Partial<Record<TripCoverVariant, string>>,
  requestedVariant: TripCoverVariant
): string | null {
  for (const tier of VARIANT_RESOLUTION_ORDER[requestedVariant]) {
    const p = partial[tier];
    if (p) return p;
  }
  return null;
}

/**
 * Navigate `root.key1.key2...` then read `.paths.{thumb,preview,original}`.
 * Used for `trips.media.cover`, `trips.media.destination`, `trip_participants.media.avatar`.
 */
export function readPartialVariantPathsAt(
  root: unknown,
  keys: readonly string[]
): Partial<Record<TripCoverVariant, string>> | null {
  let cur: unknown = root;
  for (const k of keys) {
    if (cur == null || typeof cur !== "object" || Array.isArray(cur)) return null;
    cur = (cur as Record<string, unknown>)[k];
  }
  if (cur == null || typeof cur !== "object" || Array.isArray(cur)) return null;
  const paths = (cur as Record<string, unknown>).paths;
  if (paths == null || typeof paths !== "object" || Array.isArray(paths)) return null;
  const po = paths as Record<string, unknown>;
  const out: Partial<Record<TripCoverVariant, string>> = {};
  (["thumb", "preview", "original"] as const).forEach((k) => {
    if (isNonEmptyPath(po[k])) out[k] = (po[k] as string).trim();
  });
  return Object.keys(out).length > 0 ? out : null;
}
