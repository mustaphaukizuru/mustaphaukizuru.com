/**
 * lib/tax — client-side mirror of src/lib/tax.js for DISPLAY only.
 *
 * Prices are IVA-inclusive. The server is the source of truth for what is
 * stored on the order; this helper exists so the cart and checkout can show
 * "includes IVA 16%: MX$16.00" without a round-trip. Keep VITE_TAX_RATE in
 * step with TAX_RATE on the API.
 */
const raw = Number(import.meta.env.VITE_TAX_RATE)
export const TAX_RATE = Number.isFinite(raw) && raw >= 0 && raw < 1 ? raw : 0.16
export const TAX_RATE_PCT = Math.round(TAX_RATE * 10000) / 100

/** IVA contained in an inclusive amount, in cents-exact 2dp. */
export function includedTax(total, rate = TAX_RATE) {
  const cents = Math.round(Number(total || 0) * 100)
  if (!(rate > 0) || cents <= 0) return 0
  return (cents - Math.round(cents / (1 + rate))) / 100
}

/** Prefer the server's snapshot when an order row is available. */
export function orderTax(order) {
  if (order && order.taxAmount != null) return Number(order.taxAmount) || 0
  return includedTax(order?.totalAmount ?? order?.total ?? 0)
}
