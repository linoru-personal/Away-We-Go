/**
 * Extract a sortable "taken at" timestamp from image EXIF when available.
 * Used for trip gallery ordering (oldest first). Fallback is upload created_at.
 */

import exifr from "exifr";

/** EXIF tags that may contain capture date, in priority order. */
const DATE_TAGS = ["DateTimeOriginal", "CreateDate", "DateTimeDigitized"] as const;

/**
 * Returns ISO date string from EXIF if present and valid, else null.
 * Call from browser with File; uses pick to parse only date tags.
 */
export async function getTakenAtFromFile(file: File): Promise<string | null> {
  try {
    const exif = await exifr.parse(file, {
      pick: [...DATE_TAGS],
    });
    if (!exif || typeof exif !== "object") return null;
    for (const key of DATE_TAGS) {
      const value = (exif as Record<string, unknown>)[key];
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString();
      }
      if (typeof value === "string") {
        const d = new Date(value);
        if (!Number.isNaN(d.getTime())) return d.toISOString();
      }
    }
    return null;
  } catch {
    return null;
  }
}
