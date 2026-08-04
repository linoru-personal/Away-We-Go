/**
 * Shared Tailwind class strings for the auth screens (login, forgot password,
 * reset password). Extracted so the three cards cannot drift apart.
 */

/**
 * Carries no vertical margin, so callers can wrap the input (e.g. to overlay a
 * show/hide toggle) and put `mt-1.5` on the wrapper instead. Spacing lives at
 * the call site: `mt-1.5 ${INPUT_CLASS}`.
 */
export const INPUT_CLASS =
  "w-full rounded-[20px] border border-transparent bg-[#f6f2ed] px-4 py-3 text-[#1f1f1f] placeholder:text-[#8a8a8a] focus:border-[#d97b5e] focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30 focus:ring-offset-0 disabled:opacity-60 aria-[invalid=true]:focus:ring-red-400/40 aria-[invalid=true]:focus:border-red-400";

export const LABEL_CLASS = "block text-sm font-medium text-[#1f1f1f]";

export const PRIMARY_BUTTON_CLASS =
  "flex h-[50px] w-full items-center justify-center gap-2 rounded-full bg-[#d97b5e] px-4 text-sm font-medium text-white shadow-[0_2px_8px_rgba(217,123,94,0.25)] transition hover:bg-[#c46950] focus:outline-none focus:ring-2 focus:ring-[#d97b5e] focus:ring-offset-2 focus:ring-offset-white active:bg-[#b85a42] disabled:opacity-60 disabled:hover:bg-[#d97b5e]";

export const SECONDARY_BUTTON_CLASS =
  "flex h-[50px] w-full items-center justify-center rounded-full border border-[#e0d9d2] bg-transparent px-4 text-sm font-medium text-[#1f1f1f] transition hover:bg-[#f6f2ed] focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30 focus:ring-offset-2 focus:ring-offset-white active:bg-[#ebe5df] disabled:opacity-60";

export const TEXT_LINK_CLASS =
  "rounded text-sm font-medium text-[#d97b5e] underline-offset-2 transition hover:text-[#c46950] hover:underline focus:outline-none focus:ring-2 focus:ring-[#d97b5e]/30";
