// ─────────────────────────────────────────────────────────────────────────────
// T5-3 · document requests, and the CSRF hole the portal's first write opens.
//
// Two things are being guarded here and they are not the same size:
//
//   1. the request lifecycle — asking, uploading, accepting, rejecting. Worth
//      testing because the rejection loop is easy to get wrong in a way that
//      loses the client's earlier file or forgets what was asked for.
//
//   2. CSRF on `mu_portal`. The portal cookie is httpOnly and sameSite=lax,
//      which is to say ambient: the browser attaches it to a cross-site form
//      POST. While every portal route was a GET that did not matter, and the
//      comment in portalCookie.js said as much. This item adds the portal's
//      first write, so the guard has to know about the cookie BEFORE that
//      route exists, not after.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({
  projectFileRequest: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  clientProject:      { findUnique: jest.fn() },
  projectEvent:       { create: jest.fn() },
}))

jest.mock("../src/utils/logger", () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}))

jest.mock("../src/services/notificationService", () => ({ notify: jest.fn() }))
// T5-6 · the job now emails as well as notifying. Its own service and its
// own test; here it only has to be reached with the right arguments.
jest.mock("../src/services/projectEmailService", () => ({
  sendFileReminder: jest.fn().mockResolvedValue(true),
  sendFileReceived: jest.fn().mockResolvedValue(true),
}))

const fs = require("fs")
const path = require("path")

const prisma = require("../src/lib/prisma")
const { notify } = require("../src/services/notificationService")
const fileRequests = require("../src/services/projectFileRequestService")
const { runFileRequestReminderPass } = require("../src/jobs/fileRequestReminderJob")
const { sendFileReminder } = require("../src/services/projectEmailService")

const ROOT = path.join(__dirname, "..")

beforeEach(() => {
  jest.clearAllMocks()
  prisma.projectEvent.create.mockResolvedValue({ id: "ev1" })
  notify.mockResolvedValue(null)
})

describe("the extension allowlist", () => {
  test("accepts what a person would type", () => {
    expect(fileRequests.parseAcceptExt("pdf, .DOCX , jpg")).toEqual([".pdf", ".docx", ".jpg"])
  })

  test("an empty list means no EXTRA restriction, not none allowed", () => {
    // The global ALLOWED_EXT in uploadProjectFile.js has already run by the
    // time anything reaches here. Treating empty as "deny all" would reject
    // every upload against a request whose admin left the field blank.
    expect(fileRequests.extensionAllowed("thing.pdf", null)).toBe(true)
    expect(fileRequests.extensionAllowed("thing.pdf", "")).toBe(true)
  })

  test("matches case-insensitively and only on the real extension", () => {
    expect(fileRequests.extensionAllowed("Scan.PDF", ".pdf")).toBe(true)
    expect(fileRequests.extensionAllowed("notes.txt", ".pdf,.docx")).toBe(false)
    // A file NAMED like an extension is not one.
    expect(fileRequests.extensionAllowed("pdf", ".pdf")).toBe(false)
    expect(fileRequests.extensionAllowed("my.pdf.exe", ".pdf")).toBe(false)
  })
})

describe("creating a request", () => {
  beforeEach(() => {
    prisma.clientProject.findUnique.mockResolvedValue({ id: "p1", userId: "u1", projectName: "Audit" })
    prisma.projectFileRequest.create.mockImplementation(async ({ data }) => ({ id: "fr1", ...data }))
  })

  test("needs a title, because the client has to know what is wanted", async () => {
    await expect(fileRequests.createRequest("p1", { title: "   " }))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR" })
    expect(prisma.projectFileRequest.create).not.toHaveBeenCalled()
  })

  test("404s on an unknown project rather than creating an orphan", async () => {
    prisma.clientProject.findUnique.mockResolvedValue(null)
    await expect(fileRequests.createRequest("nope", { title: "RFC" }))
      .rejects.toMatchObject({ statusCode: 404 })
  })

  test("normalises the allowlist on the way in", async () => {
    // Stored normalised so the client UI and the upload check read the same
    // thing, whatever the admin typed.
    await fileRequests.createRequest("p1", { title: "RFC", acceptExt: "PDF, jpg" })
    expect(prisma.projectFileRequest.create.mock.calls[0][0].data.acceptExt).toBe(".pdf,.jpg")
  })

  test("records file.requested, which is client-visible and never public", async () => {
    await fileRequests.createRequest("p1", { title: "RFC" })
    const { data } = prisma.projectEvent.create.mock.calls[0][0]
    expect(data.type).toBe("file.requested")
    expect(data.visibility).toBe("client")
  })
})

