// ─────────────────────────────────────────────────────────────────────────────
// T5-21 · one review nudge, and the pulse above the form.
//
// Two things are being protected here and they pull in opposite directions.
//
// The nudge must go out ONCE. A completed project that never got a review is
// a standing invitation to email the same person every morning, and the only
// thing stopping that is a stamp written before the send. So the interesting
// cases are all about the stamp: it happens first, it is conditional, and a
// lost race sends nothing.
//
// The pulse must be a number or nothing. It is the one figure on a Review row
// that is never moderated before anyone reads it, so "3.7", "five" and a
// missing field all have to land as null rather than as data.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({
  clientProject: { findMany: jest.fn(), updateMany: jest.fn() },
  review: { findFirst: jest.fn(), count: jest.fn(), create: jest.fn() },
  orderItem: { findFirst: jest.fn() },
  product: { update: jest.fn() },
}))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))
jest.mock("../src/services/emailService", () => ({
  sendTemplateEmail: jest.fn().mockResolvedValue({ ok: true }),
}))

const fs = require("fs")
const path = require("path")

const prisma = require("../src/lib/prisma")
const { sendTemplateEmail } = require("../src/services/emailService")
const { runReviewFollowUpPass, FOLLOW_UP_DAYS, MAX_PER_PASS } = require("../src/jobs/reviewFollowUpJob")

const ROOT = path.join(__dirname, "..")
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8")

const NOW = new Date("2026-09-05T12:00:00.000Z")

const project = (over = {}) => ({
  id: "p1",
  userId: "u1",
  projectName: "Colegio Vista",
  trackingCode: "MU-7K4C-9XQF",
  closedAt: new Date("2026-08-25T12:00:00.000Z"),
  serviceOrder: { service: { title: "Sitio institucional" } },
  user: { email: "director@colegiovista.mx", fullName: "Ana Ruiz", profile: { country: "MX" } },
  ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  prisma.clientProject.findMany.mockResolvedValue([project()])
  prisma.clientProject.updateMany.mockResolvedValue({ count: 1 })
  sendTemplateEmail.mockResolvedValue({ ok: true })
})

describe("who gets asked", () => {
  test("only completed projects that are a week old, unreviewed and never nudged", async () => {
    await runReviewFollowUpPass({ now: NOW })
    const { where, take } = prisma.clientProject.findMany.mock.calls[0][0]

    expect(where.projectStatus).toBe("completed")
    // Not merely "has a closedAt" — a week of it.
    expect(where.closedAt.lte).toEqual(new Date(NOW.getTime() - FOLLOW_UP_DAYS * 86_400_000))
    // They have not already written one. `none` rather than a second query:
    // a client who reviewed on day two must never be asked again.
    expect(where.reviews).toEqual({ none: {} })
    // And they have not already been nudged. This is what makes it once.
    expect(where.reviewRequestedAt).toBeNull()
    // A purged project has no files left to have an opinion about.
    expect(where.purgedAt).toBeNull()
    // A backlog must not become a mailshot.
    expect(take).toBe(MAX_PER_PASS)
  })

  test("a week means a week — six days is not eligible", () => {
    // Guarding the constant rather than the query: FOLLOW_UP_DAYS is the
    // whole product decision here, and a stray edit to 1 would turn a nudge
    // into a next-day pester.
    expect(FOLLOW_UP_DAYS).toBe(7)
  })
})

describe("the stamp, which is the only thing making this once", () => {
  test("it is written BEFORE the email goes out", async () => {
    const order = []
    prisma.clientProject.updateMany.mockImplementation(async () => { order.push("stamp"); return { count: 1 } })
    sendTemplateEmail.mockImplementation(async () => { order.push("send"); return { ok: true } })

    await runReviewFollowUpPass({ now: NOW })
    expect(order).toEqual(["stamp", "send"])
  })

  test("a send that fails still leaves the stamp — silence is the cheaper failure", async () => {
    // The alternative is a send which succeeds and then fails to stamp,
    // which asks the same client again tomorrow and every day after.
    sendTemplateEmail.mockResolvedValue({ ok: false, error: "smtp down" })
    const out = await runReviewFollowUpPass({ now: NOW })

    expect(prisma.clientProject.updateMany).toHaveBeenCalledTimes(1)
    expect(out).toMatchObject({ sent: 0, skipped: 1 })
  })

  test("the stamp is CONDITIONAL, so two workers cannot both send", async () => {
    await runReviewFollowUpPass({ now: NOW })
    expect(prisma.clientProject.updateMany.mock.calls[0][0].where).toEqual({
      id: "p1",
      reviewRequestedAt: null,
    })
  })

  test("losing that race sends nothing at all", async () => {
    prisma.clientProject.updateMany.mockResolvedValue({ count: 0 })
    const out = await runReviewFollowUpPass({ now: NOW })

    expect(sendTemplateEmail).not.toHaveBeenCalled()
    expect(out).toMatchObject({ sent: 0, skipped: 1 })
  })
})

