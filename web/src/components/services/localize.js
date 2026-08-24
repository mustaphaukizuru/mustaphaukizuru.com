/* Locale helpers for the static catalogue: every entry carries an English
 * field plus a `<field>Es` twin. Spanish is the primary voice (PDF); English
 * is a faithful translation. */
import { useTranslation } from "react-i18next"

export function isSpanish(lang) {
  return String(lang || "").toLowerCase().startsWith("es")
}

/** pick(entry, "name", "es") → entry.nameEs || entry.name */
export function pick(entry, field, lang) {
  if (!entry) return ""
  if (isSpanish(lang)) return entry[`${field}Es`] || entry[field] || ""
  return entry[field] || ""
}

export function useCatalogueLang() {
  const { i18n } = useTranslation()
  return i18n?.language || "en"
}

/** i18n label for a catalogue pricingModel ("Fixed" | "Retainer" | "From quote"). */
export function pricingLabel(t, model) {
  if (model === "Fixed") return t("funnel.pricing.fixed")
  if (model === "Retainer") return t("funnel.pricing.retainer")
  return t("funnel.pricing.quote")
}
