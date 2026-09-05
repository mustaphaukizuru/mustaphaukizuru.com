/**
 * services/adminCampaignService — paged audiences, count-first send.
 *
 * A1. Starting a campaign used to load EVERY subscriber into an array and
 * build one createMany from it. These tests pin the properties that make the
 * new path safe at any list size:
 *
 *   - the audience is paged by cursor; nothing larger than one page is held
 *   - recipient rows are inserted page by page, idempotently
 *   - the campaign flips to "sending" LAST — after every recipient row
 *     exists — because the sender job treats "sending with no queued rows"
 *     as "complete"
 *   - the empty-audience check and the preview count are COUNT queries, not
 *     materialised lists
 *   - member token lookup is bounded by the page, not the whole user table
 */

jest.mock("../src/lib/prisma", () => ({
  newsletterSubscriber:   { findMany: jest.fn(), count: jest.fn() },
  user:                   { findMany: jest.fn(), count: jest.fn() },
  emailCampaign:          { findUnique: jest.fn(), update: jest.fn() },
  emailCampaignRecipient: { createMany: jest.fn() },
  // T3-5 · the audience now excludes suppressed addresses.
  suppressionList:        { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), upsert: jest.fn() },
}))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))

const prisma = require("../src/lib/prisma")
const svc = require("../src/services/adminCampaignService")

// Nobody suppressed by default, so every existing case still describes the
// audience it was written for. The suppression behaviour has its own cases
// in test/suppression.test.js.
beforeEach(() => {
  prisma.suppressionList.findMany.mockResolvedValue([])
  prisma.suppressionList.count.mockResolvedValue(0)
})

const PAGE = 1000
const subs = (n, offset = 0) =>
  Array.from({ length: n }, (_, i) => ({ id: `s${String(offset + i).padStart(6, "0")}`, email: `u${offset + i}@x.test`, unsubscribeToken: `t${offset + i}` }))

beforeEach(() => {
  jest.clearAllMocks()
  prisma.emailCampaignRecipient.createMany.mockImplementation(async ({ data }) => ({ count: data.length }))
  prisma.emailCampaign.update.mockResolvedValue({})
})

describe("forEachAudiencePage", () => {
  test("pages the newsletter audience by cursor and hands each page to fn", async () => {
    prisma.newsletterSubscriber.findMany
      .mockResolvedValueOnce(subs(PAGE, 0))
      .mockResolvedValueOnce(subs(7, PAGE))

    const pages = []
    await svc.forEachAudiencePage("newsletter", null, async (p) => { pages.push(p.length) })

    expect(pages).toEqual([PAGE, 7])
    const calls = prisma.newsletterSubscriber.findMany.mock.calls
    expect(calls[0][0]).toMatchObject({ where: { status: "subscribed" }, take: PAGE, orderBy: { id: "asc" } })
    expect(calls[0][0].cursor).toBeUndefined()
    // Second page starts after the last id of the first, skipping the cursor row.
    expect(calls[1][0]).toMatchObject({ cursor: { id: "s000999" }, skip: 1, take: PAGE })
    // Internal cursor field never leaks to the caller.
    expect(Object.keys(pages)).not.toContain("_cursor")
  })

  test("a full final page triggers one more (empty) fetch and stops cleanly", async () => {
    prisma.newsletterSubscriber.findMany
      .mockResolvedValueOnce(subs(PAGE, 0))
      .mockResolvedValueOnce([])
    const fn = jest.fn()
    await svc.forEachAudiencePage("newsletter", null, fn)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(prisma.newsletterSubscriber.findMany).toHaveBeenCalledTimes(2)
  })

  test("members: token lookup is bounded by the PAGE, and tokens attach by email", async () => {
    prisma.user.findMany.mockResolvedValueOnce([
      { id: "u1", email: "A@x.test" },
      { id: "u2", email: "b@x.test" },
    ])
    prisma.newsletterSubscriber.findMany.mockResolvedValueOnce([{ email: "a@x.test", unsubscribeToken: "tok-a" }])

    const seen = []
    await svc.forEachAudiencePage("members", null, async (p) => { seen.push(...p) })

    expect(prisma.newsletterSubscriber.findMany.mock.calls[0][0].where).toEqual({ email: { in: ["A@x.test", "b@x.test"] } })
    expect(seen).toEqual([
      { email: "A@x.test", userId: "u1", unsubscribeToken: "tok-a" },   // case-insensitive match
      { email: "b@x.test", userId: "u2", unsubscribeToken: null },
    ])
  })

  test("custom: normalised, deduped, one page, no database access", async () => {
    const fn = jest.fn()
    await svc.forEachAudiencePage("custom", [" A@x.test ", "a@x.test", "", "b@x.test"], fn)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn.mock.calls[0][0]).toEqual([
      { email: "a@x.test", userId: null, unsubscribeToken: null },
      { email: "b@x.test", userId: null, unsubscribeToken: null },
    ])
    expect(prisma.newsletterSubscriber.findMany).not.toHaveBeenCalled()
    expect(prisma.user.findMany).not.toHaveBeenCalled()
  })

  test("an unknown audience yields nothing and touches nothing", async () => {
    const fn = jest.fn()
    await svc.forEachAudiencePage("everyone", null, fn)
    expect(fn).not.toHaveBeenCalled()
  })
})