describe("reviewing a submission", () => {
  const submitted = { id: "fr1", projectId: "p1", status: "submitted", title: "RFC", titleEs: null }

  beforeEach(() => {
    prisma.projectFileRequest.findUnique.mockResolvedValue(submitted)
    prisma.projectFileRequest.update.mockImplementation(async ({ data }) => ({ ...submitted, ...data }))
  })

  test("accepting closes it", async () => {
    const out = await fileRequests.reviewRequest("fr1", { action: "accept" })
    expect(out.status).toBe("accepted")
    expect(out.closedAt).toBeTruthy()
    expect(prisma.projectEvent.create.mock.calls[0][0].data.type).toBe("file.accepted")
  })

  test("rejecting REOPENS it, so the client can try again", async () => {
    // The request is the only place that remembers what was asked for.
    // Closing it on rejection would leave the client with a note and no way
    // to answer it.
    const out = await fileRequests.reviewRequest("fr1", { action: "reject", reviewNote: "Wrong year" })
    expect(out.status).toBe("rejected")
    expect(out.closedAt).toBeFalsy()
    expect(out.reviewNote).toBe("Wrong year")
    expect(fileRequests.OPEN_STATUSES).toContain("rejected")
  })

  test("a rejection must say why", async () => {
    // Otherwise the client guesses, and sends the same file again.
    await expect(fileRequests.reviewRequest("fr1", { action: "reject" }))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR" })
  })

  test("only a submitted request can be accepted or rejected", async () => {
    prisma.projectFileRequest.findUnique.mockResolvedValue({ ...submitted, status: "requested" })
    await expect(fileRequests.reviewRequest("fr1", { action: "accept" }))
      .rejects.toMatchObject({ statusCode: 409 })
  })

  test("cancelling works from any state — 'never mind' is always allowed", async () => {
    prisma.projectFileRequest.findUnique.mockResolvedValue({ ...submitted, status: "requested" })
    const out = await fileRequests.reviewRequest("fr1", { action: "cancel" })
    expect(out.status).toBe("cancelled")
  })

  test("an unknown action is refused", async () => {
    await expect(fileRequests.reviewRequest("fr1", { action: "approve" }))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR" })
  })
})

describe("uploading against a request", () => {
  test("a request from another project is not found — same message either way", async () => {
    // The id arrives from the browser. A different message for "exists but
    // is not yours" would confirm the id is real.
    prisma.projectFileRequest.findUnique.mockResolvedValue({
      id: "fr1", projectId: "OTHER", status: "requested", acceptExt: null,
    })
    await expect(fileRequests.assertUploadable("fr1", "p1", ["a.pdf"]))
      .rejects.toMatchObject({ statusCode: 404, message: "Document request not found" })

    prisma.projectFileRequest.findUnique.mockResolvedValue(null)
    await expect(fileRequests.assertUploadable("fr1", "p1", ["a.pdf"]))
      .rejects.toMatchObject({ statusCode: 404, message: "Document request not found" })
  })

  test("a closed request refuses uploads", async () => {
    prisma.projectFileRequest.findUnique.mockResolvedValue({
      id: "fr1", projectId: "p1", status: "accepted", acceptExt: null,
    })
    await expect(fileRequests.assertUploadable("fr1", "p1", ["a.pdf"]))
      .rejects.toMatchObject({ statusCode: 409 })
  })

  test("a rejected request accepts a replacement", async () => {
    prisma.projectFileRequest.findUnique.mockResolvedValue({
      id: "fr1", projectId: "p1", status: "rejected", acceptExt: null,
    })
    await expect(fileRequests.assertUploadable("fr1", "p1", ["a.pdf"])).resolves.toBeTruthy()
  })

  test("the request's own extension list is enforced", async () => {
    prisma.projectFileRequest.findUnique.mockResolvedValue({
      id: "fr1", projectId: "p1", status: "requested", acceptExt: ".pdf",
    })
    await expect(fileRequests.assertUploadable("fr1", "p1", ["scan.pdf", "notes.txt"]))
      .rejects.toMatchObject({ code: "INVALID_FILE_TYPE" })
  })

  test("submitting clears the old rejection note", async () => {
    // Leaving it would show the client an objection to a file they have
    // already replaced.
    prisma.projectFileRequest.update.mockImplementation(async ({ data }) => ({ id: "fr1", ...data }))
    await fileRequests.markSubmitted({ id: "fr1", projectId: "p1", title: "RFC" }, { id: "f9" })
    const { data } = prisma.projectFileRequest.update.mock.calls[0][0]
    expect(data).toMatchObject({ status: "submitted", fulfilledFileId: "f9", reviewNote: null })
  })
})

