// ─────────────────────────────────────────────────────────────────────────────
// downloadService · library + per-file tally — unit tests (Jest)
//
// Covers the read-side helpers added for the products funnel (roadmap 26):
//   countConsumedByFile      — per-file DownloadLog tally incl. legacy rows
//   computeDownloadsRemaining — cap precedence (file cap > entitlement cap)
//   getDownloadLibraryForUser — orders → products → files grouping
//
// Run: npm test -- downloadLibrary
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({
  downloadLog:  { findMany: jest.fn() },
  userDownload: { findMany: jest.fn() },
}))

const prisma = require("../src/lib/prisma")
const {
  countConsumedByFile,
  computeDownloadsRemaining,
  getDownloadLibraryForUser,
} = require("../src/services/downloadService")

beforeEach(() => jest.clearAllMocks())

describe("countConsumedByFile", () => {
  it("returns an empty map without a user or files (no DB call)", async () => {
    expect((await countConsumedByFile(null, [{ id: "f1", productId: "p1" }])).size).toBe(0)
    expect((await countConsumedByFile("u1", [])).size).toBe(0)
    expect(prisma.downloadLog.findMany).not.toHaveBeenCalled()
  })

  it("tallies by productFileId and applies legacy null rows to every file of the product", async () => {
    prisma.downloadLog.findMany.mockResolvedValue([
      { productFileId: "f1", productId: "p1" },
      { productFileId: "f1", productId: "p1" },
      { productFileId: null, productId: "p1" },   // legacy row → counts for f1 and f2
      { productFileId: "zzz", productId: "p9" },  // unrelated file → ignored
    ])
    const map = await countConsumedByFile("u1", [
      { id: "f1", productId: "p1" },
      { id: "f2", productId: "p1" },
      { id: "f3", productId: "p2" },
    ])
    expect(map.get("f1")).toBe(3)
    expect(map.get("f2")).toBe(1)
    expect(map.get("f3")).toBe(0)

    const where = prisma.downloadLog.findMany.mock.calls[0][0].where
    expect(where.userId).toBe("u1")
    expect(where.OR[0]).toEqual({ productFileId: { in: ["f1", "f2", "f3"] } })
    expect(where.OR[1]).toEqual({ productFileId: null, productId: { in: ["p1", "p2"] } })
  })
})

describe("computeDownloadsRemaining", () => {
  it("prefers the per-file cap", () => {
    expect(computeDownloadsRemaining({ maxDownloadsPerUser: 5 }, { downloadLimit: 1, downloadCount: 1 }, 2)).toBe(3)
  })
  it("never goes below zero", () => {
    expect(computeDownloadsRemaining({ maxDownloadsPerUser: 2 }, null, 7)).toBe(0)
  })
  it("falls back to the entitlement cap, then unlimited (null)", () => {
    expect(computeDownloadsRemaining({ maxDownloadsPerUser: null }, { downloadLimit: 3, downloadCount: 1 }, 99)).toBe(2)
    expect(computeDownloadsRemaining({ maxDownloadsPerUser: null }, { downloadLimit: null }, 99)).toBeNull()
  })
})

describe("getDownloadLibraryForUser", () => {
  const order = {
    id: "o1", orderNumber: "MU-1001", status: "paid", currency: "MXN",
    createdAt: new Date("2026-01-01"), paidAt: new Date("2026-01-02"), invoices: [{ id: "inv1" }],
  }
  const product = {
    id: "p1", title: "Guide", slug: "guide", isActive: true, updatedAt: new Date("2026-02-01"), version: null,
    images: [{ url: "/uploads/g.png", altText: "Guide" }],
    files: [
      { id: "f1", productId: "p1", fileName: "guide.pdf", fileType: "application/pdf", fileSize: 1024, version: "2.0", isPrimary: true, maxDownloadsPerUser: 3, uploadedAt: new Date() },
      { id: "f2", productId: "p1", fileName: "extras.zip", fileType: "application/zip", fileSize: 2048, version: "1.0", isPrimary: false, maxDownloadsPerUser: null, uploadedAt: new Date() },
    ],
  }

  it("returns an empty library for a missing user without touching the DB", async () => {
    expect(await getDownloadLibraryForUser(null)).toEqual({ orders: [] })
    expect(prisma.userDownload.findMany).not.toHaveBeenCalled()
  })

  it("groups entitlements by order and computes per-file remaining counts", async () => {
    prisma.userDownload.findMany.mockResolvedValue([
      { id: "e1", orderId: "o1", productId: "p1", downloadAccessStatus: "active", downloadLimit: 10, downloadCount: 4, lastDownloadedAt: null, order, product },
    ])
    prisma.downloadLog.findMany.mockResolvedValue([
      { productFileId: "f1", productId: "p1" },
      { productFileId: "f1", productId: "p1" },
    ])

    const { orders } = await getDownloadLibraryForUser("u1")
    expect(orders).toHaveLength(1)

    const o = orders[0]
    expect(o.orderNumber).toBe("MU-1001")
    expect(o.purchasedAt).toEqual(order.paidAt)
    expect(o.invoicePdfUrl).toBe("/api/orders/o1/invoice.pdf")
    expect(o.products).toHaveLength(1)

    const p = o.products[0]
    expect(p.latestVersion).toBe("2.0")          // primary file's version
    expect(p.entitlementStatus).toBe("active")
    expect(p.files.map((f) => f.fileId)).toEqual(["f1", "f2"])

    const [f1, f2] = p.files
    expect(f1.downloadsUsed).toBe(2)
    expect(f1.downloadsRemaining).toBe(1)        // 3 cap − 2 used
    expect(f1.downloadUrl).toBe("/api/downloads/f1")
    expect(f2.downloadsRemaining).toBe(6)        // entitlement 10 − 4

    // Only paid orders are queried
    expect(prisma.userDownload.findMany.mock.calls[0][0].where).toEqual({ userId: "u1", order: { status: "paid" } })
  })

  it("does not duplicate a product bought twice in the same order and omits the invoice link when none exists", async () => {
    prisma.userDownload.findMany.mockResolvedValue([
      { id: "e1", orderId: "o1", productId: "p1", downloadAccessStatus: "active", downloadLimit: null, downloadCount: 0, order: { ...order, invoices: [] }, product },
      { id: "e2", orderId: "o1", productId: "p1", downloadAccessStatus: "active", downloadLimit: null, downloadCount: 0, order: { ...order, invoices: [] }, product },
    ])
    prisma.downloadLog.findMany.mockResolvedValue([])

    const { orders } = await getDownloadLibraryForUser("u1")
    expect(orders[0].products).toHaveLength(1)
    expect(orders[0].invoicePdfUrl).toBeNull()
    expect(orders[0].products[0].files[1].downloadsRemaining).toBeNull()
  })
})
