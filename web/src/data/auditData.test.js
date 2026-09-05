/**
 * The self-audit instrument (T2-3).
 *
 * The old one had 82 statements keyed to a retired SKU taxonomy: 38 of them
 * pointed at offerings that no longer exist, so a visitor could be told their
 * biggest gap was a service the site does not sell. Every statement was
 * English-only. And the bundle screen recommended programmes composed
 * entirely of retired ids.
 *
 * The first test here is the one that matters: every statement's
 * offeringSlug has to resolve through the catalogue. That is the invariant
 * the old instrument violated 38 times, and the only thing that keeps the
 * result screen a real funnel entry rather than a dead end.
 */
import { describe, expect, it } from "vitest"

import {
  AUDIT_SECTIONS,
  PREQUAL_CHALLENGES,
  PREQUAL_TIMELINES,
  TIERS,
  auditLength,
  benchmarkFor,
  computeOverall,
  computeSectionScores,
  computeTopPriorities,
  itemsForAudience,
  offeringForItem,
  recommendCategory,
  sectionsForAudience,
  tierForScore,
} from "./auditData"
import { CATEGORIES, getOfferingBySlug } from "./servicesCatalogue"

const ALL_ITEMS = AUDIT_SECTIONS.flatMap((s) => s.items)
const AUDIENCES = ["SMB", "EDU", "IND"]

describe("every statement points at something we actually sell", () => {
  it("resolves every offeringSlug through the catalogue", () => {
    const broken = ALL_ITEMS
      .filter((it) => !getOfferingBySlug(it.offeringSlug))
      .map((it) => `${it.id} → ${it.offeringSlug}`)
    expect(broken).toEqual([])
  })

  it("asks each audience only about offerings sold to that audience", () => {
    // A priority recommends its offering. Recommending a service to an
    // audience it is not sold to is exactly the drift this rebuild removed.
    const wrong = []
    for (const item of ALL_ITEMS) {
      const offering = getOfferingBySlug(item.offeringSlug)
      const extra = item.audiences.filter((a) => !offering.audience.includes(a))
      if (extra.length) wrong.push(`${item.id}: ${extra.join(",")} not in ${offering.slug} [${offering.audience.join(",")}]`)
    }
    expect(wrong).toEqual([])
  })

  it("carries no trace of the retired SKU taxonomy", () => {
    const json = JSON.stringify(AUDIT_SECTIONS)
    expect(json).not.toMatch(/UKZ-(CS|BD|IC|WD|ET|MS)-/)
  })
})

