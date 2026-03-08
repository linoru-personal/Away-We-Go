/**
 * Shared styles for the trip dashboard and its summary cards.
 * Keeps cards, typography, and empty states consistent.
 */

export const DASHBOARD_CARD_CLASS =
  "bg-white rounded-2xl border border-[#ebe5df] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]";

/** Compact spacing for card content below header (header → content). */
export const CARD_CONTENT_MT = "mt-4";

/** Spacing before CTA block (content → CTA). */
export const CARD_CTA_MT = "mt-5";

export const SECTION_TITLE_CLASS =
  "text-base font-semibold tracking-tight text-[#2d2d2d]";

export const META_CLASS =
  "mt-1 text-sm text-[#8a8a8a]";

export const NUMERIC_EMPHASIS_CLASS =
  "text-xl font-semibold tabular-nums text-[#E07A5F]";

export const PROGRESS_TRACK_CLASS =
  "h-2.5 w-full overflow-hidden rounded-full bg-[#F0EDE9]";

export const PROGRESS_FILL_CLASS =
  "h-full rounded-full bg-[#E07A5F] transition-all duration-500 ease-out";

export const EMPTY_STATE_CLASS =
  "flex min-h-[64px] flex-col items-center justify-center rounded-xl bg-[#FAFAF8] py-5 text-center";

export const EMPTY_STATE_TEXT_CLASS =
  "text-sm text-[#8a8a8a]";

export const CTA_LINK_CLASS =
  "text-sm font-medium text-[#E07A5F] transition-colors hover:underline";

/** Trip summary strip under hero: container and stat text. */
export const SUMMARY_STRIP_CLASS =
  "flex flex-wrap items-center justify-center gap-x-6 gap-y-2 rounded-2xl border border-[#ebe5df] bg-white/80 px-5 py-3 shadow-[0_1px_6px_rgba(0,0,0,0.04)]";
export const SUMMARY_STRIP_STAT_CLASS =
  "text-sm tabular-nums text-[#2d2d2d]";
export const SUMMARY_STRIP_LABEL_CLASS =
  "text-xs text-[#8a8a8a]";

/** Destination/places card empty state (map preview feel). */
export const DESTINATION_PLACEHOLDER_CLASS =
  "flex min-h-[100px] flex-col items-center justify-center rounded-xl border border-[#ebe5df] bg-[#F3F1ED] py-6";
