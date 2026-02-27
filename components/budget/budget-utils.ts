/** Legacy icon keys from before emoji-based Budget icons. */
const LEGACY_ICON_MAP: Record<string, string> = {
  home: "🏠",
  car: "🚗",
  utensils: "🍽️",
  compass: "🧭",
  bag: "🛍️",
  dots: "•",
};

/**
 * Normalizes a Budget category icon for display only.
 * Maps legacy keys (home, car, utensils, etc.) to emoji; returns other values as-is.
 * Do not write the result back to the DB.
 */
export function normalizeBudgetIcon(
  icon: string | null | undefined
): string | null {
  if (icon == null || icon === "") return null;
  const mapped = LEGACY_ICON_MAP[icon];
  return mapped !== undefined ? mapped : icon;
}
