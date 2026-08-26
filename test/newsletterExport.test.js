/**
 * services/newsletterService.exportSubscribersCsv — paged CSV export.
 *
 * A1. The export used to be one unbounded findMany that materialised the
 * whole subscriber table before producing a line of CSV. It now pulls 1,000
 * rows at a time by cursor. These tests pin the paging contract and that the
 * CSV itself is unchanged.
 */

jest.mock("../src/lib/prisma", () => ({
  newsletterSubscriber: { findMany: jest.fn() },
}))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))

const prisma = require("../src/lib/prisma")
const { exportSubscribersCsv } = require("../src/services/newsletterService")

const PAGE = 1000
const row = (i, over = {}) => ({
  id: `id${String(i).padStart(6, "0")}`, email: `u${i}@x.test`, name: null, status: "subscribed",
  source: "site", subscribedAt: new Date("2026-08-01T00:00:00Z"), unsubscribedAt: null, ...over,
})
const rows = (n, offset = 0) => Array.from({ length: n }, (_, i) => row(offset + i))

beforeEach(() => jest.clearAllMocks())

test("pages by cursor until a short page, and counts every row", async () => {
  prisma.newsletterSubscriber.findMany
    .mockResolvedValueOnce(rows(PAGE, 0))
    .mockResolvedValueOnce(rows(3, PAGE))

  const out = await exportSubscribersCsv()

  expect(out.count).toBe(PAGE + 3)
  const calls = prisma.newsletterSubscriber.findMany.mock.calls
  expect(calls).toHaveLength(2)
  expect(calls[0][0]).toMatchObject({ take: PAGE, orderBy: [{ subscribedAt: "desc" }, { id: "desc" }] })
  expect(calls[0][0].cursor).toBeUndefined()
  expect(calls[1][0]).toMatchObject({ cursor: { id: "id000999" }, skip: 1, take: PAGE })
  // Only the columns the CSV needs are selected.
  expect(Object.keys(calls[0][0].select).sort()).toEqual(["email", "id", "name", "source", "status", "subscribedAt", "unsubscribedAt"])
})

test("a status filter is applied to every page", async () => {
  prisma.newsletterSubscriber.findMany.mockResolvedValueOnce(rows(2))
  await exportSubscribersCsv({ status: "unsubscribed" })
  expect(prisma.newsletterSubscriber.findMany.mock.calls[0][0].where).toEqual({ status: "unsubscribed" })
})

test("an unknown status is ignored rather than producing an empty export", async () => {
  prisma.newsletterSubscriber.findMany.mockResolvedValueOnce(rows(1))
  await exportSubscribersCsv({ status: "bogus" })
  expect(prisma.newsletterSubscriber.findMany.mock.calls[0][0].where).toEqual({})
})

test("the CSV shape is unchanged: header, one line per row, escaping intact", async () => {
  prisma.newsletterSubscriber.findMany.mockResolvedValueOnce([
    row(1, { name: 'Ana "La Jefa" López, MX', unsubscribedAt: new Date("2026-08-02T00:00:00Z"), status: "unsubscribed" }),
    row(2),
  ])

  const { csv, count } = await exportSubscribersCsv()
  const lines = csv.split("\n")

  expect(count).toBe(2)
  expect(lines[0]).toBe("email,name,status,source,subscribed_at,unsubscribed_at")
  expect(lines[1]).toBe('u1@x.test,"Ana ""La Jefa"" López, MX",unsubscribed,site,2026-08-01T00:00:00.000Z,2026-08-02T00:00:00.000Z')
  expect(lines[2]).toBe("u2@x.test,,subscribed,site,2026-08-01T00:00:00.000Z,")
  expect(lines).toHaveLength(3)
})

test("an empty list yields the header only and a zero count", async () => {
  prisma.newsletterSubscriber.findMany.mockResolvedValueOnce([])
  const out = await exportSubscribersCsv()
  expect(out).toEqual({ csv: "email,name,status,source,subscribed_at,unsubscribed_at\n", count: 0 })
  expect(prisma.newsletterSubscriber.findMany).toHaveBeenCalledTimes(1)
})
