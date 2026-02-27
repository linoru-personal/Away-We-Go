export type CurrencyOption = {
  code: string;
  name: string;
  flagCountry: string; // ISO 3166-1 alpha-2 lowercase
};

export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: "USD", name: "United States Dollar", flagCountry: "us" },
  { code: "EUR", name: "Euro", flagCountry: "eu" },
  { code: "ILS", name: "Israeli Shekel", flagCountry: "il" },
  { code: "GBP", name: "British Pound", flagCountry: "gb" },
  { code: "CHF", name: "Swiss Franc", flagCountry: "ch" },
  { code: "NOK", name: "Norwegian Krone", flagCountry: "no" },
  { code: "SEK", name: "Swedish Krona", flagCountry: "se" },
  { code: "DKK", name: "Danish Krone", flagCountry: "dk" },
  { code: "PLN", name: "Polish Zloty", flagCountry: "pl" },
  { code: "CZK", name: "Czech Koruna", flagCountry: "cz" },
  { code: "HUF", name: "Hungarian Forint", flagCountry: "hu" },
  { code: "RON", name: "Romanian Leu", flagCountry: "ro" },
  { code: "THB", name: "Thai Baht", flagCountry: "th" },
  { code: "VND", name: "Vietnamese Dong", flagCountry: "vn" },
  { code: "KRW", name: "South Korean Won", flagCountry: "kr" },
  { code: "JPY", name: "Japanese Yen", flagCountry: "jp" },
  { code: "SGD", name: "Singapore Dollar", flagCountry: "sg" },
  { code: "HKD", name: "Hong Kong Dollar", flagCountry: "hk" },
  { code: "TWD", name: "Taiwan Dollar", flagCountry: "tw" },
  { code: "INR", name: "Indian Rupee", flagCountry: "in" },
  { code: "LKR", name: "Sri Lankan Rupee", flagCountry: "lk" },
  { code: "AUD", name: "Australian Dollar", flagCountry: "au" },
  { code: "NZD", name: "New Zealand Dollar", flagCountry: "nz" },
  { code: "CAD", name: "Canadian Dollar", flagCountry: "ca" },
  { code: "MXN", name: "Mexican Peso", flagCountry: "mx" },
  { code: "AED", name: "UAE Dirham", flagCountry: "ae" },
  { code: "SAR", name: "Saudi Riyal", flagCountry: "sa" },
  { code: "JOD", name: "Jordanian Dinar", flagCountry: "jo" },
  { code: "TRY", name: "Turkish Lira", flagCountry: "tr" },
  { code: "ZAR", name: "South African Rand", flagCountry: "za" },
  { code: "BRL", name: "Brazilian Real", flagCountry: "br" },
  { code: "ARS", name: "Argentine Peso", flagCountry: "ar" },
  { code: "CLP", name: "Chilean Peso", flagCountry: "cl" },
  { code: "COP", name: "Colombian Peso", flagCountry: "co" },
  { code: "PEN", name: "Peruvian Sol", flagCountry: "pe" },
];