describe("what it sends", () => {
  test("a distinct template — not a resend of the completion email", async () => {
    // A week later the client already ignored those exact words once.
    await runReviewFollowUpPass({ now: NOW })
    expect(sendTemplateEmail.mock.calls[0][0].templateKey).toBe("project.review-follow-up")
  })

  test("the template exists in BOTH languages", () => {
    // A key seeded only in English falls back silently for Spanish readers,
    // and Spanish is the default locale of this site.
    const { TEMPLATES, TEMPLATES_ES } = require("../prisma/seed-email-templates")
    for (const list of [TEMPLATES, TEMPLATES_ES]) {
      expect(list.map((t) => t.key)).toContain("project.review-follow-up")
    }
  })

  test("every placeholder in the template is supplied by the job", () => {
    // An unresolved {{placeholder}} does not throw — it renders literally.
    const { TEMPLATES } = require("../prisma/seed-email-templates")
    const t = TEMPLATES.find((x) => x.key === "project.review-follow-up")
    const used = new Set()
    for (const m of `${t.subject}\n${t.html}\n${t.text}`.matchAll(/\{\{(\w+)\}\}/g)) used.add(m[1])
    // `year` is injected by the send layer for every template.
    used.delete("year")

    const job = read("src", "jobs", "reviewFollowUpJob.js")
    for (const name of used) expect(job.includes(`${name}:`)).toBe(true)
  })

  test("a project with no address on file is skipped, not crashed on", async () => {
    prisma.clientProject.findMany.mockResolvedValue([project({ user: { email: null } })])
    const out = await runReviewFollowUpPass({ now: NOW })

    expect(prisma.clientProject.updateMany).not.toHaveBeenCalled()
    expect(out).toMatchObject({ sent: 0, skipped: 1 })
  })

  test("one project blowing up does not stop the rest of the pass", async () => {
    prisma.clientProject.findMany.mockResolvedValue([project(), project({ id: "p2" })])
    sendTemplateEmail
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ ok: true })

    const out = await runReviewFollowUpPass({ now: NOW })
    expect(out).toMatchObject({ sent: 1, skipped: 1, eligible: 2 })
  })
})

describe("it is actually wired up", () => {
  test("the scheduler registers it", () => {
    // A job nobody calls is a file, not a feature.
    const scheduler = read("src", "jobs", "scheduler.js")
    expect(scheduler).toContain("runReviewFollowUpPass")
    expect(scheduler).toMatch(/guarded\("reviewFollowUp", runReviewFollowUpPass\)/)
  })

  test("the heartbeat knows about it, so /health/jobs can go red", () => {
    // fileRequestReminders was missing from this registry for three waves and
    // /health/jobs reported healthy the whole time. Not again.
    const heartbeat = read("src", "jobs", "heartbeat.js")
    expect(heartbeat).toMatch(/reviewFollowUp:\s*DAY/)
  })
})

describe("the pulse is a number or it is nothing", () => {
  const { createReview } = require("../src/services/reviewService")

  const submit = async (pulse) => {
    prisma.review.findFirst.mockResolvedValue(null)
    prisma.orderItem.findFirst.mockResolvedValue({ id: "oi1" })
    prisma.review.count.mockResolvedValue(0)
    prisma.review.create.mockImplementation(async (args) => ({ id: "r1", ...args.data }))
    await createReview({ serviceId: "s1", userId: "u1", rating: 5, reviewText: "great", pulse })
    return prisma.review.create.mock.calls.at(-1)[0].data.pulse
  }

  test("1 through 5 are stored", async () => {
    for (const n of [1, 2, 3, 4, 5]) expect(await submit(n)).toBe(n)
  })

  test("a string of a valid number is coerced, because that is what JSON bodies carry", async () => {
    expect(await submit("4")).toBe(4)
  })

  test("out of range, fractional, junk and missing all land as null", async () => {
    for (const bad of [0, 6, -1, 3.7, "five", "", null, undefined, {}, []]) {
      expect(await submit(bad)).toBeNull()
    }
  })

  test("it is separate from `rating`, and only `rating` is the public one", async () => {
    prisma.review.findFirst.mockResolvedValue(null)
    prisma.orderItem.findFirst.mockResolvedValue({ id: "oi1" })
    prisma.review.count.mockResolvedValue(0)
    prisma.review.create.mockImplementation(async (args) => ({ id: "r1", ...args.data }))
    await createReview({ serviceId: "s1", userId: "u1", rating: 5, pulse: 2 })

    const data = prisma.review.create.mock.calls.at(-1)[0].data
    expect(data.rating).toBe(5)
    expect(data.pulse).toBe(2)
  })
})
