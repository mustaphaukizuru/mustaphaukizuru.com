// ─────────────────────────────────────────────────────────────────────────────
// portfolioService — case-study helpers (roadmap step 27)
//
// The case study lives inside the existing `results` Json column as an
// envelope `{ items, caseStudy }`. These tests pin the normalize / split /
// compose / localize contract so the admin form, seed and public pages agree.
//
// Run:  npm test -- portfolioCaseStudy
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({
  portfolio: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), count: jest.fn(), groupBy: jest.fn() },
}))

const prisma = require("../src/lib/prisma")
const {
  SERVICE_SLUGS,
  normalizeCaseStudy,
  splitResults,
  composeResults,
  localizeCaseStudy,
  outcomeLine,
  serializePortfolio,
  getAdjacentPortfolio,
  listPortfolio,
} = require("../src/services/portfolioService")

const sample = {
  serviceSlug: "ai-automation",
  context: " Client context ",
  contextEs: "Contexto",
  problem: "Problem",
  approach: [
    { title: "Step 1", body: "Body 1", titleEs: "Paso 1" },
    "Bare string step",
    { title: "", body: "" },            // dropped — empty
    { title: "S4" }, { title: "S5" }, { title: "S6" }, // capped at 5
  ],
  outcomes: [
    { value: "-40%", label: "deploy time", labelEs: "tiempo de deploy" },
    { value: "3x", label: "throughput", placeholder: true },
    { value: "", label: "" },           // dropped
    { value: "99%", label: "uptime" }, { value: "x", label: "y" }, // capped at 3
  ],
  stack: ["Node", " ", "Prisma"],
}

describe("normalizeCaseStudy", () => {
  test("trims, drops empties, caps approach at 5 and outcomes at 3", () => {
    const cs = normalizeCaseStudy(sample)
    expect(cs.serviceSlug).toBe("ai-automation")
    expect(cs.context).toBe("Client context")
    expect(cs.approach).toHaveLength(5)
    expect(cs.approach[1]).toMatchObject({ title: "Bare string step", body: null })
    expect(cs.outcomes).toHaveLength(3)
    expect(cs.outcomes[1].placeholder).toBe(true)
    expect(cs.outcomes[0].placeholder).toBe(false)
    expect(cs.stack).toEqual(["Node", "Prisma"])
  })

  test("rejects unknown service slugs and empty blocks", () => {
    expect(normalizeCaseStudy({ serviceSlug: "nope" })).toBeNull()
    expect(normalizeCaseStudy(null)).toBeNull()
    expect(normalizeCaseStudy("not json")).toBeNull()
    expect(normalizeCaseStudy([])).toBeNull()
    expect(SERVICE_SLUGS).toContain("digital-product-engineering")
  })

  test("accepts a JSON string (form posts)", () => {
    expect(normalizeCaseStudy(JSON.stringify({ problem: "P" })).problem).toBe("P")
  })
})

describe("splitResults / composeResults", () => {
  test("legacy string[] results keep working", () => {
    expect(splitResults(["a", "b"])).toEqual({ items: ["a", "b"], caseStudy: null })
    expect(splitResults('["x"]')).toEqual({ items: ["x"], caseStudy: null })
    expect(splitResults(null)).toEqual({ items: [], caseStudy: null })
  })

  test("envelope round-trips", () => {
    const stored = composeResults(["r1", " ", "r2"], sample)
    expect(stored.items).toEqual(["r1", "r2"])
    expect(stored.caseStudy.serviceSlug).toBe("ai-automation")
    const back = splitResults(stored)
    expect(back.items).toEqual(["r1", "r2"])
    expect(back.caseStudy.outcomes).toHaveLength(3)
  })

  test("compose without a case study stays a plain array (no envelope churn)", () => {
    expect(composeResults(["a"], null)).toEqual(["a"])
    expect(composeResults(["a"], {})).toEqual(["a"])
  })
})

describe("localizeCaseStudy + outcomeLine", () => {
  test("es picks *Es siblings with English fallback, en is untouched", () => {
    const cs = normalizeCaseStudy(sample)
    const es = localizeCaseStudy(cs, "es")
    expect(es.context).toBe("Contexto")
    expect(es.problem).toBe("Problem")
    expect(es.approach[0].title).toBe("Paso 1")
    expect(es.approach[0].body).toBe("Body 1")
    expect(es.outcomes[0].label).toBe("tiempo de deploy")
    expect(localizeCaseStudy(cs, "en")).toBe(cs)
  })

  test("outcomeLine joins the first two outcomes", () => {
    const cs = normalizeCaseStudy(sample)
    expect(outcomeLine(cs)).toBe("-40% deploy time · 3x throughput")
    expect(outcomeLine(null)).toBeNull()
  })
})

describe("serializePortfolio", () => {
  const row = {
    id: "p1", title: "T", slug: "t", role: "R", category: "C", shortDescription: "S",
    status: "published", isFeatured: false, displayOrder: 0,
    results: composeResults(["legacy"], sample),
  }

  test("exposes results[] + caseStudy + outcomeLine + placeholder flag", () => {
    const out = serializePortfolio(row)
    expect(out.results).toEqual(["legacy"])
    expect(out.caseStudy.serviceSlug).toBe("ai-automation")
    expect(out.outcomeLine).toBe("-40% deploy time · 3x throughput")
    expect(out.hasPlaceholderMetrics).toBe(true)
  })

  test("localises the case study when locale=es", () => {
    expect(serializePortfolio(row, "es").caseStudy.context).toBe("Contexto")
  })

  test("rows without a case study serialize with caseStudy=null", () => {
    const out = serializePortfolio({ ...row, results: ["only"] })
    expect(out.caseStudy).toBeNull()
    expect(out.outcomeLine).toBeNull()
    expect(out.hasPlaceholderMetrics).toBe(false)
  })
})

describe("getAdjacentPortfolio", () => {
  const rows = [
    { id: "a", slug: "a", title: "A", titleEs: null, coverImage: null, category: "X" },
    { id: "b", slug: "b", title: "B", titleEs: "Bes", coverImage: "/b.png", category: "X" },
    { id: "c", slug: "c", title: "C", titleEs: null, coverImage: null, category: "Y" },
  ]

  beforeEach(() => prisma.portfolio.findMany.mockResolvedValue(rows))

  test("wraps around and localises titles", async () => {
    const first = await getAdjacentPortfolio("a", "es")
    expect(first.prev.slug).toBe("c")
    expect(first.next).toMatchObject({ slug: "b", title: "Bes" })
    const last = await getAdjacentPortfolio("c")
    expect(last.next.slug).toBe("a")
  })

  test("returns nulls for unknown id", async () => {
    expect(await getAdjacentPortfolio("zzz")).toEqual({ prev: null, next: null })
  })
})

describe("listPortfolio service filter", () => {
  beforeEach(() => {
    prisma.portfolio.findMany.mockReset()
    prisma.portfolio.findMany.mockResolvedValue([])
    prisma.portfolio.count.mockResolvedValue(0)
    prisma.portfolio.groupBy.mockResolvedValue([])
  })

  test("adds a JSON-path filter for a known service slug only", async () => {
    await listPortfolio({ service: "cloud-architecture-migration" })
    expect(prisma.portfolio.findMany.mock.calls[0][0].where.results)
      .toEqual({ path: "$.caseStudy.serviceSlug", equals: "cloud-architecture-migration" })

    prisma.portfolio.findMany.mockClear()
    await listPortfolio({ service: "bogus" })
    expect(prisma.portfolio.findMany.mock.calls[0][0].where.results).toBeUndefined()
  })
})