describe("countAudience / getAudienceCount", () => {
  test("newsletter and members are COUNT queries, never findMany", async () => {
    prisma.newsletterSubscriber.count.mockResolvedValue(12345)
    prisma.user.count.mockResolvedValue(678)
    await expect(svc.getAudienceCount("newsletter")).resolves.toBe(12345)
    await expect(svc.getAudienceCount("members")).resolves.toBe(678)
    expect(prisma.newsletterSubscriber.count).toHaveBeenCalledWith({ where: { status: "subscribed" } })
    expect(prisma.user.count).toHaveBeenCalledWith({ where: { email: { not: null } } })
    expect(prisma.newsletterSubscriber.findMany).not.toHaveBeenCalled()
    expect(prisma.user.findMany).not.toHaveBeenCalled()
  })

  test("custom counts the deduped list", async () => {
    await expect(svc.getAudienceCount("custom", ["a@x.test", "A@x.test", "b@x.test"])).resolves.toBe(2)
  })
})

describe("sendCampaignNow", () => {
  const campaign = { id: "c1", status: "draft", audience: "newsletter", recipientEmails: null }

  test("inserts recipients page by page, then flips to sending with the real total — in that order", async () => {
    prisma.emailCampaign.findUnique.mockResolvedValue(campaign)
    prisma.newsletterSubscriber.count.mockResolvedValue(PAGE + 3)
    prisma.newsletterSubscriber.findMany
      .mockResolvedValueOnce(subs(PAGE, 0))
      .mockResolvedValueOnce(subs(3, PAGE))

    const order = []
    prisma.emailCampaignRecipient.createMany.mockImplementation(async ({ data }) => { order.push(`insert:${data.length}`); return { count: data.length } })
    prisma.emailCampaign.update.mockImplementation(async () => { order.push("status:sending"); return {} })

    await svc.sendCampaignNow("c1")

    expect(order).toEqual([`insert:${PAGE}`, "insert:3", "status:sending"])
    const upd = prisma.emailCampaign.update.mock.calls[0][0]
    expect(upd.where).toEqual({ id: "c1" })
    expect(upd.data).toMatchObject({ status: "sending", totalRecipients: PAGE + 3, sentCount: 0, failedCount: 0 })
    expect(upd.data.startedAt).toBeInstanceOf(Date)
    // Idempotent on re-run: duplicates are skipped at the unique index.
    expect(prisma.emailCampaignRecipient.createMany.mock.calls[0][0].skipDuplicates).toBe(true)
    expect(prisma.emailCampaignRecipient.createMany.mock.calls[0][0].data[0]).toEqual({ campaignId: "c1", email: "u0@x.test", userId: null })
  })

  test("totalRecipients reflects rows actually inserted, not rows attempted (re-run skips duplicates)", async () => {
    prisma.emailCampaign.findUnique.mockResolvedValue(campaign)
    prisma.newsletterSubscriber.count.mockResolvedValue(5)
    prisma.newsletterSubscriber.findMany.mockResolvedValueOnce(subs(5))
    prisma.emailCampaignRecipient.createMany.mockResolvedValue({ count: 2 }) // 3 already existed
    await svc.sendCampaignNow("c1")
    expect(prisma.emailCampaign.update.mock.calls[0][0].data.totalRecipients).toBe(2)
  })

  test("an empty audience is a 400 via COUNT, with no inserts and NO status change", async () => {
    prisma.emailCampaign.findUnique.mockResolvedValue(campaign)
    prisma.newsletterSubscriber.count.mockResolvedValue(0)
    await expect(svc.sendCampaignNow("c1")).rejects.toMatchObject({ statusCode: 400 })
    expect(prisma.newsletterSubscriber.findMany).not.toHaveBeenCalled()
    expect(prisma.emailCampaignRecipient.createMany).not.toHaveBeenCalled()
    expect(prisma.emailCampaign.update).not.toHaveBeenCalled()
  })

  test("a campaign already sending or sent is refused before any audience work", async () => {
    prisma.emailCampaign.findUnique.mockResolvedValue({ ...campaign, status: "sending" })
    await expect(svc.sendCampaignNow("c1")).rejects.toMatchObject({ statusCode: 400 })
    expect(prisma.newsletterSubscriber.count).not.toHaveBeenCalled()
  })

  test("unknown campaign is a 404", async () => {
    prisma.emailCampaign.findUnique.mockResolvedValue(null)
    await expect(svc.sendCampaignNow("nope")).rejects.toMatchObject({ statusCode: 404 })
  })
})
