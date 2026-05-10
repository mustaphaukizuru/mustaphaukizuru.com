// web/src/lib/format.js
// Central money / number / date formatters. Use these everywhere instead
// of hand-rolling Intl.NumberFormat or string concatenation. The platform
// stays consistent on a single rule and a single point of change.
//
// Brand v3.1 § 14 — KPIs and prices use JetBrains Mono with tabular-nums.
// This module returns formatted strings; the consumer applies the font
// class (`font-mono tabular-nums`) where appropriate.

const DEFAULT_CURRENCY = "MXN";

// Locale used by the formatters. en-US gives a comma thousand separator
// and dot decimal, which matches the English-default platform tone. The
// MXN currency code makes the unit explicit and avoids the legacy
// "MX$17.00" / "$17.00 MXN" mismatch the cart and product detail showed.
const FORMAT_LOCALE = "en-US";

/**
 * Format a numeric amount as a price with explicit currency code.
 *
 *   formatPrice(129)            → "$129.00 MXN"
 *   formatPrice(17, "MXN")      → "$17.00 MXN"
 *   formatPrice(95.5, "USD")    → "$95.50 USD"
 *   formatPrice(null)           → "$0.00 MXN"
 *
 * @param {number|string|null|undefined} amount
 * @param {string} [currency] ISO 4217. Defaults to "MXN".
 * @returns {string}
 */
export function formatPrice(amount, currency = DEFAULT_CURRENCY) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return `$0.00 ${currency}`;
  const formatted = value.toLocaleString(FORMAT_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `$${formatted} ${currency}`;
}

/**
 * Compact variant — symbol + number only, no currency code.
 * Useful in tight spaces (cart line items, header cart total, KPI cards).
 * Pair with a separate currency badge or label for clarity.
 *
 *   formatPriceCompact(129)     → "$129.00"
 *   formatPriceCompact(0)       → "$0.00"
 *
 * @param {number|string|null|undefined} amount
 * @returns {string}
 */
export function formatPriceCompact(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "$0.00";
  return `$${value.toLocaleString(FORMAT_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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
