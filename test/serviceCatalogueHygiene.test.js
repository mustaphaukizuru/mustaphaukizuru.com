// ─────────────────────────────────────────────────────────────────────────────
// T2-4 · catalogue hygiene, asserted where it can regress.
//
// The Service table holds three kinds of row and only one of them is public:
//
//   1. the four catalogue categories — the closed set, the real
//      /services/:slug pages;
//   2. three audience-plan carriers ("<audience>-plan", audienceCode set)
//      that exist only to hang the plan-matrix packages off — no page;
//   3. four rows from the pre-catalogue taxonomy, soft-deleted by
//      scripts/retire-legacy-services.js.
//
// Every public read used to filter on status and deletedAt alone, so the
// listing served eleven rows against a catalogue of four and
// /services/business-plan rendered as a service page. These tests read the
// `where` each query actually sends, because that is the thing that broke.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({
  service: { findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn() },
}))

jest.mock("../src/utils/logger", () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}))

const fs = require("fs")
const path = require("path")

const prisma = require("../src/lib/prisma")
const serviceService = require("../src/services/serviceService")

beforeEach(() => {
  jest.clearAllMocks()
  prisma.service.findMany.mockResolvedValue([])
  prisma.service.findFirst.mockResolvedValue(null)
  prisma.service.count.mockResolvedValue(0)
})

describe("the public service reads exclude everything that is not a category", () => {
  test("listServices asks for published, not-deleted, no audienceCode", async () => {
    await serviceService.listServices({ limit: 10 })
    const { where } = prisma.service.findMany.mock.calls[0][0]
    expect(where).toMatchObject({ status: "published", deletedAt: null, audienceCode: null })
  })

  test("the count matches the query, so pagination cannot disagree with the list", async () => {
    await serviceService.listServices({ limit: 10 })
    const listWhere = prisma.service.findMany.mock.calls[0][0].where
    const countWhere = prisma.service.count.mock.calls[0][0].where
    expect(countWhere).toEqual(listWhere)
  })

  test("isFeatured narrows the same base filter rather than replacing it", async () => {
    await serviceService.listServices({ isFeatured: true })
    const { where } = prisma.service.findMany.mock.calls[0][0]
    expect(where).toMatchObject({ status: "published", deletedAt: null, audienceCode: null, isFeatured: true })
  })

  test("getServiceBySlug refuses an audience-plan carrier — /services/business-plan is not a page", async () => {
    const result = await serviceService.getServiceBySlug("business-plan")
    const { where } = prisma.service.findFirst.mock.calls[0][0]
    expect(where).toMatchObject({ slug: "business-plan", audienceCode: null, deletedAt: null, status: "published" })
    expect(result).toBeNull()
  })

  test("getFeaturedServices and getRelatedServices carry the same filter", async () => {
    await serviceService.getFeaturedServices()
    expect(prisma.service.findMany.mock.calls[0][0].where)
      .toMatchObject({ status: "published", deletedAt: null, audienceCode: null, isFeatured: true })

    jest.clearAllMocks()
    prisma.service.findMany.mockResolvedValue([])
    await serviceService.getRelatedServices("svc_1", 3)
    expect(prisma.service.findMany.mock.calls[0][0].where)
      .toMatchObject({ status: "published", deletedAt: null, audienceCode: null, id: { not: "svc_1" } })
  })

  test("the plan matrix deliberately selects the opposite and still works", async () => {
    await serviceService.listAudiencePlans()
    const { where } = prisma.service.findMany.mock.calls[0][0]
    // audienceCode is a discriminator, not a hide flag: the carriers are
    // exactly what this endpoint wants.
    expect(where).toMatchObject({ audienceCode: { not: null }, status: "published", deletedAt: null })
  })
})

