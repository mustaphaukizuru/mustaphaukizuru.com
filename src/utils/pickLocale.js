// @ts-check
/**
 * pickLocale.js · I18N06 helper · per-field fallback to English
 *
 * Given a row that may carry parallel `*Es` fields and an active locale,
 * return a flattened row where the matching language wins per field.
 * Fields without a Spanish counterpart fall back transparently.
 *
 *   pickLocale({ title: "Hello", titleEs: "Hola" }, "es")
 *     → { title: "Hola", titleEs: "Hola" }
 *
 *   pickLocale({ title: "Hello", titleEs: null }, "es")
 *     → { title: "Hello", titleEs: null }      (English fallback)
 *
 * Use after Prisma reads, before sending the row over the wire. The Es
 * fields stay on the object so admin reads can see both.
 *
 * Locales: only "en" and "es" supported. Other inputs no-op (return as-is).
 *
 * Field convention: any source field `foo` that has a sibling `fooEs`
 * is automatically translated. Pass `extraPairs` to extend mapping for
 * non-conventional names.
 */

const TRANSLATABLE_SUFFIX = "Es"

function pickLocale(row, locale = "en", extraPairs = []) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return row
  if (locale !== "es") return row

  const next = { ...row }

  // Auto-detect: any *Es key with a non-null value swaps the English
  // sibling (key without `Es` suffix). null/undefined Spanish → English fallback.
  for (const key of Object.keys(row)) {
    if (!key.endsWith(TRANSLATABLE_SUFFIX)) continue
    const baseKey = key.slice(0, -TRANSLATABLE_SUFFIX.length)
    if (!(baseKey in row)) continue
    const esValue = row[key]
    if (esValue !== null && esValue !== undefined && String(esValue).trim() !== "") {
      next[baseKey] = esValue
    }
  }

  // Explicit pairs for non-suffix conventions (e.g. {"name": "name_es"})
  for (const [base, es] of extraPairs) {
    if (es in row && row[es] !== null && row[es] !== undefined && String(row[es]).trim() !== "") {
      next[base] = row[es]
    }
  }

  return next
}

/** Apply pickLocale across an array of rows (cheap shallow map). */
function pickLocaleMany(rows, locale = "en", extraPairs = []) {
  if (!Array.isArray(rows)) return rows
  return rows.map((r) => pickLocale(r, locale, extraPairs))
}

/** Recursively translate nested children (e.g. ServicePackages on Service). */
function pickLocaleDeep(row, locale = "en", childKeys = []) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return row
  const next = pickLocale(row, locale)
  for (const childKey of childKeys) {
    if (Array.isArray(next[childKey])) {
      next[childKey] = next[childKey].map((c) => pickLocale(c, locale))
    } else if (next[childKey] && typeof next[childKey] === "object") {
      next[childKey] = pickLocale(next[childKey], locale)
    }
  }
  return next
}

module.exports = { pickLocale, pickLocaleMany, pickLocaleDeep }
