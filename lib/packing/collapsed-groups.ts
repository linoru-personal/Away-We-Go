/**
 * Which packing groups the viewer has folded shut, remembered per trip.
 *
 * This is a per-device UI preference, not trip data: it lives in localStorage
 * and is never synced, so the same trip can be folded differently on a phone
 * and a laptop. That is the intended trade — persisting it on the trip would
 * mean a schema change and a sync path for something only the viewer cares
 * about.
 *
 * Group keys come from two id spaces that cannot collide: category ids in the
 * by-category view, participant ids (or PACKING_GROUP_KEY_EVERYONE) in the
 * by-participant view. One set holds both.
 *
 * Every storage access is guarded. Reading during SSR has no `window`, and a
 * browser can refuse storage outright in private mode — neither is worth an
 * error, so both fall back to "nothing is collapsed".
 */

export function collapsedGroupsStorageKey(tripId: string): string {
  return `awg:packing:collapsed:${tripId}`;
}

export function readCollapsedGroups(tripId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(collapsedGroupsStorageKey(tripId));
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((k): k is string => typeof k === "string"));
  } catch {
    return new Set();
  }
}

export function writeCollapsedGroups(tripId: string, keys: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    const key = collapsedGroupsStorageKey(tripId);
    // Nothing collapsed is the default, so drop the entry rather than leaving
    // an empty array behind for every trip the user has ever opened.
    if (keys.size === 0) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, JSON.stringify([...keys]));
  } catch {
    // Storage unavailable (private mode, quota). The preference is expendable.
  }
}
