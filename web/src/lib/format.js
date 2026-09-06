// web/src/lib/format.js
import i18next from "i18next";
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
// Locale for non-currency number/date formatting (counts, dates, times)
// follows the ACTIVE i18n language: "es" → "es-MX", "en" → "en-US".
// Examples (en): "1,500" · "May 8, 2026" · "May 8, 2026 · 12:01 PM"
//          (es): "1,500" · "8 may 2026"  · "8 may 2026 · 12:01 p.m."
const FORMAT_LOCALES = { en: "en-US", es: "es-MX" };
const DEFAULT_FORMAT_LOCALE = FORMAT_LOCALES.es; // Spanish-first default

/**
 * BCP-47 tag for dates/counts. Pass an i18n language ("es", "en-GB") or
 * omit it to read `i18next.language`. Anything unknown → es-MX.
 * @param {string} [lang]
 * @returns {string}
 */
export function resolveFormatLocale(lang) {
  const raw = typeof lang === "string" && lang ? lang : i18next.language;
  const base = String(raw || "").toLowerCase().split("-")[0];
  return FORMAT_LOCALES[base] || DEFAULT_FORMAT_LOCALE;
}

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
 * Whole-unit price for compact surfaces (package cards, search results,
 * recently-viewed strip): "MX$5,800". Same locale pin as formatPrice.
 *
 *   formatPriceWhole(5800)        → "MX$5,800"
 *   formatPriceWhole(95.5, "USD") → "$96"
 *
 * @param {number|string|null|undefined} amount
 * @param {string} [currency]
 * @returns {string}
 */
export function formatPriceWhole(amount, currency = DEFAULT_CURRENCY) {
  const value = Number(amount);
  const safe = Number.isFinite(value) ? value : 0;
  try {
    return new Intl.NumberFormat(PRICE_LOCALE, {
      style: "currency",
      currency: currency || DEFAULT_CURRENCY,
      maximumFractionDigits: 0,
    }).format(safe);
  } catch {
    return `${currency} ${Math.round(safe)}`;
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
 * @param {string} [lang] i18n language; defaults to the active one.
 * @returns {string}
 */
export function formatCount(n, lang) {
  const value = Number(n);
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString(resolveFormatLocale(lang));
}

/**
 * Format a date as "May 8, 2026" (en) / "8 may 2026" (es).
 * @param {Date|string|number} d
 * @param {string} [lang] i18n language; defaults to the active one.
 * @param {Intl.DateTimeFormatOptions} [options] override the default parts.
 * @returns {string}
 */
export function formatDate(d, lang, options) {
  // `new Date(null)` is epoch 0 — a VALID date — so a null reaching here
  // rendered "Jan 1, 1970" rather than nothing. Most callers guard with
  // `d ? fmt(d) : "—"`, which is why it was never seen; the ones that do not
  // would have shown a client a 1970 due date.
  if (d === null || d === undefined || d === "") return "";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(resolveFormatLocale(lang), {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(options || {}),
  });
}

/**
 * Format a DATE-ONLY value as "May 8, 2026" / "8 may 2026", in UTC.
 *
 * WHY THIS IS SEPARATE FROM formatDate (D0-2)
 *
 * A field a person picked in an `<input type="date">` arrives as the string
 * "2026-06-01", and `new Date("2026-06-01")` is MIDNIGHT UTC. Render that
 * with the browser's local timezone and every user west of Greenwich sees
 * the previous day: in Mexico City, UTC-6, a project due 1 October reads
 * "Sep 30" and a milestone due the 1st reads as the last of the month.
 *
 * That is the entire home market, and it was wrong on every due date,
 * start date and invoice due date on the dashboard.
 *
 * So the rule is about the VALUE, not the display:
 *
 *   formatDay   a calendar day somebody chose — dueDate, startDate, dueAt,
 *               estimatedAt, a time entry's date, an invoice's dueDate.
 *               Rendered in UTC, because that is the timezone it was
 *               stored in and it does not denote an instant.
 *
 *   formatDate  a real instant the server stamped — createdAt, paidAt,
 *               completedAt, issuedAt, viewedAt. Rendered LOCAL, because
 *               "when did this happen" is a question about the reader's
 *               own clock.
 *
 * Getting this backwards is invisible in London and wrong everywhere else,
 * which is why it survived: the formatter is correct for half the fields it
 * was used on.
 *
 * @param {Date|string|number} d
 * @param {string} [lang] i18n language; defaults to the active one.
 * @param {Intl.DateTimeFormatOptions} [options] override the default parts.
 * @returns {string}
 */
export function formatDay(d, lang, options) {
  // `new Date(null)` is epoch 0 — a VALID date — so a null reaching here
  // rendered "Jan 1, 1970" rather than nothing. Most callers guard with
  // `d ? fmt(d) : "—"`, which is why it was never seen; the ones that do not
  // would have shown a client a 1970 due date.
  if (d === null || d === undefined || d === "") return "";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(resolveFormatLocale(lang), {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(options || {}),
    // Last, so a caller cannot accidentally override the one thing that
    // makes this function different from formatDate.
    timeZone: "UTC",
  });
}

/**
 * Format a date+time as "May 8, 2026 · 12:01 PM" (en) / "8 may 2026 · 12:01 p.m." (es).
 * @param {Date|string|number} d
 * @param {string} [lang] i18n language; defaults to the active one.
 * @returns {string}
 */
export function formatDateTime(d, lang) {
  // `new Date(null)` is epoch 0 — a VALID date — so a null reaching here
  // rendered "Jan 1, 1970" rather than nothing. Most callers guard with
  // `d ? fmt(d) : "—"`, which is why it was never seen; the ones that do not
  // would have shown a client a 1970 due date.
  if (d === null || d === undefined || d === "") return "";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  const locale = resolveFormatLocale(lang);
  const datePart = date.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const timePart = date.toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${datePart} · ${timePart}`;
}
