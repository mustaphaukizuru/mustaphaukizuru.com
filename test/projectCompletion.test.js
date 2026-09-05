/**
 * Tier 4 · project completion → review collector + case-study draft.
 *
 *   - PATCH /admin/client-projects/:id to "completed" sends
 *     project.review-request ONCE (not on re-save, not on other statuses)
 *     linking /dashboard/projects/:id?review=1.
 *   - createReview persists projectId; addServiceReview only links a project
 *     the caller owns that was ordered for that service.
 *   - buildCaseStudyDraft maps description → context, first client comment →
 *     problem, milestones → approach, outcomes/stack empty; the row is a
 *     draft Portfolio with a unique slug and a `results` envelope.
 */
jest.mock("../src/lib/prisma", () => ({
  clientProject: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  projectFile:   { findMany: jest.fn() },
  review:        { findFirst: jest.fn(), count: jest.fn(), create: jest.fn() },
  orderItem:     { findFirst: jest.fn() },
  service:       { findFirst: jest.fn() },
  portfolio:     { findUnique: jest.fn(), create: jest.fn() },
  user:          { findUnique: jest.fn() },
}))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))
jest.mock("../src/services/emailService", () => ({ sendTemplateEmail: jest.fn().mockResolvedValue({ ok: true }) }))
jest.mock("../src/services/notificationService", () => ({
  notifyProjectMilestoneCompleted: jest.fn(), notifyReviewPosted: jest.fn().mockResolvedValue(null),
  notifyAdminsProjectActivity: jest.fn(), notifyProjectComment: jest.fn(), notifyMilestoneAwaitingClient: jest.fn(),
  // T5-6 · the controller now also fires these on a real status transition.
  notifyFileRequested: jest.fn().mockResolvedValue(null),
  notifyFileReviewed: jest.fn().mockResolvedValue(null),
  notifyProjectPhase: jest.fn().mockResolvedValue(null),
}))
// The project emails are their own service and their own test; stubbing them
// here keeps this file about the review-request transition it was written for.
jest.mock("../src/services/projectEmailService", () => ({
  sendStatusUpdate: jest.fn().mockResolvedValue(true),
  sendFileRequested: jest.fn().mockResolvedValue(true),
  sendFileReviewed: jest.fn().mockResolvedValue(true),
}))
jest.mock("../src/services/supportService", () => ({ addAdminMessage: jest.fn() }))
jest.mock("../src/services/portalAccessService", () => ({ mintPortalLink: jest.fn() }))
jest.mock("../src/config/storagePaths", () => ({ STORAGE_PATHS: { projectFiles: "/tmp/mu-projects" } }))

const prisma = require("../src/lib/prisma")
const { sendTemplateEmail } = require("../src/services/emailService")
const adminCtrl = require("../src/controllers/adminClientProjectController")
const reviewCtrl = require("../src/controllers/reviewController")
const { createReview } = require("../src/services/reviewService")
const { buildCaseStudyDraft, createCaseStudyDraft, monthsBetween } = require("../src/services/projectCaseStudyService")
const { splitResults } = require("../src/services/portfolioService")

function run(handler, req) {
  return new Promise((resolve, reject) => {
    const res = {}
    res.status = jest.fn(() => res)
    res.json = jest.fn(() => { resolve(res); return res })
    handler(req, res, (err) => reject(err || new Error("next() called")))
  })
}
const flush = () => new Promise((r) => setImmediate(r))