describe("the reminder job", () => {
  const due = (days) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    return d
  }
  const row = (over = {}) => ({
    id: "fr1", projectId: "p1", title: "RFC", titleEs: null, dueAt: due(1), remindedAt: null,
    instructions: null, instructionsEs: null,
    project: { id: "p1", userId: "u1", projectName: "Audit", closedAt: null, trackingCode: "MU-7K4C-9XQF", assignedAdminId: null },
    ...over,
  })

  test("claims before it sends, so two processes cannot double-nag", async () => {
    prisma.projectFileRequest.findMany.mockResolvedValue([row()])
    prisma.projectFileRequest.updateMany.mockResolvedValue({ count: 1 })
    const out = await runFileRequestReminderPass()
    expect(prisma.projectFileRequest.updateMany).toHaveBeenCalled()
    expect(out.reminded).toBe(1)
    expect(notify).toHaveBeenCalledTimes(1)
  })

  test("a lost claim sends nothing", async () => {
    // The other process got there first.
    prisma.projectFileRequest.findMany.mockResolvedValue([row()])
    prisma.projectFileRequest.updateMany.mockResolvedValue({ count: 0 })
    const out = await runFileRequestReminderPass()
    expect(out.reminded).toBe(0)
    expect(notify).not.toHaveBeenCalled()
  })

  test("never chases a closed project", async () => {
    prisma.projectFileRequest.findMany.mockResolvedValue([
      row({ project: { id: "p1", userId: "u1", projectName: "Audit", closedAt: new Date() } }),
    ])
    const out = await runFileRequestReminderPass()
    expect(out.reminded).toBe(0)
    expect(prisma.projectFileRequest.updateMany).not.toHaveBeenCalled()
  })

  test("only looks at requests that are still open and actually due", async () => {
    prisma.projectFileRequest.findMany.mockResolvedValue([])
    await runFileRequestReminderPass()
    const { where } = prisma.projectFileRequest.findMany.mock.calls[0][0]
    expect(where.status).toBe("requested")
    // A request with no due date is not overdue: silence is right for
    // "whenever you can".
    expect(where.dueAt.not).toBeNull()
    expect(where.OR).toEqual([{ remindedAt: null }, { remindedAt: { lte: expect.any(Date) } }])
  })

  test("it emails as well as notifying, and says which one is overdue", async () => {
    // The in-app badge alone is a notification nobody sees until they next
    // sign in, which for a client chasing paperwork is exactly never.
    prisma.projectFileRequest.findMany.mockResolvedValue([row({ dueAt: due(-3) })])
    prisma.projectFileRequest.updateMany.mockResolvedValue({ count: 1 })
    await runFileRequestReminderPass()
    expect(sendFileReminder).toHaveBeenCalledTimes(1)
    const arg = sendFileReminder.mock.calls[0][0]
    expect(arg.overdue).toBe(true)
    // The project has to carry the tracking code or the send is refused —
    // which is why the job's select fetches it.
    expect(arg.project.trackingCode).toBe("MU-7K4C-9XQF")
  })

  test("a lost claim emails nobody either", async () => {
    prisma.projectFileRequest.findMany.mockResolvedValue([row()])
    prisma.projectFileRequest.updateMany.mockResolvedValue({ count: 0 })
    await runFileRequestReminderPass()
    expect(sendFileReminder).not.toHaveBeenCalled()
  })

  test("one bad row does not abort the sweep", async () => {
    prisma.projectFileRequest.findMany.mockResolvedValue([row({ id: "bad" }), row({ id: "good" })])
    prisma.projectFileRequest.updateMany.mockResolvedValue({ count: 1 })
    notify.mockRejectedValueOnce(new Error("smtp down"))
    const out = await runFileRequestReminderPass()
    expect(out.reminded).toBe(1)
  })
})

/* ══════════════════════════════════════════════════════════════════════════
   CSRF · the portal's first write
   ══════════════════════════════════════════════════════════════════════════ */

