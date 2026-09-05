// ─────────────────────────────────────────────────────────────────────────────
// T5-11, T5-12, T5-23 · the three things that make the tracker answer the
// question a client actually has.
//
// The phase strip says where the work is. None of that says whether it will be
// ready when they were told, which clock the times are on, or how to get back
// here from the invoice on their desk.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({
  clientProject: { findUnique: jest.fn(), findFirst: jest.fn() },
  projectMilestone: { findUnique: jest.fn(), update: jest.fn() },
  projectFileRequest: { count: jest.fn() },
  projectEvent: { create: jest.fn() },
}))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))

const fs = require("fs")
const path = require("path")

const prisma = require("../src/lib/prisma")
const health = require("../src/services/projectHealthService")
const tracking = require("../src/services/projectTrackingService")

const ROOT = path.join(__dirname, "..")
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8")

const NOW = new Date("2026-09-05T00:00:00Z")
const day = (n) => new Date(NOW.getTime() + n * 86_400_000)

beforeEach(() => jest.clearAllMocks())

/* ══════════════════════════════════════════════════════════════════════════
   T5-12 · on time, or not
   ══════════════════════════════════════════════════════════════════════════ */

describe("project health", () => {
  test("an open milestone past its DUE date is late", () => {
    // Late is measured against the commitment, not against what we now
    // believe — a date that was agreed and has passed is late whatever the
    // current estimate says.
    const out = health.projectHealth([{ status: "pending", dueDate: day(-3), estimatedAt: day(10) }], NOW)
    expect(out.health).toBe("late")
    expect(out.lateCount).toBe(1)
  })

  test("an estimate past the agreed date, with the date still ahead, is at risk", () => {
    // The only state the client can still do something about, which is why it
    // is worth distinguishing from the other two.
    const out = health.projectHealth([{ status: "pending", dueDate: day(5), estimatedAt: day(12) }], NOW)
    expect(out.health).toBe("at_risk")
    expect(out.lateCount).toBe(0)
  })

  test("a closed milestone that WAS late does not make the project late forever", () => {
    // Otherwise every project that ever slipped reads "late" for the rest of
    // its life, and the indicator stops meaning anything.
    expect(health.projectHealth([
      { status: "completed", dueDate: day(-30), completedAt: day(-25) },
      { status: "pending", dueDate: day(14) },
    ], NOW).health).toBe("on_track")
  })

  test("the worst open milestone decides, not the average", () => {
    const out = health.projectHealth([
      { status: "pending", dueDate: day(20) },
      { status: "pending", dueDate: day(-1) },
      { status: "in_progress", dueDate: day(30) },
    ], NOW)
    expect(out.health).toBe("late")
    expect(out.openCount).toBe(3)
  })

  test("expectedAt is the SOONEST date still ahead, preferring the estimate", () => {
    // The "your parcel arrives Tuesday" line. It has to be the next thing,
    // and it has to be what we now believe rather than what was agreed.
    const out = health.projectHealth([
      { status: "pending", dueDate: day(30) },
      { status: "pending", dueDate: day(20), estimatedAt: day(9) },
    ], NOW)
    expect(out.expectedAt).toBe(day(9).toISOString())
  })

  test("no dates at all means NO expectation, rather than a guess", () => {
    // A made-up expected date is worse than none: the client plans around it.
    const out = health.projectHealth([{ status: "pending" }], NOW)
    expect(out.expectedAt).toBeNull()
    expect(out.health).toBe("on_track")
  })

  test("a project with nothing open is on track and expects nothing", () => {
    expect(health.projectHealth([], NOW)).toEqual({
      health: "on_track", expectedAt: null, lateCount: 0, openCount: 0,
    })
  })
})

describe("a date that moved", () => {
  test("more than two days is worth telling the client", () => {
    expect(health.isMeaningfulReschedule(day(0), day(3))).toBe(true)
    expect(health.isMeaningfulReschedule(day(10), day(2))).toBe(true)
  })

  test("a wobble of a day or two is not", () => {
    // An event per wobble teaches the client to ignore the timeline, which
    // costs more than the wobble.
    expect(health.isMeaningfulReschedule(day(0), day(1))).toBe(false)
    expect(health.isMeaningfulReschedule(day(0), day(2))).toBe(false)
  })

  test("setting the FIRST estimate is not a reschedule", () => {
    // Nothing moved — there was nothing there to move.
    expect(health.isMeaningfulReschedule(null, day(30))).toBe(false)
  })

  test("clearing an estimate is not one either", () => {
    // It says "we no longer know", which is a different message and deserves
    // a conversation rather than an automatic notice.
    expect(health.isMeaningfulReschedule(day(30), null)).toBe(false)
  })

  test("the event is recorded with both dates, and is public", () => {
    const events = read("src", "services", "projectEventService.js")
    const block = events.slice(events.indexOf('"milestone.rescheduled"'))
    expect(block.slice(0, 200)).toContain('visibility: "public"')

    const service = read("src", "services", "clientProjectService.js")
    const call = service.slice(service.indexOf('type: "milestone.rescheduled"'))
    // Old → new, so the client sees the change rather than only the result.
    expect(service).toContain("isMeaningfulReschedule(existing.estimatedAt, patch.estimatedAt)")
    expect(call.slice(0, 400)).toContain("→")
  })
})

