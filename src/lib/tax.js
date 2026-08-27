/**
 * lib/tax — the ONE place that knows how IVA is computed.
 *
 * Policy (Mexico-first business, CFDI 4.0 ready):
 *   - Prices shown to customers are IVA-INCLUSIVE. A product listed at
 *     MX$116 is MX$100 + MX$16 IVA. Nothing is added at checkout; the
 *     breakdown is what changes. `taxIncluded` records that fact on the
 *     order so a later switch to tax-added pricing cannot misread history.
 *   - Rate comes from TAX_RATE (default 0.16). 0 disables the breakdown.
 *   - An item flagged `taxExempt` (exports, zero-rated goods) contributes
 *     nothing to the taxable base. Discounts are apportioned pro rata
 *     between taxable and exempt lines so a coupon on a mixed cart does
 *     not shift tax onto the exempt part.
 *
 * All math is done in cents (integers) and returned as 2-decimal numbers,
 * matching Decimal(12,2) columns. Rate is returned as a 4-decimal number
 * for Decimal(5,4).
 */

const DEFAULT_RATE = 0.16

function taxRate() {
  const raw = process.env.TAX_RATE
  if (raw === undefined || raw === "") return DEFAULT_RATE
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 && n < 1 ? n : DEFAULT_RATE
}

const toCents = (n) => Math.round(Number(n || 0) * 100)
const fromCents = (c) => Number((c / 100).toFixed(2))

/**
 * @param {object} args
 * @param {Array<{lineTotal:number, taxExempt?:boolean}>} args.items
 * @param {number} args.discount   total discount applied to the order
 * @param {number} [args.rate]     override (tests); defaults to TAX_RATE
 * @returns {{ taxRate:number, taxAmount:number, taxIncluded:true, taxableAmount:number, netAmount:number }}
 *   taxableAmount = IVA-inclusive amount the tax was derived from
 *   netAmount     = order total minus taxAmount (the "subtotal antes de IVA")
 */
function computeOrderTax({ items = [], discount = 0, rate = taxRate() }) {
  const lines = items.map((i) => ({ cents: toCents(i.lineTotal), exempt: Boolean(i.taxExempt) }))
  const grossCents    = lines.reduce((s, l) => s + l.cents, 0)
  const taxableGross  = lines.filter((l) => !l.exempt).reduce((s, l) => s + l.cents, 0)
  const discountCents = Math.min(toCents(discount), grossCents)

  // Apportion the discount to the taxable share of the cart.
  const taxableDiscount = grossCents > 0 ? Math.round(discountCents * (taxableGross / grossCents)) : 0
  const taxableCents    = Math.max(0, taxableGross - taxableDiscount)
  const totalCents      = Math.max(0, grossCents - discountCents)

  // Inclusive: tax = gross − gross / (1 + r)
  const taxCents = rate > 0 ? taxableCents - Math.round(taxableCents / (1 + rate)) : 0

  return {
    taxRate:       Number(rate.toFixed(4)),
    taxAmount:     fromCents(taxCents),
    taxIncluded:   true,
    taxableAmount: fromCents(taxableCents),
    netAmount:     fromCents(totalCents - taxCents),
  }
}

/**
 * Breakdown for an already-stored order (invoice/receipt rendering) — reads
 * the snapshot on the row, never recomputes from live prices.
 */
function orderTaxBreakdown(order) {
  const total = Number(order.totalAmount || 0)
  const tax   = Number(order.taxAmount || 0)
  const rate  = Number(order.taxRate || 0)
  return {
    rate,
    ratePct:  Math.round(rate * 10000) / 100,
    tax:      Number(tax.toFixed(2)),
    net:      Number((total - tax).toFixed(2)),
    total:    Number(total.toFixed(2)),
    included: order.taxIncluded !== false,
  }
}

module.exports = { taxRate, computeOrderTax, orderTaxBreakdown, DEFAULT_RATE }
