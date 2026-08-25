// ─────────────────────────────────────────────────────────────────────────────
// services/newsletterService — double opt-in: subscribe() parks the address
// as "pending" and confirmByToken() promotes it.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({
  newsletterSubscriber: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
}))

const prisma = require("../src/lib/prisma")
const svc = require("../src/services/newsletterService")

beforeEach(() => jest.clearAllMocks())

test("new address → pending row + confirmation", async () => {
  prisma.newsletterSubscriber.findUnique.mockResolvedValue(null)
  prisma.newsletterSubscriber.create.mockImplementation(async ({ data }) => ({ id: "s1", ...data }))

  const r = await svc.subscribe({ email: "A@B.co", source: "home" })

  expect(prisma.newsletterSubscriber.create.mock.calls[0][0].data.status).toBe("pending")
  expect(r.sendConfirmation).toBe(true)
  expect(r.confirmUrl).toMatch(/\/api\/v1\/newsletter\/confirm\/[0-9a-f]{64}$/)
})

test("already subscribed → no-op", async () => {
  prisma.newsletterSubscriber.findUnique.mockResolvedValue({ id: "s1", status: "subscribed", unsubscribeToken: "t" })
  const r = await svc.subscribe({ email: "a@b.co" })
  expect(r.sendConfirmation).toBe(false)
  expect(r.alreadySubscribed).toBe(true)
  expect(prisma.newsletterSubscriber.update).not.toHaveBeenCalled()
})

test("pending within 10 min → rate limited; older → resend", async () => {
  prisma.newsletterSubscriber.findUnique.mockResolvedValue({
    id: "s1", status: "pending", unsubscribeToken: "t", subscribedAt: new Date(),
  })
  expect((await svc.subscribe({ email: "a@b.co" })).rateLimited).toBe(true)

  prisma.newsletterSubscriber.findUnique.mockResolvedValue({
    id: "s1", status: "pending", unsubscribeToken: "t", subscribedAt: new Date(Date.now() - 11 * 60 * 1000),
  })
  prisma.newsletterSubscriber.update.mockImplementation(async ({ data }) => ({ id: "s1", unsubscribeToken: "t", ...data }))
  const r = await svc.subscribe({ email: "a@b.co" })
  expect(r.sendConfirmation).toBe(true)
  expect(r.confirmUrl).toContain("/confirm/t")
})

test("confirmByToken promotes pending → subscribed and rotates the token", async () => {
  prisma.newsletterSubscriber.findUnique.mockResolvedValueOnce({ id: "s1", status: "pending", unsubscribeToken: "t" }).mockResolvedValue(null)
  prisma.newsletterSubscriber.update.mockImplementation(async ({ data }) => ({ id: "s1", ...data }))

  const row = await svc.confirmByToken("t")

  expect(row.status).toBe("subscribed")
  expect(row.unsubscribeToken).not.toBe("t")
  expect(await svc.confirmByToken("nope")).toBeNull()
})
