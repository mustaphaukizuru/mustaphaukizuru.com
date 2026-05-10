/**
 * formatters.js · I18N04 · locale-aware formatting
 *
 * Use these instead of inline Number.prototype.toFixed / Date.prototype.toLocaleDateString
 * to guarantee EN/ES consistency.
 *
 * Currency default — Mexican Peso (MXN). Both English and Spanish surfaces
 * display MXN by default; pass an explicit `currency` arg to override
 * (e.g. when a product is priced in USD).
 */

const LOCALE_MAP = { en: "en-US", es: "es-MX" }

export function formatCurrency(amount, currency = "MXN", _lang = "en") {
  // Phase 2 · MXN unification — currency formatting is locale-pinned to
  // en-US so the "MX$" disambiguator always shows, even on Spanish pages.
  // The `lang` arg is preserved for backwards compatibility but ignored;
  // i18n locale still drives dates/numbers/percent in this same module.
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(amount) || 0)
  } catch {
    // Some Node test envs lack ICU data — fall back to a sane string.
    return `${currency} ${(Number(amount) || 0).toFixed(2)}`
  }
}

export function formatDate(date, lang = "en", options = {}) {
  const locale = LOCALE_MAP[lang] || "en-US"
  const defaultOpts = { year: "numeric", month: "long", day: "numeric" }
  return new Intl.DateTimeFormat(locale, { ...defaultOpts, ...options }).format(new Date(date))
}

export function formatDateShort(date, lang = "en") {
  return formatDate(date, lang, { year: "numeric", month: "short", day: "numeric" })
}

export function formatRelativeTime(date, lang = "en") {
  const locale = LOCALE_MAP[lang] || "en-US"
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  const diffMs = new Date(date).getTime() - Date.now()
  const diffMin = Math.round(diffMs / 60_000)
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute")
  const diffHr = Math.round(diffMin / 60)
  if (Math.abs(diffHr) < 24) return rtf.format(diffHr, "hour")
  const diffDay = Math.round(diffHr / 24)
  if (Math.abs(diffDay) < 30) return rtf.format(diffDay, "day")
  const diffMonth = Math.round(diffDay / 30)
  if (Math.abs(diffMonth) < 12) return rtf.format(diffMonth, "month")
  return rtf.format(Math.round(diffMonth / 12), "year")
}

export function formatNumber(n, lang = "en") {
  const locale = LOCALE_MAP[lang] || "en-US"
  return new Intl.NumberFormat(locale).format(Number(n) || 0)
}

export function formatFileSize(bytes, lang = "en") {
  if (bytes == null) return ""
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${formatNumber(Number(kb.toFixed(1)), lang)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${formatNumber(Number(mb.toFixed(1)), lang)} MB`
  const gb = mb / 1024
  return `${formatNumber(Number(gb.toFixed(2)), lang)} GB`
}

export function formatPercent(n, lang = "en", fractionDigits = 0) {
  const locale = LOCALE_MAP[lang] || "en-US"
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Number(n) || 0)
}
