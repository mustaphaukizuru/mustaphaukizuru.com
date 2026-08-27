// ─────────────────────────────────────────────────────────────────────────────
// services/leadService — unified leads inbox: merge four capture tables on
// lower-cased email, decorate with User + paid-order count, paginate.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({
  contactMessage:       { findMany: jest.fn() },
  diagnosticSubmission: { findMany: jest.fn() },
  newsletterSubscriber: { findMany: jest.fn() },
  consultation:         { findMany: jest.fn() },
  user:                 { findMany: jest.fn() },
  order:                { groupBy: jest.fn() },
}))

const prisma = require("../src/lib/prisma")
const svc = require("../src/services/leadService")

const d = (s) => new Date(s)

function seed() {
  prisma.contactMessage.findMany.mockResolvedValue([
    { id: "c1", name: "Ana Lopez", email: "Ana@Example.com", subject: "Quote", status: "new", createdAt: d("2026-08-20"), message: "Hi there" },
  ])
  prisma.diagnosticSubmission.findMany.mockResolvedValue([
    { id: "d1", name: "Ana", email: "ana@example.com", organization: "Acme", audience: "SMB", overallScore: 42, tier: "Stabilizing", createdAt: d("2026-08-10") },
    { id: "d2", name: "Bob", email: "bob@example.com", organization: null, audience: "IND", overallScore: 80, tier: "Optimizing", createdAt: d("2026-08-25") },
  ])
  prisma.newsletterSubscriber.findMany.mockResolvedValue([
    { id: "n1", name: null, email: "ana@example.com", status: "subscribed", source: "footer", subscribedAt: d("2026-08-01"), unsubscribedAt: null },
  ])
  prisma.consultation.findMany.mockResolvedValue([
    { id: "k1", scheduledAt: d("2026-09-01"), status: "confirmed", createdAt: d("2026-08-22"), durationMin: 30, user: { email: "ANA@example.com", fullName: "Ana L." } },
    { id: "k2", scheduledAt: d("2026-09-02"), status: "pending", createdAt: d("2026-08-23"), durationMin: 30, user: null },
  ])
  prisma.user.findMany.mockResolvedValue([{ id: "u1", email: "ana@example.com", fullName: "Ana Lopez", createdAt: d("2026-07-01") }])
  prisma.order.groupBy.mockResolvedValue([{ userId: "u1", _count: { _all: 2 } }])
}

beforeEach(() => { jest.clearAllMocks(); seed() })

test("merges by lower-cased email, orders by last activity, decorates with user", async () => {
  const { data, meta } = await svc.listLeads({})

  expect(meta).toMatchObject({ total: 2, page: 1, limit: 25, pages: 1, capPerSource: 500 })
  expect(data.map((l) => l.email)).toEqual(["bob@example.com", "ana@example.com"])

  const ana = data[1]
  expect(ana.sources.sort()).toEqual(["booking", "contact", "diagnostic", "newsletter"])
  expect(ana.name).toBe("Ana Lopez")
  expect(ana.firstSeenAt).toEqual(d("2026-08-01"))
  expect(ana.lastActivityAt).toEqual(d("2026-08-22"))
  expect(ana.latest).toMatchObject({ source: "booking", id: "k1", status: "confirmed" })
  expect(ana.user).toEqual({ id: "u1", ordersPaid: 2 })

  const bob = data[0]
  expect(bob.user).toBeNull()
  expect(bob.latest).toMatchObject({ source: "diagnostic", tier: "Optimizing", score: 80 })
})

test("every source is bounded by take ≤ 500 and paid-order count is grouped by user", async () => {
  await svc.listLeads({})
  for (const m of [prisma.contactMessage, prisma.diagnosticSubmission, prisma.newsletterSubscriber, prisma.consultation]) {
    expect(m.findMany.mock.calls[0][0].take).toBeLessThanOrEqual(500)
  }
  expect(prisma.order.groupBy.mock.calls[0][0].where).toMatchObject({ status: "paid", userId: { in: ["u1"] } })
})

test("q narrows in the DB (email/name contains) and consultations go through the user relation", async () => {
  await svc.listLeads({ q: "  ANA " })
  expect(prisma.contactMessage.findMany.mock.calls[0][0].where).toEqual({
    OR: [{ email: { contains: "ana" } }, { name: { contains: "ana" } }],
  })
  expect(prisma.consultation.findMany.mock.calls[0][0].where).toEqual({
    user: { OR: [{ email: { contains: "ana" } }, { fullName: { contains: "ana" } }] },
  })
})

test("source filter reads only that table first, then re-hydrates the page", async () => {
  const { data } = await svc.listLeads({ source: "diagnostic" })
  // first pass: diagnostic only
  expect(prisma.diagnosticSubmission.findMany).toHaveBeenCalled()
  expect(prisma.contactMessage.findMany.mock.calls[0][0].where).toEqual({ email: "bob@example.com" })
  // ana still gets her other sources after hydration
  const ana = data.find((l) => l.email === "ana@example.com")
  expect(ana.sources).toEqual(expect.arrayContaining(["diagnostic", "contact", "newsletter", "booking"]))
  // unknown source falls back to all
  jest.clearAllMocks(); seed()
  await svc.listLeads({ source: "bogus" })
  expect(prisma.contactMessage.findMany.mock.calls[0][0].where).toEqual({})
})

test("pagination clamps page/limit", async () => {
  const { data, meta } = await svc.listLeads({ page: "2", limit: "1" })
  expect(meta).toMatchObject({ total: 2, page: 2, limit: 1, pages: 2 })
  expect(data).toHaveLength(1)
  expect(data[0].email).toBe("ana@example.com")

  const big = await svc.listLeads({ page: "-3", limit: "9999" })
  expect(big.meta).toMatchObject({ page: 1, limit: 100 })
})

test("timeline returns all events newest-first for one email, null when unknown", async () => {
  const r = await svc.getLeadTimeline("ANA@Example.com")
  expect(prisma.contactMessage.findMany.mock.calls[0][0].where).toEqual({ email: "ana@example.com" })
  expect(r.lead.email).toBe("ana@example.com")
  expect(r.lead.user).toMatchObject({ id: "u1", ordersPaid: 2 })
  // the mock returns bob's diagnostic too; a real DB would not — assert order only
  expect(r.timeline.map((e) => e.at.getTime())).toEqual([...r.timeline].map((e) => e.at.getTime()).sort((a, b) => b - a))

  for (const m of [prisma.contactMessage, prisma.diagnosticSubmission, prisma.newsletterSubscriber, prisma.consultation]) {
    m.findMany.mockResolvedValue([])
  }
  prisma.user.findMany.mockResolvedValue([])
  expect(await svc.getLeadTimeline("nobody@example.com")).toBeNull()
  expect(await svc.getLeadTimeline("")).toBeNull()
})

test("mergeEvents keeps first non-empty name and skips events without email", () => {
  const leads = svc.mergeEvents([
    { source: "newsletter", id: "n", email: "x@y.z", name: null, at: d("2026-01-01"), data: {} },
    { source: "contact", id: "c", email: "x@y.z", name: "X", at: d("2026-01-02"), data: {} },
    { source: "contact", id: "c2", email: "", name: "ghost", at: d("2026-01-03"), data: {} },
  ])
  expect(leads).toHaveLength(1)
  expect(leads[0]).toMatchObject({ name: "X", sources: ["newsletter", "contact"], latest: { id: "c" } })
})
