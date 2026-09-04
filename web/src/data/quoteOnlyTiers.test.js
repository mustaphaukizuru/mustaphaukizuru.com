/**
 * Which plan tiers may not be self-served (T2-4).
 *
 * The audience tiers run from MXN 5,800 to MXN 90,000 per month and every one
 * of them linked straight into /checkout/service — so a school could put a
 * 90,000/month retainer on a card with no call, no scope and nothing written
 * down. Refunds here are full-only by policy, so the first thing that goes
 * wrong is a full reversal of a five-figure charge with the work already
 * started.
 *
 * The price rule is the one that has to hold: prices come from the database
 * and are edited in /admin/services, so a name-only list would silently
 * un-gate a tier the moment someone raised its price.
 */
import { describe, expect, it } from "vitest"

import {
  AUDIENCE_PRICING_PLANS,
  QUOTE_ONLY_MXN_PER_MONTH,
  isQuoteOnlyTier,
  planEnquiryHref,
} from "./servicesCatalogue"

describe("the named tiers are always quote-only", () => {
  it.each([
    ["business", "advanced"],
    ["schools", "advanced"],
  ])("%s / %s", (code, tier) => {
    expect(isQuoteOnlyTier(code, tier, 1)).toBe(true)
  })

  it("leaves the entry tiers self-serve", () => {
    expect(isQuoteOnlyTier("professional", "basic", 5800)).toBe(false)
    expect(isQuoteOnlyTier("business", "basic", 17800)).toBe(false)
    expect(isQuoteOnlyTier("schools", "medium", 48000)).toBe(false)
  })
})

describe("the price rule catches what the list does not", () => {
  it("gates anything at or above the threshold, whatever it is called", () => {
    expect(isQuoteOnlyTier("professional", "basic", QUOTE_ONLY_MXN_PER_MONTH)).toBe(true)
    expect(isQuoteOnlyTier("professional", "basic", QUOTE_ONLY_MXN_PER_MONTH + 1)).toBe(true)
  })

  it("does not gate the peso below the threshold", () => {
    expect(isQuoteOnlyTier("professional", "basic", QUOTE_ONLY_MXN_PER_MONTH - 1)).toBe(false)
  })

  it("survives a missing or unparseable price rather than gating everything", () => {
    // A tier whose live price has not loaded yet must still be clickable —
    // the strip renders before /services/plans answers.
    expect(isQuoteOnlyTier("professional", "basic", undefined)).toBe(false)
    expect(isQuoteOnlyTier("professional", "basic", null)).toBe(false)
    expect(isQuoteOnlyTier("professional", "basic", NaN)).toBe(false)
  })

  it("an unknown audience is judged on price alone", () => {
    expect(isQuoteOnlyTier("nonexistent", "advanced", 100)).toBe(false)
    expect(isQuoteOnlyTier("nonexistent", "advanced", 999999)).toBe(true)
  })
})

describe("the catalogue's own tiers land where they should", () => {
  it("gates exactly the two top tiers above the threshold", () => {
    const gated = []
    for (const [code, plan] of Object.entries(AUDIENCE_PRICING_PLANS)) {
      for (const [tierKey, tier] of Object.entries(plan.tiers || {})) {
        if (isQuoteOnlyTier(code, tierKey, tier.priceMxn)) gated.push(`${code}.${tierKey}`)
      }
    }
    expect(gated.sort()).toEqual(["business.advanced", "schools.advanced"])
  })

  it("every gated tier really is the expensive end", () => {
    for (const code of ["business", "schools"]) {
      const tiers = AUDIENCE_PRICING_PLANS[code].tiers
      expect(tiers.advanced.priceMxn).toBeGreaterThan(tiers.medium.priceMxn)
    }
  })
})

describe("where a gated tier sends the visitor", () => {
  it("is the booking page carrying the plan, not the service checkout", () => {
    expect(planEnquiryHref("business", "advanced")).toBe("/book?plan=business.advanced")
  })

  it("encodes the value — it is read back and rendered", () => {
    expect(planEnquiryHref("a b", "c&d")).toBe("/book?plan=a%20b.c%26d")
  })
})
