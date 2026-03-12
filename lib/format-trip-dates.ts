/**
 * Format a trip date range for display (e.g. trip hero).
 * - Same year: "Sep 19 – Oct 17, 2025"
 * - Different years: "Dec 29, 2025 – Jan 3, 2026"
 * Uses en dash (–) and locale-aware formatting.
 */
const EN_DASH = "–";
const FALLBACK_EM_DASH = "—";

function parseDate(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(iso + "T12:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatTripDateRange(
  start: string | null,
  end: string | null,
  locale?: string
): string {
  if (!start && !end) return FALLBACK_EM_DASH;
  const loc = locale ?? undefined;
  const optsShort: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const optsWithYear: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  try {
    const startDate = start ? parseDate(start) : null;
    const endDate = end ? parseDate(end) : null;
    if (startDate && endDate) {
      const sameYear = startDate.getFullYear() === endDate.getFullYear();
      const startStr = sameYear
        ? startDate.toLocaleDateString(loc, optsShort)
        : startDate.toLocaleDateString(loc, optsWithYear);
      const endStr = endDate.toLocaleDateString(loc, optsWithYear);
      return `${startStr} ${EN_DASH} ${endStr}`;
    }
    if (startDate) return startDate.toLocaleDateString(loc, optsWithYear);
    if (endDate) return endDate.toLocaleDateString(loc, optsWithYear);
  } catch {
    return [start, end].filter(Boolean).join(` ${EN_DASH} `);
  }
  return FALLBACK_EM_DASH;
}
