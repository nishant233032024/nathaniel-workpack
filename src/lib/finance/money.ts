import type { Assumptions, Currency } from './types';

export const SUPPORTED_CURRENCIES: Currency[] = ['INR', 'USD', 'EUR'];

const SYMBOLS: Record<Currency, string> = { INR: '₹', USD: '$', EUR: '€' };

export function isCurrency(value: string): value is Currency {
  return (SUPPORTED_CURRENCIES as string[]).includes(value);
}

/** True when `value` is an ISO calendar date (YYYY-MM-DD) that round-trips. */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(ms)) return false;
  return new Date(ms).toISOString().slice(0, 10) === value;
}

export function parseIsoDateUtc(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

export function addDays(iso: string, days: number): string {
  const ms = parseIsoDateUtc(iso) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Whole days from `fromIso` to `toIso`. Positive when `toIso` is later. */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((parseIsoDateUtc(toIso) - parseIsoDateUtc(fromIso)) / 86_400_000);
}

/**
 * Parse a CSV money cell into signed integer minor units.
 *
 * Accepts an optional minus sign, an optional thousands separator and at most
 * two decimal places. Anything else returns null so the caller can raise a
 * review item instead of guessing.
 */
export function parseAmountToMinor(raw: string): number | null {
  const cleaned = raw.trim().replace(/,/g, '');
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const negative = cleaned.startsWith('-');
  const body = negative ? cleaned.slice(1) : cleaned;
  const [whole, frac = ''] = body.split('.');
  const minor = Number(whole) * 100 + Number((frac + '00').slice(0, 2));
  if (!Number.isSafeInteger(minor)) return null;
  return negative ? -minor : minor;
}

/** Render minor units as an exact decimal string, e.g. 800000 -> "8000.00". */
export function minorToDecimalString(minor: number): string {
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  return `${negative ? '-' : ''}${whole}.${frac}`;
}

/**
 * Format for display. Grouping is implemented here rather than via Intl so the
 * skill's text outputs are byte-identical on every machine.
 */
export function formatMoney(minor: number, currency: Currency, opts: { symbol?: boolean } = {}): string {
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const whole = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const frac = String(abs % 100).padStart(2, '0');
  const prefix = opts.symbol === false ? `${currency} ` : SYMBOLS[currency];
  return `${negative ? '-' : ''}${prefix}${whole}.${frac}`;
}

/** Same value in the student's currency, without symbols, for CSV cells. */
export function formatMoneyPlain(minor: number): string {
  return minorToDecimalString(minor);
}

/**
 * Convert a minor-unit amount in `currency` to INR paise.
 *
 * Every supported currency has exactly 100 minor units per major unit, so the
 * rate multiplies the minor amount directly: 11000 USD cents x 84 = 924000 paise.
 * This identity is asserted in the tests.
 */
export function toInrPaise(minor: number, currency: Currency, assumptions: Assumptions): number {
  return minor * assumptions.inrPerUnit[currency];
}

/** PayPal keeps 4.4% of gross plus 0.30, in the payment's own currency. */
export function paypalFeeMinor(grossMinor: number, assumptions: Assumptions): number {
  const percentage = Math.round((grossMinor * assumptions.paypalPercent * 1000) / 1000);
  return percentage + assumptions.paypalFixedMinor;
}

/**
 * GST included in a gross receipt: gross x 18 / 118, rounded to the paise.
 * The processor fee is never deducted first; see docs/decisions.
 */
export function gstIncludedInGross(grossMinor: number, gstPercent: number): number {
  const numerator = grossMinor * gstPercent;
  return Math.round(numerator / (100 + gstPercent));
}