describe("the instrument is the length it should be", () => {
  it("has one section per catalogue category, in the catalogue's order", () => {
    expect(AUDIT_SECTIONS.map((s) => s.code)).toEqual(CATEGORIES.map((c) => c.code))
  })

  it("names each section exactly as the catalogue does", () => {
    for (const section of AUDIT_SECTIONS) {
      const category = CATEGORIES.find((c) => c.code === section.code)
      expect(section.title).toBe(category.name)
      expect(section.titleEs).toBe(category.nameEs)
    }
  })

  it("holds 30 to 36 statements with unique ids", () => {
    expect(ALL_ITEMS.length).toBeGreaterThanOrEqual(30)
    expect(ALL_ITEMS.length).toBeLessThanOrEqual(36)
    const ids = ALL_ITEMS.map((it) => it.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("gives every audience a usable audit, not a token one", () => {
    for (const audience of AUDIENCES) {
      const { items, sections } = auditLength(audience)
      expect(items, `${audience} has too few statements`).toBeGreaterThanOrEqual(8)
      expect(sections, `${audience} sees too few sections`).toBeGreaterThanOrEqual(2)
    }
  })

  it("reports a length that matches what it actually asks", () => {
    // The page used to advertise "82 items · All 6 sections" from hardcoded
    // strings. This is the derived replacement, so it must agree with the data.
    for (const audience of AUDIENCES) {
      const counted = sectionsForAudience(audience)
        .reduce((n, s) => n + itemsForAudience(s, audience).length, 0)
      expect(auditLength(audience).items).toBe(counted)
    }
  })
})

describe("everything a visitor reads exists in both languages", () => {
  it("every statement and risk is authored in Spanish, not left in English", () => {
    const gaps = []
    for (const item of ALL_ITEMS) {
      for (const field of ["statement", "risk"]) {
        if (!item[field]) gaps.push(`${item.id}.${field}`)
        if (!item[`${field}Es`]) gaps.push(`${item.id}.${field}Es`)
        else if (item[field] === item[`${field}Es`]) gaps.push(`${item.id}.${field}Es is the English string`)
      }
    }
    expect(gaps).toEqual([])
  })

  it("section framing, score bands and prequal options are bilingual too", () => {
    const gaps = []
    for (const s of AUDIT_SECTIONS) {
      if (!s.introEs || s.introEs === s.intro) gaps.push(`section ${s.code} intro`)
    }
    for (const t of TIERS) {
      for (const f of ["name", "headline", "desc"]) {
        if (!t[`${f}Es`] || t[`${f}Es`] === t[f]) gaps.push(`tier ${t.name} ${f}`)
      }
    }
    for (const list of [PREQUAL_CHALLENGES, PREQUAL_TIMELINES]) {
      for (const o of list) {
        if (!o.id || !o.label || !o.labelEs || o.label === o.labelEs) gaps.push(`prequal ${o.id || "?"}`)
      }
    }
    expect(gaps).toEqual([])
  })
})

describe("scoring", () => {
  const answerAll = (audience, value) => {
    const scores = {}
    for (const s of sectionsForAudience(audience)) {
      for (const it of itemsForAudience(s, audience)) scores[it.id] = value
    }
    return scores
  }

  it("all zeros is 0 and all fours is 100", () => {
    expect(computeOverall(answerAll("SMB", 0), "SMB").pct).toBe(0)
    expect(computeOverall(answerAll("SMB", 4), "SMB").pct).toBe(100)
  })

  it("an unanswered audit scores 0 without dividing by zero", () => {
    expect(computeOverall({}, "SMB")).toEqual({ pct: 0, raw: 0, max: expect.any(Number) })
    expect(computeOverall({}, "nobody")).toEqual({ pct: 0, raw: 0, max: 0 })
  })

  it("section scores count only that audience's items", () => {
    const scores = answerAll("EDU", 2)
    const sections = computeSectionScores(scores, "EDU")
    for (const [letter, s] of Object.entries(sections)) {
      const section = AUDIT_SECTIONS.find((x) => x.letter === letter)
      expect(s.total).toBe(itemsForAudience(section, "EDU").length)
      expect(s.answered).toBe(s.total)
      expect(s.pct).toBe(50)
    }
  })

  it("every score lands in exactly one band", () => {
    for (let pct = 0; pct <= 100; pct += 1) {
      const matches = TIERS.filter((t) => pct >= t.min && pct <= t.max)
      expect(matches, `pct ${pct}`).toHaveLength(1)
      expect(tierForScore(pct)).toBe(matches[0])
    }
  })

  it("benchmarks exist for every audience a section serves", () => {
    for (const section of AUDIT_SECTIONS) {
      for (const audience of section.audiences) {
        expect(benchmarkFor(section, audience), `${section.code}/${audience}`).toBeGreaterThan(0)
      }
    }
  })
})

describe("priorities", () => {
  const lowSmb = () => {
    const scores = {}
    for (const s of sectionsForAudience("SMB")) {
      for (const it of itemsForAudience(s, "SMB")) scores[it.id] = 1
    }
    return scores
  }

  it("only surfaces gaps — a score above 2 is not a priority", () => {
    const scores = {}
    for (const s of sectionsForAudience("SMB")) {
      for (const it of itemsForAudience(s, "SMB")) scores[it.id] = 4
    }
    expect(computeTopPriorities(scores, "SMB")).toEqual([])
  })

  it("returns at most n, worst first, weight breaking ties", () => {
    const priorities = computeTopPriorities(lowSmb(), "SMB", 5)
    expect(priorities).toHaveLength(5)
    for (let i = 1; i < priorities.length; i += 1) {
      const prev = priorities[i - 1]
      const cur = priorities[i]
      expect(prev.score).toBeLessThanOrEqual(cur.score)
      if (prev.score === cur.score) expect(prev.weight).toBeGreaterThanOrEqual(cur.weight)
    }
  })

  it("attaches a live offering to every priority", () => {
    for (const p of computeTopPriorities(lowSmb(), "SMB", 10)) {
      expect(p.offering).toBeTruthy()
      expect(p.offering.slug).toBe(p.offeringSlug)
      expect(p.offering.category.slug).toBeTruthy()
      // Both halves of the funnel link the result screen builds.
      expect(getOfferingBySlug(p.offeringSlug)).toBeTruthy()
    }
  })

  it("carries the Spanish copy through, so the result screen can localize", () => {
    for (const p of computeTopPriorities(lowSmb(), "SMB", 3)) {
      expect(p.statementEs).toBeTruthy()
      expect(p.riskEs).toBeTruthy()
      expect(p.statementEs).not.toBe(p.statement)
    }
  })
})

describe("the recommendation is a real category", () => {
  it("recommends the category the gaps cluster in", () => {
    const scores = {}
    const cam = AUDIT_SECTIONS.find((s) => s.code === "CAM")
    for (const it of itemsForAudience(cam, "SMB")) scores[it.id] = 0
    const category = recommendCategory(computeTopPriorities(scores, "SMB", 5))
    expect(category).toBeTruthy()
    expect(category.code).toBe("CAM")
    // It is the catalogue's own object, so the result screen can link to it.
    expect(CATEGORIES).toContain(category)
  })

  it("returns null when there is nothing to recommend", () => {
    expect(recommendCategory([])).toBeNull()
    expect(recommendCategory()).toBeNull()
  })

  it("never invents a programme that is not in the catalogue", () => {
    // SOLUTIONS used to name things like "School Tech Transformation
    // Program" at "$8,000 – $24,000 USD", which existed nowhere else.
    const scores = {}
    for (const s of sectionsForAudience("EDU")) {
      for (const it of itemsForAudience(s, "EDU")) scores[it.id] = 0
    }
    const category = recommendCategory(computeTopPriorities(scores, "EDU", 5))
    expect(CATEGORIES.map((c) => c.slug)).toContain(category.slug)
  })
})

describe("offeringForItem", () => {
  it("resolves an item and tolerates nothing", () => {
    expect(offeringForItem(ALL_ITEMS[0]).slug).toBe(ALL_ITEMS[0].offeringSlug)
    expect(offeringForItem(null)).toBeNull()
    expect(offeringForItem({ offeringSlug: "not-a-real-slug" })).toBeNull()
  })
})