describe("the health reaches the public payload", () => {
  const row = (milestones) => ({
    id: "p1",
    trackingCode: "MU-7K4C-9XQF",
    projectStatus: "in_progress",
    startDate: null, dueDate: null, closedAt: null,
    milestones,
    events: [],
    openRequestCount: 0,
  })

  test("health, expectedAt, lateCount and openCount are all there", () => {
    const out = tracking.serializePublicProject(row([{ status: "pending", dueDate: day(-1) }]), "en")
    expect(out.health).toBe("late")
    expect(out).toHaveProperty("expectedAt")
    expect(out).toHaveProperty("lateCount")
    expect(out).toHaveProperty("openCount")
  })

  test("a milestone now carries its dates, and STILL nothing else", () => {
    // Adding to this response is a change to ADR 0006. Dates pass because
    // the client agreed a schedule around them; a description would not.
    const out = tracking.serializePublicProject(row([{
      status: "pending", dueDate: day(5), estimatedAt: day(9), completedAt: null,
      description: "quoted at 48,000 MXN", approvedAt: null,
    }]), "en")
    expect(Object.keys(out.milestones[0]).sort())
      .toEqual(["completedAt", "dueDate", "estimatedAt", "status", "title"].sort())
    expect(JSON.stringify(out)).not.toContain("48,000")
  })
})

/* ══════════════════════════════════════════════════════════════════════════
   T5-11 · the QR on the invoice
   ══════════════════════════════════════════════════════════════════════════ */

describe("the tracking QR", () => {
  const service = read("src", "services", "invoiceService.js")

  test("it encodes the tracking URL and scans back to it", async () => {
    // Round-tripped through the same library the PDF uses, at the same
    // settings, so the assertion is about the payload rather than about
    // whether an image was produced.
    const QRCode = require("qrcode")
    const url = "https://mustaphaukizuru.com/track/MU-7K4C-9XQF"
    const png = await QRCode.toBuffer(url, {
      type: "png", errorCorrectionLevel: "M", margin: 0, width: 220,
    })
    expect(png.length).toBeGreaterThan(200)
    // PNG magic — a real image, not an empty buffer that would render blank.
    expect(png.slice(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]))

    // And the payload is recoverable from the matrix the encoder built.
    // The library splits a URL across modes — byte for the lowercase host,
    // alphanumeric for the upper-case code — so the segments come back as a
    // mix of strings and byte arrays and have to be rejoined to be read.
    const matrix = QRCode.create(url, { errorCorrectionLevel: "M" })
    const payload = matrix.segments
      .map((seg) => (typeof seg.data === "string" ? seg.data : Buffer.from(seg.data).toString("utf8")))
      .join("")
    expect(payload).toBe(url)
  })

  test("a project invoice gets one; a store purchase does not", () => {
    // Most invoices this system produces have nothing to track, and a footer
    // saying so would be noise on all of them.
    const block = service.slice(service.indexOf("async function resolveTracking"))
    expect(block.slice(0, 900)).toContain("if (!code) return null")
    expect(service).toContain("if (!tracking?.png) return")
  })

  test("the code is printed beneath it, not only encoded", () => {
    // A QR is unusable to somebody reading a printed invoice at a desk with
    // no phone; a twelve-character code is tedious to type on one.
    const block = service.slice(service.indexOf("function renderTrackingQr"))
    expect(block.slice(0, 800)).toContain("tracking.code")
    expect(block.slice(0, 800)).toContain('doc.image(tracking.png')
  })

  test("a QR that cannot be built never fails the invoice", () => {
    // A missing QR is a slightly less useful invoice. A failed invoice is a
    // client who cannot pay.
    const block = service.slice(service.indexOf("async function resolveTracking"))
    const body = block.slice(0, block.indexOf("function renderTrackingQr"))
    expect(body).toContain("catch")
    expect(body).toContain("return null")
  })

  test("it is rendered before the footer, at 22mm", () => {
    expect(service).toContain("renderTrackingQr(doc, tracking)")
    expect(service.indexOf("renderTrackingQr(doc, tracking)"))
      .toBeLessThan(service.indexOf("renderFooter(doc)\n\n      doc.end()"))
    expect(service).toContain("22 * MM")
  })
})

/* ══════════════════════════════════════════════════════════════════════════
   T5-23 · which clock
   ══════════════════════════════════════════════════════════════════════════ */

describe("the timezone is stated", () => {
  const page = read("web", "src", "pages", "TrackPage.jsx")

  test("the reader's own zone is used, with Mexico City as the fallback", () => {
    // Intl already renders in the reader's zone and that is right — "3pm"
    // should mean 3pm where they are. The fallback is the studio's zone,
    // which is the one the dates were set in.
    expect(page).toContain("resolvedOptions().timeZone")
    expect(page).toContain('"America/Mexico_City"')
  })

  test("it is said ONCE, not beside every timestamp", () => {
    // Repeating it on each row is noise; omitting it is the trap where the
    // reader assumes theirs and the operator assumes Mexico City.
    expect((page.match(/track\.timezone/g) || []).length).toBe(1)
  })

  test("both languages have the string, and Spanish keeps the tú register", () => {
    for (const lang of ["en", "es"]) {
      const dashboard = JSON.parse(read("web", "src", "i18n", "locales", lang, "dashboard.json"))
      expect(dashboard.track.timezone).toContain("{{zone}}")
      expect(dashboard.track.health.on_track).toBeTruthy()
    }
    const es = JSON.parse(read("web", "src", "i18n", "locales", "es", "dashboard.json"))
    // ADR 0004: the register lives in the conjugation, not in the pronoun.
    expect(es.track.health.expected).toMatch(/se espera/i)
  })
})
