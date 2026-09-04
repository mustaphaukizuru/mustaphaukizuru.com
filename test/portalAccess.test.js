/**
 * Tier 4 · magic-link + PIN portal (no login).
 *
 *   - mintPortalLink: 32-byte hex token, expiry = closedAt + grace (closed)
 *     or +90 d (open), URL under FRONTEND_URL/portal/<token>.
 *   - requestPin: AuthOtp row (purpose "portal", 6 digits, +10 min) for the
 *     project owner, `portal.pin` email, masked address in the response.
 *   - verifyPin: latest unused OTP, constant-time compare, marked used, JWT
 *     { scope: "portal", projectId, userId } for 2 h.
 *   - portalAuth: accepts only that scope from the mu_portal cookie.
 *   - loadPortalProject: member shape minus writes; NDA gate applies.
 *   - rate limiter: pin requests are capped at 5 / 15 min per IP.
 */
process.env.JWT_SECRET = "test-secret"

jest.mock("../src/lib/prisma", () => ({
  clientProject:    { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  authOtp:          { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  projectAgreement: { findFirst: jest.fn() },
  activityLog:      { create: jest.fn().mockResolvedValue({}) },
}))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))
jest.mock("../src/services/emailService", () => ({ sendTemplateEmail: jest.fn().mockResolvedValue({ ok: true }) }))
jest.mock("../src/services/notificationService", () => ({
  notifyAdminsProjectActivity: jest.fn(), notifyProjectComment: jest.fn(), notifyMilestoneAwaitingClient: jest.fn(),
}))

const jwt = require("jsonwebtoken")
const prisma = require("../src/lib/prisma")
const { sendTemplateEmail } = require("../src/services/emailService")
const svc = require("../src/services/portalAccessService")
const { portalAuth } = require("../src/middleware/portalAuth")
const { PORTAL_COOKIE, PORTAL_MAX_AGE, setPortalCookie } = require("../src/utils/portalCookie")
const { portalPinRateLimiter } = require("../src/middleware/rateLimiter")

const DAY = 24 * 60 * 60 * 1000
const TOKEN = "a".repeat(64)
const project = (over = {}) => ({
  id: "p1", userId: "u1", projectName: "Site rebuild", projectStatus: "in_progress", closedAt: null, updatedAt: new Date(),
  portalTokenExpiresAt: new Date(Date.now() + 10 * DAY), user: { id: "u1", email: "maria@example.com", fullName: "Maria" }, ...over,
})

function mockRes() {
  const res = { cookies: {} }
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  res.cookie = jest.fn((name, value, opts) => { res.cookies[name] = { value, opts } })
  return res
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.FRONTEND_URL = "https://mustaphaukizuru.com/"
  delete process.env.PROJECT_ACCESS_GRACE_DAYS
  prisma.clientProject.update.mockResolvedValue({})
  prisma.authOtp.create.mockImplementation(async ({ data }) => ({ id: "otp1", ...data }))
  prisma.authOtp.update.mockResolvedValue({})
})

describe("mintPortalLink", () => {
  test("open project → 64-hex token, +90 days, FRONTEND_URL/portal/<token>", async () => {
    prisma.clientProject.findUnique.mockResolvedValue(project())
    const out = await svc.mintPortalLink("p1")
    expect(out.token).toMatch(/^[a-f0-9]{64}$/)
    expect(out.url).toBe(`https://mustaphaukizuru.com/portal/${out.token}`)
    const days = (out.expiresAt.getTime() - Date.now()) / DAY
    expect(days).toBeGreaterThan(89.9)
    expect(days).toBeLessThanOrEqual(90)
    expect(prisma.clientProject.update.mock.calls[0][0].data).toEqual({ portalToken: out.token, portalTokenExpiresAt: out.expiresAt })
  })
  test("closed project → expires with the grace window; expired project → 410", async () => {
    const closedAt = new Date(Date.now() - 5 * DAY)
    prisma.clientProject.findUnique.mockResolvedValue(project({ projectStatus: "completed", closedAt }))
    const out = await svc.mintPortalLink("p1")
    expect(out.expiresAt.getTime()).toBe(closedAt.getTime() + 30 * DAY)
    prisma.clientProject.findUnique.mockResolvedValue(project({ projectStatus: "completed", closedAt: new Date(Date.now() - 40 * DAY) }))
    await expect(svc.mintPortalLink("p1")).rejects.toMatchObject({ code: "PROJECT_EXPIRED", statusCode: 410 })
    prisma.clientProject.findUnique.mockResolvedValue(null)
    await expect(svc.mintPortalLink("nope")).rejects.toMatchObject({ code: "NOT_FOUND" })
  })
})