describe("the seeds cannot put back what was taken out", () => {
  const read = (rel) => fs.readFileSync(path.join(__dirname, "..", rel), "utf8")
  // Comments explain the removals, so assert against code with them stripped.
  const code = (rel) => read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")

  test("services-seed no longer defines the four retired services", () => {
    const src = code("prisma/seed/services-seed.js")
    for (const slug of [
      "branding-digital-presence",
      "digital-transformation-consulting",
      "it-infrastructure",
      "cloud-migration-automation",
    ]) {
      expect(src).not.toContain(slug)
    }
  })

  test("services-seed still defines all four catalogue categories", () => {
    const src = code("prisma/seed/services-seed.js")
    for (const slug of [
      "it-strategy-consulting",
      "ai-automation",
      "cloud-architecture-migration",
      "digital-product-engineering",
    ]) {
      expect(src).toContain(slug)
    }
  })

  test("products-seed no longer sells services as downloads", () => {
    const src = code("prisma/seed/products-seed.js")
    for (const slug of ["consulting-session-package", "website-system-setup", "infrastructure-audit"]) {
      expect(src).not.toContain(slug)
    }
  })

  test("the two migrated engagements exist as packages under their category", () => {
    const src = read("prisma/seed/services-seed.js")
    expect(src).toContain("IT Infrastructure Audit")
    expect(src).toContain("Website & Digital System Setup")
  })
})

describe("store prices are MXN and plausible", () => {
  // The seed asserts this at run time; this proves the assertion is wired and
  // that the data passes it, without touching a database.
  const src = fs.readFileSync(path.join(__dirname, "..", "prisma", "seed", "products-seed.js"), "utf8")

  test("prices are authored in USD and multiplied, not written raw", () => {
    expect(src).toContain("const MXN_PER_USD = 20")
    expect(src).toContain("price: p.priceUsd * MXN_PER_USD")
    // A bare `price:` on a product literal would be the old bug returning.
    expect(src).not.toMatch(/\n {4}price: \d/)
  })

  test("a figure below the MXN floor is refused", () => {
    expect(src).toContain("function assertPlausiblePrices()")
    expect(src).toContain("const MIN_MXN = 50")
    expect(src).toContain("assertPlausiblePrices()")
  })

  test("every authored price clears the floor once converted", () => {
    const usd = [...src.matchAll(/priceUsd: (\d+)/g)].map((m) => Number(m[1]))
    expect(usd.length).toBeGreaterThanOrEqual(6)
    for (const v of usd) expect(v * 20).toBeGreaterThanOrEqual(50)
  })
})

describe("claims the site cannot keep are gone", () => {
  // These are commitments a one-person practice cannot honour, and an
  // unsourced savings figure a prospect will quote back during scoping.
  const TREE = [
    "web/src/data/servicesCatalogue.js",
    "web/src/seo/pageSeo.js",
    "web/src/seo/pageSeoEs.js",
    "prisma/seed-audience-plans.js",
    "prisma/seed/services-seed.js",
  ]
  const readAll = () => TREE.map((rel) => ({
    rel,
    src: fs.readFileSync(path.join(__dirname, "..", rel), "utf8"),
  }))

  test("no 24/7 or same-day on-site promise", () => {
    const bad = readAll().filter(({ src }) => /24\/7|same-day on-site|24-hour response SLA/.test(src))
    expect(bad.map((b) => b.rel)).toEqual([])
  })

  test("no unsourced up-to-40-percent saving", () => {
    const bad = readAll().filter(({ src }) => /up to 40\s?%|hasta 40\s?%/.test(src))
    expect(bad.map((b) => b.rel)).toEqual([])
  })

  test("one experience figure, not two careers", () => {
    const bad = readAll().filter(({ src }) => /6\+ years|Seis años de experiencia/.test(src))
    expect(bad.map((b) => b.rel)).toEqual([])
  })

  test("structured data names the four categories, not the retired taxonomy", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "web/src/seo/pageSeo.js"), "utf8")
    expect(src).toContain("serviceType: CATEGORIES.map((c) => c.name)")
    expect(src).not.toContain("STEM/Coding/Robotics Programs")
  })
})
