/**
 * Budget money helpers: static FX rates (MVP), formatting, and conversion.
 * All totals stored in DB as USD (amount_base). Display uses selected display currency.
 */

/** Static rates to USD (MVP placeholders). */
export const RATES_TO_USD: Record<string, number> = {
  USD: 1,
  ILS: 0.27,
  EUR: 1.09,
};

export const DISPLAY_CURRENCIES = ["ILS", "USD", "EUR"] as const;
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

/** Default currencies always shown first in display and Add Item dropdowns. */
export const DEFAULT_CURRENCIES: readonly string[] = ["ILS", "USD", "EUR"];

/** Currencies that can be added per trip via "Add currency…" (built-in list for search). */
export const ADDABLE_CURRENCIES = [
  "JPY",
  "GBP",
  "CAD",
  "AUD",
  "CHF",
  "SEK",
  "NOK",
  "DKK",
] as const;

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  ILS: "₪",
  JPY: "¥",
  GBP: "£",
  CAD: "C$",
  AUD: "A$",
  CHF: "CHF",
  SEK: "kr",
  NOK: "kr",
  DKK: "kr",
};

/** Fraction digits by currency: JPY whole numbers, others 2 decimals. */
function getFractionDigits(currencyCode: string): number {
  return currencyCode === "JPY" ? 0 : 2;
}

/**
 * Format amount in given currency (symbol + number).
 * USD => $, EUR => €, ILS => ₪, JPY => ¥; JPY 0 decimals, others 2. Does not alter stored amount.
 */
export function formatMoney(amount: number, currency: string): string {
  const code = currency.trim().toUpperCase();
  const symbol = CURRENCY_SYMBOLS[code];
  const fractionDigits = getFractionDigits(code);
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
  if (symbol) return `${symbol}${formatted}`;
  return `${code} ${formatted}`;
}

/**
 * Convert amount from one currency to another using USD as intermediate.
 * Uses RATES_TO_USD for both directions.
 */
export function convert(
  fromCurrency: string,
  toCurrency: string,
  amount: number
): number {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();
  if (from === to) return amount;
  const rateFrom = RATES_TO_USD[from];
  const rateTo = RATES_TO_USD[to];
  if (rateFrom == null || rateTo == null) return amount;
  const usd = amount * rateFrom;
  return usd / rateTo;
}

/**
 * Convert amount from one currency to another using USD as intermediate.
 * Uses provided ratesToUSDMap (e.g. trip rates merged with static defaults).
 * Each key is currency code, value is rate to USD. USD should be 1.
 */
export function convertViaUSD(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  ratesToUSDMap: Record<string, number>
): number {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();
  if (from === to) return amount;
  const rateFrom = ratesToUSDMap[from] ?? 0;
  const usd = amount * rateFrom;
  if (to === "USD") return usd;
  const rateTo = ratesToUSDMap[to] ?? 1;
  return usd / rateTo;
}

/** Convert USD amount to display currency using optional trip-scoped rates. */
export function usdToDisplay(
  usdAmount: number,
  displayCurrency: string,
  ratesToUSDMap?: Record<string, number>
): number {
  if (ratesToUSDMap) {
    return convertViaUSD(usdAmount, "USD", displayCurrency, ratesToUSDMap);
  }
  return convert("USD", displayCurrency, usdAmount);
}