const projectRow = (over = {}) => ({
  id: "p1", userId: "u1", projectName: "Checkout rebuild", projectStatus: "in_progress", closedAt: null,
  description: "Rebuild the checkout for a LATAM store.", startDate: new Date("2026-03-01"), updatedAt: new Date("2026-08-20"),
  user: { id: "u1", fullName: "Maria Lopez", email: "maria@example.com", company: "Tienda MX" },
  serviceOrder: { id: "so1", status: "in_progress", order: { id: "o1", orderNumber: "MU-1" }, service: { id: "s1", slug: "digital-product-engineering", title: "Digital Product Engineering" } },
  milestones: [
    { id: "m2", title: "Build", description: "Ship it", sortOrder: 1 },
    { id: "m1", title: "Discovery", description: "Map the flows", sortOrder: 0 },
  ],
  comments: [{ authorRole: "admin", body: "Kickoff notes" }, { authorRole: "client", body: "Cart abandonment is 70%." }],
  ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  process.env.FRONTEND_URL = "https://mustaphaukizuru.com"
})

describe("PATCH /admin/client-projects/:id → completed", () => {
  test("sends project.review-request once on the transition into completed", async () => {
    prisma.clientProject.findUnique
      .mockResolvedValueOnce({ projectStatus: "review" })          // controller: before
      .mockResolvedValueOnce({ closedAt: null })                    // service: closedAt stamp
    prisma.clientProject.update.mockResolvedValue(projectRow({ projectStatus: "completed", closedAt: new Date() }))

    const res = await run(adminCtrl.updateProject, { params: { id: "p1" }, body: { projectStatus: "completed" }, user: { id: "a1" } })
    await flush()
    expect(res.status).toHaveBeenCalledWith(200)
    expect(sendTemplateEmail).toHaveBeenCalledTimes(1)
    expect(sendTemplateEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "maria@example.com", templateKey: "project.review-request", userId: "u1",
      variables: expect.objectContaining({
        projectName: "Checkout rebuild",
        serviceName: "Digital Product Engineering",
        reviewUrl:   "https://mustaphaukizuru.com/dashboard/projects/p1?review=1",
      }),
    }))
  })
  test("no email when already completed or when moving to another status", async () => {
    prisma.clientProject.findUnique.mockResolvedValueOnce({ projectStatus: "completed" }).mockResolvedValueOnce({ closedAt: new Date() })
    prisma.clientProject.update.mockResolvedValue(projectRow({ projectStatus: "completed" }))
    await run(adminCtrl.updateProject, { params: { id: "p1" }, body: { projectStatus: "completed" }, user: { id: "a1" } })
    await flush()
    expect(sendTemplateEmail).not.toHaveBeenCalled()

    prisma.clientProject.update.mockResolvedValue(projectRow({ projectStatus: "cancelled" }))
    prisma.clientProject.findUnique.mockResolvedValueOnce({ closedAt: null })
    await run(adminCtrl.updateProject, { params: { id: "p1" }, body: { projectStatus: "cancelled" }, user: { id: "a1" } })
    await flush()
    expect(sendTemplateEmail).not.toHaveBeenCalled()
  })
})

describe("reviews with projectId", () => {
  beforeEach(() => {
    prisma.review.findFirst.mockResolvedValue(null)
    prisma.review.count.mockResolvedValue(0)
    prisma.orderItem.findFirst.mockResolvedValue({ id: "oi1" })
    prisma.review.create.mockImplementation(async ({ data }) => ({ id: "r1", ...data, user: { id: "u1", fullName: "Maria" } }))
  })
  test("createReview persists projectId", async () => {
    await createReview({ serviceId: "s1", userId: "u1", rating: 5, reviewText: "Great work", projectId: "p1" })
    expect(prisma.review.create.mock.calls[0][0].data).toMatchObject({ subjectType: "service", serviceId: "s1", projectId: "p1", rating: 5 })
    await createReview({ serviceId: "s1", userId: "u1", rating: 4 })
    expect(prisma.review.create.mock.calls[1][0].data.projectId).toBeNull()
  })
  test("POST /services/:slug/reviews links only an owned project for that service", async () => {
    prisma.service.findFirst.mockResolvedValue({ id: "s1", title: "DPE" })
    prisma.clientProject.findFirst.mockResolvedValue({ id: "p1" })
    const res = await run(reviewCtrl.addServiceReview, { params: { slug: "dpe" }, user: { id: "u1" }, body: { rating: 5, reviewText: "ok", projectId: "p1" } })
    expect(res.status).toHaveBeenCalledWith(201)
    expect(prisma.clientProject.findFirst.mock.calls[0][0].where).toEqual({ id: "p1", userId: "u1", serviceOrder: { serviceId: "s1" } })
    expect(prisma.review.create.mock.calls[0][0].data.projectId).toBe("p1")

    prisma.clientProject.findFirst.mockResolvedValue(null)
    const res2 = await run(reviewCtrl.addServiceReview, { params: { slug: "dpe" }, user: { id: "u1" }, body: { rating: 5, projectId: "someone-elses" } })
    expect(res2.status).toHaveBeenCalledWith(400)
    expect(prisma.review.create).toHaveBeenCalledTimes(1)
  })
})

