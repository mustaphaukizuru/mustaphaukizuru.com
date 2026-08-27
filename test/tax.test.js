/**
 * lib/tax — IVA is contained in listed prices; the breakdown must be exact
 * in cents, apportion discounts between taxable and exempt lines, and read
 * back from an order snapshot without recomputing.
 */
const { computeOrderTax, orderTaxBreakdown, taxRate, DEFAULT_RATE } = require("../src/lib/tax")

describe("computeOrderTax (inclusive IVA)", () => {
  test("116.00 at 16% contains exactly 16.00 of tax", () => {
    const r = computeOrderTax({ items: [{ lineTotal: 116 }], discount: 0, rate: 0.16 })
    expect(r).toEqual({ taxRate: 0.16, taxAmount: 16, taxIncluded: true, taxableAmount: 116, netAmount: 100 })
  })

  test("rounds in cents, never drifts by a fraction", () => {
    const r = computeOrderTax({ items: [{ lineTotal: 99.99 }], rate: 0.16 })
    // 99.99 / 1.16 = 86.198… → 86.20 net, 13.79 tax
    expect(r.netAmount + r.taxAmount).toBeCloseTo(99.99, 2)
    expect(r.taxAmount).toBe(13.79)
  })

  test("exempt lines contribute no tax", () => {
    const r = computeOrderTax({ items: [{ lineTotal: 116 }, { lineTotal: 50, taxExempt: true }], rate: 0.16 })
    expect(r.taxAmount).toBe(16)
    expect(r.taxableAmount).toBe(116)
    expect(r.netAmount).toBe(150)
  })

  test("a discount is apportioned pro rata to the taxable share", () => {
    // 100 taxable + 100 exempt, 20 discount → 10 off each side
    const r = computeOrderTax({ items: [{ lineTotal: 100 }, { lineTotal: 100, taxExempt: true }], discount: 20, rate: 0.16 })
    expect(r.taxableAmount).toBe(90)
    expect(r.taxAmount).toBe(Number((90 - Math.round(9000 / 1.16) / 100).toFixed(2)))
    expect(r.netAmount).toBeCloseTo(180 - r.taxAmount, 2)
  })

  test("rate 0 yields no tax but keeps the totals", () => {
    const r = computeOrderTax({ items: [{ lineTotal: 200 }], discount: 50, rate: 0 })
    expect(r).toMatchObject({ taxRate: 0, taxAmount: 0, netAmount: 150 })
  })

  test("discount larger than the cart clamps to zero", () => {
    const r = computeOrderTax({ items: [{ lineTotal: 10 }], discount: 500, rate: 0.16 })
    expect(r.taxAmount).toBe(0)
    expect(r.netAmount).toBe(0)
  })
})

describe("taxRate env", () => {
  const prev = process.env.TAX_RATE
  afterEach(() => { if (prev === undefined) delete process.env.TAX_RATE; else process.env.TAX_RATE = prev })

  test("defaults to 16%", () => { delete process.env.TAX_RATE; expect(taxRate()).toBe(DEFAULT_RATE) })
  test("honours a valid override", () => { process.env.TAX_RATE = "0.08"; expect(taxRate()).toBe(0.08) })
  test("ignores garbage", () => { process.env.TAX_RATE = "lots"; expect(taxRate()).toBe(DEFAULT_RATE) })
})

describe("orderTaxBreakdown", () => {
  test("reads the snapshot, does not recompute", () => {
    const b = orderTaxBreakdown({ totalAmount: "116.00", taxAmount: "16.00", taxRate: "0.1600", taxIncluded: true })
    expect(b).toEqual({ rate: 0.16, ratePct: 16, tax: 16, net: 100, total: 116, included: true })
  })
  test("legacy orders with no tax columns render as untaxed", () => {
    expect(orderTaxBreakdown({ totalAmount: 50 })).toMatchObject({ tax: 0, net: 50, total: 50, rate: 0 })
  })
})
