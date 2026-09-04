/* Locale helpers for the static catalogue: every entry carries an English
 * field plus a `<field>Es` twin. Spanish is the primary voice (PDF); English
 * is a faithful translation. */
import { useTranslation } from "react-i18next"
import { formatPriceWhole } from "../../lib/format"

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

/**
 * offeringPriceLabel(offering, t) → always both currencies, USD first:
 * "$750 USD · MX$15,000" | "Desde $1,925 USD · MX$38,500" | "Desde $775
 * USD · MX$15,500/mes" | t("funnel.pricing.quote") when no price is set.
 * Fixed = a settled figure. From-quote / Retainer = a starting figure,
 * confirmed in the written proposal (see servicesCatalogue.js header).
 */
export function offeringPriceLabel(offering, t) {
  if (!offering) return ""
  const { pricingModel: model, priceMxn, priceUsd, priceFromMxn, priceFromUsd } = offering
  if (model === "Fixed" && priceMxn) {
    const both = `${formatPriceWhole(priceUsd, "USD")} · ${formatPriceWhole(priceMxn, "MXN")}`
    return both
  }
  if (priceFromMxn) {
    const both = `${formatPriceWhole(priceFromUsd, "USD")} · ${formatPriceWhole(priceFromMxn, "MXN")}`
    const base = `${t("funnel.pricing.from")} ${both}`
    return model === "Retainer" ? `${base}${t("funnel.pricing.perMonth")}` : base
  }
  return pricingLabel(t, model)
}
