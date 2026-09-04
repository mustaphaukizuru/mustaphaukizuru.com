// ─────────────────────────────────────────────────────────────────────────────
// profile ARCO endpoints (LFPDPPP · Tier 1) — Jest
//
//   1. exportUserData returns every bucket, strips secrets, bounds lists.
//   2. deleteMyAccount refuses with 409 HAS_OPEN_ACTIVITY when work is open.
//   3. deleteMyAccount anonymises the row, drops PII rows, revokes sessions
//      and clears the session cookies.
//
// Same Prisma mock shape as serviceOrderAudit.test.js (`__tx` exposed).
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => {
  const tx = {
    address:              { deleteMany: jest.fn().mockResolvedValue({}) },
    userProfile:          { deleteMany: jest.fn().mockResolvedValue({}) },
    newsletterSubscriber: { deleteMany: jest.fn().mockResolvedValue({}) },
    user:                 { update: jest.fn().mockResolvedValue({}) },
    activityLog:          { create: jest.fn().mockResolvedValue({}) },
  }
  return {
    user:                 { findUnique: jest.fn(), update: jest.fn() },
    userProfile:          { findUnique: jest.fn() },
    address:              { findMany: jest.fn() },
    order:                { findMany: jest.fn(), count: jest.fn() },
    serviceOrder:         { findMany: jest.fn(), count: jest.fn() },
    consultation:         { findMany: jest.fn(), count: jest.fn() },
    clientProject:        { findMany: jest.fn(), count: jest.fn() },
    supportTicket:        { findMany: jest.fn() },
    review:               { findMany: jest.fn() },
    newsletterSubscriber: { findUnique: jest.fn() },
    notification:         { findMany: jest.fn() },
    userDownload:         { findMany: jest.fn() },
    emailTemplate:        { findFirst: jest.fn().mockResolvedValue(null) },
    $transaction:         jest.fn(async (cb) => cb(tx)),
    __tx: tx,
  }
})

jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))
jest.mock("../src/services/authService", () => ({ revokeUserSessions: jest.fn().mockResolvedValue(true) }))
jest.mock("../src/services/emailService", () => ({ sendTemplateEmail: jest.fn() }))
jest.mock("../src/utils/sessionCookie", () => ({ clearSessionCookie: jest.fn() }))

const prisma  = require("../src/lib/prisma")
const bcrypt  = require("bcryptjs")
const { revokeUserSessions } = require("../src/services/authService")
const { clearSessionCookie } = require("../src/utils/sessionCookie")
const profileService = require("../src/services/profileService")
const { deleteMyAccount, exportMyData } = require("../src/controllers/profileController")

const USER_ID = "usr_1"

// asyncHandler swallows the promise (it only forwards rejections to next),
// so we resolve when the controller writes a body — or when next() fires.
function run(handler, req) {
  return new Promise((resolve, reject) => {
    const res = { statusCode: 200, headers: {}, body: undefined }
    res.status    = jest.fn((c) => { res.statusCode = c; return res })
    res.json      = jest.fn((b) => { res.body = b; resolve(res); return res })
    res.send      = jest.fn((b) => { res.body = b; resolve(res); return res })
    res.setHeader = jest.fn((k, v) => { res.headers[k] = v })
    handler(req, res, (err) => reject(err))
  })
}

function primeExport() {
  prisma.user.findUnique.mockResolvedValue({
    id: USER_ID, fullName: "Ana", email: "ana@example.com", role: "member",
    phone: null, company: null, avatarUrl: null, authProvider: "local", status: "active",
    emailVerifiedAt: null, lastLoginAt: null, createdAt: new Date(), updatedAt: new Date(),
  })
  prisma.userProfile.findUnique.mockResolvedValue({ userId: USER_ID, city: "CDMX" })
  prisma.address.findMany.mockResolvedValue([{ id: "a1", taxId: "XAXX010101000" }])
  prisma.order.findMany.mockResolvedValue([{
    id: "o1", status: "paid", items: [{ id: "i1" }],
    payments: [{ id: "p1", paymentGateway: "paypal", amount: "10.00" }],
  }])
  for (const m of ["serviceOrder", "consultation", "clientProject", "supportTicket", "review", "notification", "userDownload"]) {
    prisma[m].findMany.mockResolvedValue([])
  }
  prisma.newsletterSubscriber.findUnique.mockResolvedValue({ email: "ana@example.com", status: "subscribed" })
}

beforeEach(() => {
  jest.clearAllMocks()
  prisma.$transaction.mockImplementation(async (cb) => cb(prisma.__tx))
})

describe("GET /profile/export", () => {
  test("returns every bucket, never selects secrets, bounds every list", async () => {
    primeExport()
    const res = await run(exportMyData, { user: { id: USER_ID } })

    expect(res.statusCode).toBe(200)
    expect(res.headers["Content-Disposition"]).toBe('attachment; filename="my-data.json"')
    const data = JSON.parse(res.body)
    expect(Object.keys(data)).toEqual(expect.arrayContaining([
      "user", "profile", "addresses", "orders", "serviceOrders", "consultations",
      "clientProjects", "supportTickets", "reviews", "newsletter", "notifications", "downloads",
    ]))
    expect(data.user.email).toBe("ana@example.com")
    expect(data.user).not.toHaveProperty("passwordHash")
    expect(data.user).not.toHaveProperty("tokensValidFrom")
    expect(data.user).not.toHaveProperty("resetPasswordToken")

    // user select must not ask for secrets at all
    const userSelect = prisma.user.findUnique.mock.calls[0][0].select
    expect(userSelect.passwordHash).toBeUndefined()
    expect(userSelect.resetPasswordToken).toBeUndefined()

    // payments only expose the safe subset — no gatewaySessionId
    const orderArgs = prisma.order.findMany.mock.calls[0][0]
    expect(orderArgs.include.payments.select.gatewaySessionId).toBeUndefined()
    expect(orderArgs.include.payments.select.paymentGateway).toBe(true)

    // every findMany is bounded and newest-first
    for (const m of ["address", "order", "serviceOrder", "consultation", "clientProject", "supportTicket", "review", "notification", "userDownload"]) {
      const args = prisma[m].findMany.mock.calls[0][0]
      expect(args.take).toBeLessThanOrEqual(500)
      expect(args.orderBy).toEqual({ createdAt: "desc" })
      expect(args.where.userId).toBe(USER_ID)
    }
    // newsletter row is looked up by the user's email, not by id
    expect(prisma.newsletterSubscriber.findUnique).toHaveBeenCalledWith({ where: { email: "ana@example.com" } })
  })

  test("404 when the user row is gone", async () => {
    prisma.user.findUnique.mockResolvedValue(null)
    const res = await run(exportMyData, { user: { id: USER_ID } })
    expect(res.statusCode).toBe(404)
  })
})