describe("case-study draft", () => {
  test("buildCaseStudyDraft maps the project into the portfolio payload", () => {
    const p = buildCaseStudyDraft(projectRow({ closedAt: new Date("2026-08-20") }))
    expect(p).toMatchObject({
      title: "Checkout rebuild", role: "Consultant", client: "Tienda MX", category: "Digital Product Engineering",
      status: "draft", isFeatured: false, year: 2026, duration: "6 months",
      shortDescription: "Rebuild the checkout for a LATAM store.",
    })
    expect(p.caseStudy).toEqual({
      serviceSlug: "digital-product-engineering",
      context:  "Rebuild the checkout for a LATAM store.",
      problem:  "Cart abandonment is 70%.",
      approach: [{ title: "Discovery", body: "Map the flows" }, { title: "Build", body: "Ship it" }],
      outcomes: [], stack: [],
    })
  })
  test("falls back to description as problem and 'Consulting' without a service", () => {
    const p = buildCaseStudyDraft(projectRow({ comments: [], serviceOrder: null, user: { fullName: "Maria Lopez" } }))
    expect(p.caseStudy.problem).toBe("Rebuild the checkout for a LATAM store.")
    expect(p.caseStudy.serviceSlug).toBeNull()
    expect(p.category).toBe("Consulting")
    expect(p.client).toBe("Maria Lopez")
    expect(monthsBetween(null, null)).toBeNull()
  })
  test("createCaseStudyDraft creates a draft Portfolio row with a unique slug and results envelope", async () => {
    prisma.clientProject.findUnique.mockResolvedValue(projectRow())
    prisma.portfolio.findUnique.mockResolvedValueOnce({ id: "other" }).mockResolvedValueOnce(null) // slug taken once
    prisma.portfolio.create.mockImplementation(async ({ data }) => ({ id: "pf1", createdAt: new Date(), updatedAt: new Date(), ...data }))

    const out = await createCaseStudyDraft("p1", "a1")
    const data = prisma.portfolio.create.mock.calls[0][0].data
    expect(data).toMatchObject({ title: "Checkout rebuild", slug: "checkout-rebuild-2", status: "draft", createdById: "a1" })
    const { items, caseStudy } = splitResults(data.results)
    expect(items).toEqual([])
    expect(caseStudy).toMatchObject({ context: "Rebuild the checkout for a LATAM store.", problem: "Cart abandonment is 70%.", outcomes: [], stack: [] })
    expect(caseStudy.approach.map((s) => s.title)).toEqual(["Discovery", "Build"])
    expect(out).toEqual({ id: "pf1", slug: "checkout-rebuild-2", status: "draft", editUrl: "https://mustaphaukizuru.com/admin/portfolio/pf1/edit" })
  })
  test("POST /admin/client-projects/:id/case-study-draft → 201 / 404", async () => {
    prisma.clientProject.findUnique.mockResolvedValue(null)
    const res = await run(adminCtrl.createCaseStudy, { params: { id: "nope" }, user: { id: "a1" } })
    expect(res.status).toHaveBeenCalledWith(404)
  })
})