describe("the portal cookie is CSRF-protected", () => {
  const csrfSrc = fs.readFileSync(path.join(ROOT, "src", "middleware", "csrf.js"), "utf8")
  const portalCookieSrc = fs.readFileSync(path.join(ROOT, "src", "utils", "portalCookie.js"), "utf8")

  test("the guard engages on mu_portal, not only mu_session", () => {
    // `mu_portal` is httpOnly and sameSite=lax — every bit as ambient as the
    // session cookie, and therefore just as attachable to a forged POST.
    expect(csrfSrc).toContain("PORTAL_COOKIE")
    expect(csrfSrc).toMatch(/if \(!hasSession && !hasPortal\) return next\(\)/)
  })

  test("verifying a PIN sets the readable CSRF pair alongside the credential", () => {
    expect(portalCookieSrc).toContain("CSRF_COOKIE")
    expect(portalCookieSrc).toContain("generateCsrfToken()")
    // Readable, because web/src/lib/api.js mirrors it into X-CSRF-Token.
    expect(portalCookieSrc).toMatch(/httpOnly: false/)
  })

  test("clearing the portal cookie clears its pair too", () => {
    const clear = portalCookieSrc.slice(portalCookieSrc.indexOf("function clearPortalCookie"))
    expect(clear).toContain("PORTAL_COOKIE")
    expect(clear).toContain("CSRF_COOKIE")
  })

  test("the stale 'no CSRF pair' note is gone", () => {
    // It was true while every portal route was a GET. Leaving it would tell
    // the next reader that this cookie is safe to use for a write.
    expect(portalCookieSrc).not.toContain("No CSRF pair")
  })

  test("safe methods and credential-free requests still pass straight through", () => {
    expect(csrfSrc).toContain("if (SAFE_METHODS.has(req.method)) return next()")
    expect(csrfSrc).toContain("No ambient credential")
  })
})

describe("the admin endpoints are behind the admin guards", () => {
  const routes = fs.readFileSync(path.join(ROOT, "src", "routes", "adminClientProjectRoutes.js"), "utf8")

  test("the router applies protect and adminOnly to everything", () => {
    expect(routes).toContain("router.use(protect, adminOnly)")
    const guardLine = routes.split("\n").findIndex((l) => l.includes("router.use(protect, adminOnly)"))
    const firstRoute = routes.split("\n").findIndex((l) => /^router\.(get|post|patch|delete)/.test(l))
    expect(guardLine).toBeLessThan(firstRoute)
  })

  test("the three file-request routes exist", () => {
    expect(routes).toMatch(/router\.get\s*\("\/:id\/file-requests"/)
    expect(routes).toMatch(/router\.post\s*\("\/:id\/file-requests"/)
    expect(routes).toMatch(/router\.patch\s*\("\/:id\/file-requests\/:reqId"/)
  })
})

describe("the portal's first write", () => {
  const routes = fs.readFileSync(path.join(ROOT, "src", "routes", "portalRoutes.js"), "utf8")

  test("exists and is behind portalAuth", () => {
    expect(routes).toContain('"/me/file-requests/:reqId/files"')
    const block = routes.slice(routes.indexOf('"/me/file-requests/:reqId/files"'))
    expect(block).toContain("portalAuth")
  })

  test("sets req.params.id BEFORE multer, or the bytes land in _orphan", () => {
    // multer's disk destination is shared with the admin and member upload
    // routes and reads req.params.id. This route is keyed by a request id,
    // so without the shim every portal upload lands in a shared "_orphan"
    // directory and resolveSafePath never finds it again.
    const block = routes.slice(routes.indexOf('"/me/file-requests/:reqId/files"'))
    const idIdx = block.indexOf("projectIdForUpload")
    const multerIdx = block.indexOf("uploadProjectFile.many")
    expect(idIdx).toBeGreaterThan(-1)
    expect(multerIdx).toBeGreaterThan(-1)
    expect(idIdx).toBeLessThan(multerIdx)
    expect(routes).toContain("req.params.id = req.portal?.projectId")
  })

  test("is rate limited like every other upload path", () => {
    const block = routes.slice(routes.indexOf('"/me/file-requests/:reqId/files"'))
    expect(block).toContain("uploadRateLimiter")
  })

  test("takes its identity from the verified token, never from the body", () => {
    // A portal visitor must not be able to name a different user or project.
    const controller = fs.readFileSync(path.join(ROOT, "src", "controllers", "portalController.js"), "utf8")
    const block = controller.slice(controller.indexOf("const uploadRequestFiles"))
    expect(block).toContain("userId: req.portal.userId")
    expect(block).toContain("projectId: req.portal.projectId")
    expect(block).not.toMatch(/req\.body\.(userId|projectId)/)
  })

  test("unlinks the bytes when the write is refused", () => {
    const controller = fs.readFileSync(path.join(ROOT, "src", "controllers", "portalController.js"), "utf8")
    const block = controller.slice(controller.indexOf("const uploadRequestFiles"))
    expect(block).toContain("fsp.unlink")
  })
})
