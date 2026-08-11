/**
 * Currency normalisation for the "cheapest across sources" comparison.
 *
 * The five sites quote in whatever currency their geo-detection lands on, so
 * comparing raw numbers would be meaningless. These are static approximate
 * rates — good enough to rank quotes, NOT good enough to display as converted
 * prices. The UI always shows each quote in its own original currency; these
 * rates are used only for sorting.
 *
 * Swap `rateToEur` for a live FX feed if you ever want to display conversions.
 */

const RATES_TO_EUR: Record<string, number> = {
  EUR: 1,
  GBP: 1.17,
  USD: 0.92,
  CHF: 1.06,
  SEK: 0.088,
  NOK: 0.086,
  DKK: 0.134,
  PLN: 0.234,
  BRL: 0.17,
  ARS: 0.00075,
};

export function rateToEur(currency: string): number | null {
  return RATES_TO_EUR[currency.toUpperCase()] ?? null;
}

/** Approximate EUR value, used purely for ranking. Null when unknown currency. */
export function toEurApprox(amount: number, currency: string): number | null {
  const rate = rateToEur(currency);
  return rate == null ? null : amount * rate;
}

const SYMBOLS: Record<string, string> = {
  EUR: '€',
  GBP: '£',
  USD: '$',
  BRL: 'R$',
  ARS: '$',
  CHF: 'CHF ',
  PLN: 'zł',
};

export function formatPrice(amount: number, currency: string): string {
  const symbol = SYMBOLS[currency.toUpperCase()];
  const rounded = amount >= 100 ? Math.round(amount) : Math.round(amount * 100) / 100;
  const formatted = rounded.toLocaleString('en-GB', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return symbol ? `${symbol}${formatted}` : `${formatted} ${currency}`;
}