describe("requestPin", () => {
  test("creates a 6-digit portal OTP for the owner and emails portal.pin", async () => {
    prisma.clientProject.findUnique.mockResolvedValue(project())
    const out = await svc.requestPin(TOKEN, { locale: "es" })
    expect(prisma.clientProject.findUnique.mock.calls[0][0].where).toEqual({ portalToken: TOKEN })
    const otp = prisma.authOtp.create.mock.calls[0][0].data
    expect(otp).toMatchObject({ userId: "u1", email: "maria@example.com", purpose: "portal" })
    expect(otp.otpCode).toMatch(/^\d{6}$/)
    expect(otp.expiresAt.getTime() - Date.now()).toBeGreaterThan(9 * 60 * 1000)
    expect(sendTemplateEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "maria@example.com", templateKey: "portal.pin", locale: "es", userId: "u1",
      variables: expect.objectContaining({ pin: otp.otpCode, projectName: "Site rebuild", expiresMinutes: "10" }),
    }))
    expect(out.emailHint).toBe("m•••@example.com")
    expect(out.emailHint).not.toContain("maria")
  })
  test("rejects malformed, unknown, expired links", async () => {
    await expect(svc.requestPin("not-a-token")).rejects.toMatchObject({ code: "PORTAL_LINK_INVALID", statusCode: 404 })
    prisma.clientProject.findUnique.mockResolvedValue(null)
    await expect(svc.requestPin(TOKEN)).rejects.toMatchObject({ code: "PORTAL_LINK_INVALID" })
    prisma.clientProject.findUnique.mockResolvedValue(project({ portalTokenExpiresAt: new Date(Date.now() - 1000) }))
    await expect(svc.requestPin(TOKEN)).rejects.toMatchObject({ code: "PORTAL_LINK_EXPIRED", statusCode: 410 })
    expect(prisma.authOtp.create).not.toHaveBeenCalled()
  })
})

describe("verifyPin", () => {
  beforeEach(() => prisma.clientProject.findUnique.mockResolvedValue(project()))

  test("latest unused OTP → marked used, portal-scoped JWT for 2 h", async () => {
    prisma.authOtp.findFirst.mockResolvedValue({ id: "otp1", otpCode: "123456" })
    const out = await svc.verifyPin(TOKEN, "123 456")
    const where = prisma.authOtp.findFirst.mock.calls[0][0].where
    expect(where).toMatchObject({ userId: "u1", purpose: "portal", usedAt: null })
    expect(prisma.authOtp.update).toHaveBeenCalledWith({ where: { id: "otp1" }, data: { usedAt: expect.any(Date) } })
    const decoded = jwt.verify(out.token, "test-secret")
    expect(decoded).toMatchObject({ scope: "portal", projectId: "p1", userId: "u1" })
    expect(decoded.exp - decoded.iat).toBe(2 * 60 * 60)
    expect(out).toMatchObject({ projectId: "p1", projectName: "Site rebuild" })
  })
  test("wrong / missing PIN → 401, bad shape → 400, nothing marked used", async () => {
    prisma.authOtp.findFirst.mockResolvedValue({ id: "otp1", otpCode: "123456" })
    await expect(svc.verifyPin(TOKEN, "654321")).rejects.toMatchObject({ code: "PORTAL_PIN_INVALID", statusCode: 401 })
    await expect(svc.verifyPin(TOKEN, "12ab")).rejects.toMatchObject({ code: "VALIDATION_ERROR", statusCode: 400 })
    prisma.authOtp.findFirst.mockResolvedValue(null)
    await expect(svc.verifyPin(TOKEN, "123456")).rejects.toMatchObject({ code: "PORTAL_PIN_INVALID" })
    expect(prisma.authOtp.update).not.toHaveBeenCalled()
  })
})

