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

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  ILS: "₪",
};

/**
 * Format amount in given currency (symbol + number).
 * USD/EUR/ILS use standard symbols; others fall back to "XXX 1,234".
 */
export function formatMoney(amount: number, currency: string): string {
  const code = currency.toUpperCase();
  const symbol = CURRENCY_SYMBOLS[code];
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
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

/** Convert USD amount to display currency. */
export function usdToDisplay(usdAmount: number, displayCurrency: string): number {
  return convert("USD", displayCurrency, usdAmount);
}
