"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { getTripCoverDisplayUrl } from "@/lib/trip-media/resolve-cover";
import type { CoverImageRowLike } from "@/lib/trip-media/resolve-cover";
import type { TripCoverVariant } from "@/lib/trip-media/types";

/**
 * Resolves a signed (or public) URL for the trip cover for the given variant.
 * Re-runs when trip id or stored cover metadata changes.
 * Signed Storage URLs are deduped in-memory in `getTripCoverDisplayUrl` / `createSignedUrlForCoverLocation`.
 */
export function useTripCoverSignedUrl(
  trip: CoverImageRowLike | null | undefined,
  variant: TripCoverVariant
): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const mediaKey = JSON.stringify(trip?.media ?? null);
  const path = trip?.cover_image_path ?? "";
  const legacyUrl = trip?.cover_image_url ?? "";

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = trip
        ? await getTripCoverDisplayUrl(supabase, trip, variant)
        : null;
      if (!cancelled) setUrl(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [trip, mediaKey, path, legacyUrl, variant]);

  return url;
}
