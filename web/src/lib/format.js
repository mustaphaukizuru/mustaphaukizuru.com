// web/src/lib/format.js
// Central money / number / date formatters. Use these everywhere instead
// of hand-rolling Intl.NumberFormat or string concatenation. The platform
// stays consistent on a single rule and a single point of change.
//
// Brand v3.1 § 14 — KPIs and prices use JetBrains Mono with tabular-nums.
// This module returns formatted strings; the consumer applies the font
// class (`font-mono tabular-nums`) where appropriate.
//
// Currency convention (Phase 2 · MXN unification):
//   The canonical price string is "MX$129.00" — produced natively by
//   Intl.NumberFormat with locale "en-US" + currency "MXN". This is the
//   same shape the backend has always emitted (paypal/mp/invoice/receipt),
//   so the platform now reads identically on every surface: cart line
//   item, checkout summary, product detail, dashboard, admin, paid email,
//   PDF invoice. We deliberately ignore the user's UI language for prices
//   so the disambiguator "MX$" always shows — Spanish-locale Intl drops it.

const DEFAULT_CURRENCY = "MXN";
// Locked at "en-US" so MXN renders as "MX$" on every page, regardless of
// the active i18n language. Date/number formatting still respects locale
// elsewhere — only currency is locale-pinned.
const PRICE_LOCALE = "en-US";
// Locale for non-currency number/date formatting (counts, dates, times).
// Pinned to en-US so the documented output shapes hold everywhere —
// "1,500" · "May 8, 2026" · "May 8, 2026 · 12:01 PM". Previously this
// constant was referenced by formatCount/formatDate/formatDateTime but
// never declared, throwing ReferenceError at every call site.
const FORMAT_LOCALE = "en-US";

function intlPrice(amount, currency) {
  try {
    return new Intl.NumberFormat(PRICE_LOCALE, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // ICU-less envs (some Node test runs) — fall back to a sane string.
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}

/**
 * Format a numeric amount as a price with the currency baked into the
 * symbol via Intl.NumberFormat.
 *
 *   formatPrice(129)            → "MX$129.00"
 *   formatPrice(17, "MXN")      → "MX$17.00"
 *   formatPrice(95.5, "USD")    → "$95.50"
 *   formatPrice(null)           → "MX$0.00"
 *
 * @param {number|string|null|undefined} amount
 * @param {string} [currency] ISO 4217. Defaults to "MXN".
 * @returns {string}
 */
export function formatPrice(amount, currency = DEFAULT_CURRENCY) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return intlPrice(0, currency);
  return intlPrice(value, currency);
}

/**
 * Compact variant — alias of formatPrice. The historical "compact" form
 * stripped the currency code, but post-Phase-2 the canonical price string
 * already includes the disambiguator ("MX$"), so there is nothing to drop.
 * Kept as a separate export so existing call sites don't need migration.
 *
 *   formatPriceCompact(129)             → "MX$129.00"
 *   formatPriceCompact(0)               → "MX$0.00"
 *   formatPriceCompact(95.5, "USD")     → "$95.50"
 *
 * @param {number|string|null|undefined} amount
 * @param {string} [currency]
 * @returns {string}
 */
export function formatPriceCompact(amount, currency = DEFAULT_CURRENCY) {
  return formatPrice(amount, currency);
}

/**
 * Render the currency code only (for badge/chip components).
 *
 *   currencyBadge("MXN") → "MXN"
 *   currencyBadge()      → "MXN"
 *
 * @param {string} [currency]
 * @returns {string}
 */
export function currencyBadge(currency = DEFAULT_CURRENCY) {
  return String(currency || DEFAULT_CURRENCY).toUpperCase();
}

/**
 * Format an integer count (orders, downloads, products, members) with
 * thousand separators. Falls through to "0" for non-numbers.
 *
 *   formatCount(1500)    → "1,500"
 *   formatCount(null)    → "0"
 *
 * @param {number|string|null|undefined} n
 * @returns {string}
 */
export function formatCount(n) {
  const value = Number(n);
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString(FORMAT_LOCALE);
}

/**
 * Format a date as "May 8, 2026" (en-US prose).
 * @param {Date|string|number} d
 * @returns {string}
 */
export function formatDate(d) {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(FORMAT_LOCALE, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format a date+time as "May 8, 2026 · 12:01 PM".
 * @param {Date|string|number} d
 * @returns {string}
 */
export function formatDateTime(d) {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  const datePart = date.toLocaleDateString(FORMAT_LOCALE, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const timePart = date.toLocaleTimeString(FORMAT_LOCALE, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${datePart} · ${timePart}`;
}
