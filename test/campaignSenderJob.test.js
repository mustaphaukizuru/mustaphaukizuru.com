// ─────────────────────────────────────────────────────────────────────────────
// jobs/campaignSenderJob — queued recipients are drained in batches, marked
// sent/failed, and the campaign completes once nothing is left.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({
  emailCampaign:          { findMany: jest.fn(), update: jest.fn().mockResolvedValue({}) },
  emailCampaignRecipient: { findMany: jest.fn(), count: jest.fn(), update: jest.fn().mockResolvedValue({}), updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
  newsletterSubscriber:   { findMany: jest.fn().mockResolvedValue([]) },
}))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))
jest.mock("../src/services/emailService", () => ({ sendRawEmail: jest.fn() }))
jest.mock("../src/services/adminCampaignService", () => ({
  renderCampaignHtml: jest.fn(() => "<html/>"),
  unsubscribeUrlFor:  jest.fn((t) => (t ? `https://x/unsub/${t}` : "https://x/contact")),
}))

const prisma = require("../src/lib/prisma")
const emailService = require("../src/services/emailService")
const { runCampaignSenderPass } = require("../src/jobs/campaignSenderJob")

const campaign = { id: "c1", subject: "Hi", fromName: "M", fromEmail: "m@x.y", replyTo: null, body: [] }

beforeEach(() => jest.clearAllMocks())

test("no sending campaigns → no-op", async () => {
  prisma.emailCampaign.findMany.mockResolvedValue([])
  expect(await runCampaignSenderPass()).toEqual({ campaigns: 0, sent: 0, failed: 0 })
})

test("sends a batch, marks sent/failed, increments counters", async () => {
  prisma.emailCampaign.findMany.mockResolvedValue([campaign])
  prisma.emailCampaignRecipient.findMany.mockResolvedValue([
    { id: "r1", email: "a@b.c" },
    { id: "r2", email: "d@e.f" },
  ])
  prisma.newsletterSubscriber.findMany.mockResolvedValue([{ email: "a@b.c", unsubscribeToken: "tok" }])
  emailService.sendRawEmail
    .mockResolvedValueOnce({ ok: true, messageId: "m1" })
    .mockRejectedValueOnce(new Error("smtp down"))

  const r = await runCampaignSenderPass()

  expect(r).toEqual({ campaigns: 1, sent: 1, failed: 1 })
  expect(emailService.sendRawEmail.mock.calls[0][0].headers["List-Unsubscribe"]).toBe("<https://x/unsub/tok>")
  expect(prisma.emailCampaignRecipient.update).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: "r1" }, data: expect.objectContaining({ status: "sent", providerId: "m1" }),
  }))
  expect(prisma.emailCampaignRecipient.update).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: "r2" }, data: expect.objectContaining({ status: "failed", errorMessage: "smtp down" }),
  }))
  expect(prisma.emailCampaign.update).toHaveBeenCalledWith({
    where: { id: "c1" },
    data:  { sentCount: { increment: 1 }, failedCount: { increment: 1 } },
  })
})

test("completes the campaign when the queue is empty", async () => {
  prisma.emailCampaign.findMany.mockResolvedValue([campaign])
  prisma.emailCampaignRecipient.findMany.mockResolvedValue([])
  prisma.emailCampaignRecipient.count.mockResolvedValueOnce(0).mockResolvedValueOnce(5).mockResolvedValueOnce(1)

  await runCampaignSenderPass()

  expect(emailService.sendRawEmail).not.toHaveBeenCalled()
  const call = prisma.emailCampaign.update.mock.calls[0][0]
  expect(call.where).toEqual({ id: "c1" })
  expect(call.data).toEqual(expect.objectContaining({ status: "sent", sentCount: 5, failedCount: 1 }))
})