describe("portal cookie + portalAuth", () => {
  test("setPortalCookie writes httpOnly mu_portal for 2 h", () => {
    const res = mockRes()
    setPortalCookie(res, "tok")
    expect(res.cookies[PORTAL_COOKIE]).toEqual({ value: "tok", opts: expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/", maxAge: PORTAL_MAX_AGE }) })
    expect(PORTAL_MAX_AGE).toBe(2 * 60 * 60 * 1000)
  })
  test("accepts a portal-scoped token from the cookie only", () => {
    const token = jwt.sign({ scope: "portal", projectId: "p1", userId: "u1" }, "test-secret", { expiresIn: "2h" })
    const next = jest.fn()
    const req = { cookies: { [PORTAL_COOKIE]: token } }
    portalAuth(req, mockRes(), next)
    expect(next).toHaveBeenCalledTimes(1)
    expect(req.portal).toEqual({ projectId: "p1", userId: "u1" })

    const res2 = mockRes()
    portalAuth({ cookies: {}, headers: { authorization: `Bearer ${token}` } }, res2, next)
    expect(res2.status).toHaveBeenCalledWith(401)
    expect(res2.json.mock.calls[0][0].error.code).toBe("PORTAL_AUTH_MISSING")
  })
  test("refuses session JWTs, other scopes, expired and forged tokens", () => {
    const cases = [
      jwt.sign({ userId: "u1", email: "x@y.z", role: "member" }, "test-secret"),
      jwt.sign({ scope: "other", projectId: "p1", userId: "u1" }, "test-secret"),
      jwt.sign({ scope: "portal", projectId: "p1", userId: "u1" }, "test-secret", { expiresIn: -10 }),
      jwt.sign({ scope: "portal", projectId: "p1", userId: "u1" }, "wrong-secret"),
    ]
    for (const t of cases) {
      const res = mockRes(); const next = jest.fn()
      portalAuth({ cookies: { [PORTAL_COOKIE]: t } }, res, next)
      expect(next).not.toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(401)
    }
  })
})

describe("loadPortalProject", () => {
  const full = (over = {}) => ({
    ...project(), description: "Rebuild", startDate: null, dueDate: null, previewUrl: "https://demo.example.com",
    assignedAdmin: { id: "a1", fullName: "Mustapha", email: "m@x.y" }, requiresNda: false, ndaVersion: null,
    milestones: [{ id: "m1", title: "Kickoff", status: "completed", projectId: "p1", sortOrder: 0, clientNote: "secret" }],
    files: [
      { id: "f1", fileName: "brief.pdf", filePath: "/files/projects/p1/brief.pdf", fileSize: 10, supportMessageId: null, uploadedBy: { id: "u1" } },
      { id: "f2", fileName: "ticket.png", filePath: "/files/projects/p1/t.png", supportMessageId: "sm1" },
    ],
    comments: [{ id: "c1" }], tickets: [{ id: "t1" }], ...over,
  })
  test("read-only shape: milestones + files (no ticket attachments), no comments/tickets/paths", async () => {
    prisma.clientProject.findFirst.mockResolvedValue(full())
    const out = await svc.loadPortalProject({ projectId: "p1", userId: "u1" })
    expect(prisma.clientProject.findFirst.mock.calls[0][0].where).toEqual({ id: "p1", userId: "u1" })
    expect(out.access).toMatchObject({ readOnly: true, isClosed: false })
    expect(out.milestones).toEqual([expect.objectContaining({ id: "m1", title: "Kickoff", status: "completed" })])
    expect(out.milestones[0]).not.toHaveProperty("clientNote")
    expect(out.files.map((f) => f.id)).toEqual(["f1"])
    expect(out.files[0]).not.toHaveProperty("filePath")
    expect(out).not.toHaveProperty("comments")
    expect(out).not.toHaveProperty("tickets")
    expect(out.previewUrl).toBe("https://demo.example.com")
    expect(out.ndaGate).toBe(false)
  })
  test("NDA gate hides milestones/files/preview until accepted", async () => {
    prisma.clientProject.findFirst.mockResolvedValue(full({ requiresNda: true }))
    prisma.projectAgreement.findFirst.mockResolvedValue(null)
    const out = await svc.loadPortalProject({ projectId: "p1", userId: "u1" })
    expect(out).toMatchObject({ ndaGate: true, milestones: [], files: [], previewUrl: null, nda: { required: true, accepted: false } })
  })
  test("expired project → 410, unknown → 404", async () => {
    prisma.clientProject.findFirst.mockResolvedValue(full({ projectStatus: "completed", closedAt: new Date(Date.now() - 40 * DAY) }))
    await expect(svc.loadPortalProject({ projectId: "p1", userId: "u1" })).rejects.toMatchObject({ code: "PROJECT_EXPIRED", statusCode: 410 })
    prisma.clientProject.findFirst.mockResolvedValue(null)
    await expect(svc.loadPortalProject({ projectId: "p1", userId: "u1" })).rejects.toMatchObject({ code: "NOT_FOUND" })
  })
})

describe("rate limiting", () => {
  test("PIN requests are limited to 5 per 15 minutes per IP", () => {
    expect(typeof portalPinRateLimiter).toBe("function")
    // express-rate-limit does not expose its options; assert the declared
    // budget at the source so a loosened limit shows up in review.
    const src = require("fs").readFileSync(require.resolve("../src/middleware/rateLimiter.js"), "utf8")
    const block = src.slice(src.indexOf("const portalPinRateLimiter"), src.indexOf("const portalVerifyRateLimiter"))
    expect(block).toMatch(/windowMs:\s+FIFTEEN_MIN/)
    expect(block).toMatch(/max:\s+5,/)
    expect(block).toMatch(/keyGenerator:\s+ipKey/)
  })
})
