/**
 * Package / offering overlaps (T2-11).
 *
 * Five capabilities are sold twice at different prices depending on which page
 * the visitor entered through: a monthly package bundles the capability, and
 * the catalogue sells the same work as a scoped project. A client comparing
 * both pages reached two different numbers with nothing on either page
 * acknowledging the other.
 *
 * Whether that pricing is right is the owner's decision (ADR 0007), and it is
 * not decided here. What is asserted here is that the relation is complete,
 * correct in both directions, and derived rather than declared — so whichever
 * way the pricing lands, the two pages agree about which things are the same
 * thing.
 */
import { describe, expect, it } from "vitest"

import {
  AUDIENCE_PRICING_PLANS,
  PACKAGE_OFFERING_OVERLAPS,
  getOfferingBySlug,
  offeringForFeature,
  packagesIncluding,
} from "./servicesCatalogue"

describe("every declared overlap points at something real", () => {
  it("names an offering that exists", () => {
    const missing = PACKAGE_OFFERING_OVERLAPS
      .filter((o) => !getOfferingBySlug(o.offeringSlug))
      .map((o) => o.offeringSlug)
    expect(missing).toEqual([])
  })

  it("names an audience that exists", () => {
    const missing = PACKAGE_OFFERING_OVERLAPS
      .filter((o) => !AUDIENCE_PRICING_PLANS[o.audience])
      .map((o) => o.audience)
    expect(missing).toEqual([])
  })

  it("quotes a feature string the plan actually has", () => {
    // The load-bearing one. The feature is matched by value, not by index,
    // because the features array's order is already a positional dependency
    // (each tier's `includes` lines up with it). Copy-editing a feature
    // without updating the overlap list must fail here rather than silently
    // dropping the cross-reference from both pages.
    const orphans = PACKAGE_OFFERING_OVERLAPS
      .filter((o) => !(AUDIENCE_PRICING_PLANS[o.audience]?.features || []).includes(o.feature))
      .map((o) => `${o.audience}: "${o.feature}"`)
    expect(orphans).toEqual([])
  })

  it("covers the five known overlaps and no duplicates", () => {
    expect(PACKAGE_OFFERING_OVERLAPS).toHaveLength(5)
    const keys = PACKAGE_OFFERING_OVERLAPS.map((o) => `${o.audience}:${o.feature}`)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe("the including tier is derived, not declared", () => {
  it.each([
    ["cross-platform-api-pipelines", "Business", "Basic"],
    ["mvp-web-app-development", "Business", "Basic"],
    ["zero-trust-security-hardening", "Business", "Medium"],
    ["disaster-recovery-planning", "Business", "Medium"],
    ["compliance-risk-assessment", "Schools", "Medium"],
  ])("%s is included from %s %s", (slug, planName, tierName) => {
    const [inc] = packagesIncluding(slug)
    expect(inc).toBeTruthy()
    expect(inc.planName).toBe(planName)
    expect(inc.tierName).toBe(tierName)
  })

  it("really is the LOWEST including tier", () => {
    // "Included in Business Medium and above" is only true if no cheaper tier
    // includes it. Read the matrix directly rather than trusting the helper.
    for (const inc of PACKAGE_OFFERING_OVERLAPS.flatMap((o) => packagesIncluding(o.offeringSlug))) {
      const plan = AUDIENCE_PRICING_PLANS[inc.audience]
      const index = plan.features.indexOf(inc.feature)
      const order = ["basic", "medium", "advanced"]
      const below = order.slice(0, order.indexOf(inc.tierKey))
      for (const key of below) {
        expect(plan.tiers[key].includes[index]).toBe(false)
      }
      expect(plan.tiers[inc.tierKey].includes[index]).toBe(true)
    }
  })

  it("returns nothing for the offerings that are sold one way only", () => {
    // Most of the catalogue. A stray inclusion line would be a claim that the
    // package covers work it does not.
    expect(packagesIncluding("software-stack-audit")).toEqual([])
    expect(packagesIncluding("fractional-cto")).toEqual([])
    expect(packagesIncluding("nonexistent-slug")).toEqual([])
  })
})

describe("the inverse direction agrees", () => {
  it("maps every overlapped feature back to its offering", () => {
    for (const o of PACKAGE_OFFERING_OVERLAPS) {
      const offering = offeringForFeature(o.audience, o.feature)
      expect(offering).toBeTruthy()
      expect(offering.slug).toBe(o.offeringSlug)
    }
  })

  it("is null for an ordinary feature", () => {
    const plan = AUDIENCE_PRICING_PLANS.business
    const plain = plan.features.find(
      (f) => !PACKAGE_OFFERING_OVERLAPS.some((o) => o.feature === f),
    )
    expect(offeringForFeature("business", plain)).toBeNull()
    expect(offeringForFeature("business", "not a feature")).toBeNull()
    expect(offeringForFeature("nope", plan.features[0])).toBeNull()
  })

  it("round-trips: offering → package → feature → the same offering", () => {
    for (const o of PACKAGE_OFFERING_OVERLAPS) {
      const [inc] = packagesIncluding(o.offeringSlug)
      expect(offeringForFeature(inc.audience, inc.feature).slug).toBe(o.offeringSlug)
    }
  })
})

describe("the offering page can build a link that goes somewhere", () => {
  it("every overlapped offering belongs to a category, so the link resolves", () => {
    // The checkout links back to /services/<categorySlug>#<offeringSlug>.
    // getOfferingBySlug returns the category OBJECT (`category`), not a
    // `categorySlug` string — that field lives on the flat SERVICES list,
    // which is a different shape of the same data. Reading the wrong one
    // rendered /services/undefined#slug, which is how this test earned its
    // place.
    const broken = PACKAGE_OFFERING_OVERLAPS
      .map((o) => getOfferingBySlug(o.offeringSlug))
      .filter((o) => !o?.category?.slug)
      .map((o) => o?.slug)
    expect(broken).toEqual([])
  })
})