describe("DELETE /profile", () => {
  let hash
  beforeAll(async () => { hash = await bcrypt.hash("correct-horse", 4) })

  function primeCounts({ pending = 0, so = 0, proj = 0, cons = 0 } = {}) {
    prisma.order.count.mockResolvedValue(pending)
    prisma.serviceOrder.count.mockResolvedValue(so)
    prisma.clientProject.count.mockResolvedValue(proj)
    prisma.consultation.count.mockResolvedValue(cons)
  }

  test("400 when a password account sends no password", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ passwordHash: hash })
    const res = await run(deleteMyAccount, { user: { id: USER_ID }, body: {} })
    expect(res.statusCode).toBe(400)
    expect(res.body.error.code).toBe("PASSWORD_REQUIRED")
  })

  test("401 on a wrong password", async () => {
    prisma.user.findUnique.mockResolvedValue({ passwordHash: hash })
    const res = await run(deleteMyAccount, { user: { id: USER_ID }, body: { password: "nope" } })
    expect(res.statusCode).toBe(401)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  test("409 HAS_OPEN_ACTIVITY when an upcoming consultation exists", async () => {
    prisma.user.findUnique.mockResolvedValue({ passwordHash: hash })
    primeCounts({ cons: 1 })
    const res = await run(deleteMyAccount, { user: { id: USER_ID }, body: { password: "correct-horse" } })
    expect(res.statusCode).toBe(409)
    expect(res.body.error.code).toBe("HAS_OPEN_ACTIVITY")
    expect(res.body.error.details.reasons).toEqual(["upcoming_consultation"])
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(revokeUserSessions).not.toHaveBeenCalled()
  })

  test("409 when a pending order or active project exists", async () => {
    prisma.user.findUnique.mockResolvedValue({ passwordHash: hash })
    primeCounts({ pending: 1, proj: 2 })
    const res = await run(deleteMyAccount, { user: { id: USER_ID }, body: { password: "correct-horse" } })
    expect(res.statusCode).toBe(409)
    expect(res.body.error.details.reasons).toEqual(["pending_order", "active_project"])
  })

  test("anonymises, scrubs PII rows, revokes sessions and clears cookies", async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({ passwordHash: hash })                                             // getPasswordHash
      .mockResolvedValueOnce({ passwordHash: hash })                                             // verifyCurrentPassword
      .mockResolvedValueOnce({ id: USER_ID, email: "ana@example.com", fullName: "Ana", avatarUrl: null }) // deleteAccount
    primeCounts()

    const res = await run(deleteMyAccount, { user: { id: USER_ID }, body: { password: "correct-horse" }, ip: "1.2.3.4" })
    expect(res.statusCode).toBe(200)

    const tx = prisma.__tx
    expect(tx.address.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } })
    expect(tx.newsletterSubscriber.deleteMany).toHaveBeenCalledWith({ where: { email: "ana@example.com" } })

    const update = tx.user.update.mock.calls[0][0]
    expect(update.where).toEqual({ id: USER_ID })
    expect(update.data.email).toBe(`deleted+${USER_ID}@anonymized.invalid`)
    expect(update.data.phone).toBeNull()
    expect(update.data.avatarUrl).toBeNull()
    expect(update.data.passwordHash).toBeNull()
    expect(update.data.googleId).toBeNull()
    expect(update.data.status).toBe("suspended") // UserStatus has no `deleted`
    expect(update.data.tokensValidFrom).toBeInstanceOf(Date)

    expect(tx.activityLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: USER_ID, action: "account.deleted", ipAddress: "1.2.3.4" }),
    }))
    expect(revokeUserSessions).toHaveBeenCalledWith(USER_ID)
    expect(clearSessionCookie).toHaveBeenCalledTimes(1)
  })

  test("OAuth-only account (no passwordHash) skips the password check", async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({ passwordHash: null })
      .mockResolvedValueOnce({ id: USER_ID, email: "g@example.com", fullName: "G", avatarUrl: null })
    primeCounts()
    const res = await run(deleteMyAccount, { user: { id: USER_ID }, body: {} })
    expect(res.statusCode).toBe(200)
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
  })

  test("service: sends a confirmation email only when a template exists", async () => {
    const { sendTemplateEmail } = require("../src/services/emailService")
    prisma.user.findUnique.mockResolvedValueOnce({ id: USER_ID, email: "ana@example.com", fullName: "Ana", avatarUrl: null })
    prisma.emailTemplate.findFirst.mockResolvedValueOnce({ key: "account.deleted" })
    await profileService.deleteAccount(USER_ID)
    expect(sendTemplateEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "ana@example.com", templateKey: "account.deleted" }))
  })
})
