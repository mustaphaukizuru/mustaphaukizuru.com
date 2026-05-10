// ─────────────────────────────────────────────────────────────────────────────
// downloadService — unit tests (Jest)
//
// Strategy: mock prisma and exercise only the entitlement gate logic.
// No DB, no filesystem, no streaming — those are integration concerns.
//
// Run:
//   npm test                       # all tests
//   npm test -- downloadService    # this file only
// ─────────────────────────────────────────────────────────────────────────────

/* ────────────────────────────── mocks ──────────────────────────────────── */

jest.mock("../src/lib/prisma", () => ({
  productFile: {
    findUnique: jest.fn(),
  },
  userDownload: {
    findFirst: jest.fn(),
  },
  downloadLog: {
    count:  jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn(async (ops) => Promise.all(ops)),
}))

/* ───────────────────────── system-under-test ───────────────────────────── */

const prisma = require("../src/lib/prisma")
const { checkFileEntitlement } = require("../src/services/downloadService")

/* ─────────────────────────── fixtures ──────────────────────────────────── */

const baseFile = {
  id: "file_1",
  productId: "prod_1",
  fileName: "guide.pdf",
  filePath: "guide-v1.pdf",
  fileType: "application/pdf",
  fileSize: 1024,
  maxDownloadsPerUser: null,
  product: { id: "prod_1", isActive: true, title: "Pricing Guide" },
}

const baseEntitlement = {
  id: "ent_1",
  userId: "user_1",
  productId: "prod_1",
  orderId: "order_1",
  downloadAccessStatus: "active",
  downloadLimit: null,
  downloadCount: 0,
  order: { id: "order_1", orderNumber: "MU-1001", status: "paid" },
}

beforeEach(() => {
  jest.clearAllMocks()
})

/* ─────────────────────────────── tests ─────────────────────────────────── */

describe("checkFileEntitlement — input validation", () => {
  test("rejects when userId is missing", async () => {
    const result = await checkFileEntitlement(null, "file_1")
    expect(result).toEqual({
      allowed: false,
      code: "VALIDATION_ERROR",
      message: expect.stringMatching(/missing user or file/i),
    })
    expect(prisma.productFile.findUnique).not.toHaveBeenCalled()
  })

  test("rejects when productFileId is missing", async () => {
    const result = await checkFileEntitlement("user_1", null)
    expect(result.allowed).toBe(false)
    expect(result.code).toBe("VALIDATION_ERROR")
  })
})

describe("checkFileEntitlement — file lookup", () => {
  test("returns NOT_FOUND when file does not exist", async () => {
    prisma.productFile.findUnique.mockResolvedValue(null)
    const result = await checkFileEntitlement("user_1", "missing_file")
    expect(result).toEqual({
      allowed: false,
      code: "NOT_FOUND",
      message: expect.stringMatching(/file not found/i),
    })
  })

  test("returns FORBIDDEN when product is inactive (soft-deleted)", async () => {
    prisma.productFile.findUnique.mockResolvedValue({
      ...baseFile,
      product: { ...baseFile.product, isActive: false },
    })
    const result = await checkFileEntitlement("user_1", "file_1")
    expect(result.allowed).toBe(false)
    expect(result.code).toBe("FORBIDDEN")
    expect(result.message).toMatch(/no longer available/i)
  })
})

describe("checkFileEntitlement — entitlement gate", () => {
  test("returns FORBIDDEN when user has not purchased this product", async () => {
    prisma.productFile.findUnique.mockResolvedValue(baseFile)
    prisma.userDownload.findFirst.mockResolvedValue(null)
    const result = await checkFileEntitlement("user_1", "file_1")
    expect(result.allowed).toBe(false)
    expect(result.code).toBe("FORBIDDEN")
    expect(result.message).toMatch(/have not purchased/i)
  })

  test("returns FORBIDDEN when entitlement has been revoked", async () => {
    prisma.productFile.findUnique.mockResolvedValue(baseFile)
    prisma.userDownload.findFirst.mockResolvedValue({
      ...baseEntitlement,
      downloadAccessStatus: "revoked",
    })
    const result = await checkFileEntitlement("user_1", "file_1")
    expect(result.allowed).toBe(false)
    expect(result.code).toBe("FORBIDDEN")
    expect(result.message).toMatch(/revoked/i)
  })
})

describe("checkFileEntitlement — download caps", () => {
  test("returns LIMIT_EXCEEDED when per-entitlement cap is reached", async () => {
    prisma.productFile.findUnique.mockResolvedValue(baseFile)
    prisma.userDownload.findFirst.mockResolvedValue({
      ...baseEntitlement,
      downloadLimit: 3,
      downloadCount: 3,
    })
    const result = await checkFileEntitlement("user_1", "file_1")
    expect(result.allowed).toBe(false)
    expect(result.code).toBe("LIMIT_EXCEEDED")
  })

  test("returns LIMIT_EXCEEDED when per-file-per-user cap is reached", async () => {
    prisma.productFile.findUnique.mockResolvedValue({
      ...baseFile,
      maxDownloadsPerUser: 2,
    })
    prisma.userDownload.findFirst.mockResolvedValue(baseEntitlement)
    prisma.downloadLog.count.mockResolvedValue(2)
    const result = await checkFileEntitlement("user_1", "file_1")
    expect(result.allowed).toBe(false)
    expect(result.code).toBe("LIMIT_EXCEEDED")
    expect(result.message).toMatch(/2-download limit/)
  })
})

describe("checkFileEntitlement — happy paths", () => {
  test("allows download when entitlement is active and no caps configured", async () => {
    prisma.productFile.findUnique.mockResolvedValue(baseFile)
    prisma.userDownload.findFirst.mockResolvedValue(baseEntitlement)
    const result = await checkFileEntitlement("user_1", "file_1")
    expect(result.allowed).toBe(true)
    expect(result.file.id).toBe("file_1")
    expect(result.entitlement.id).toBe("ent_1")
    expect(result.downloadsRemaining).toBeNull()
  })

  test("computes downloadsRemaining from per-entitlement cap when set", async () => {
    prisma.productFile.findUnique.mockResolvedValue(baseFile)
    prisma.userDownload.findFirst.mockResolvedValue({
      ...baseEntitlement,
      downloadLimit: 5,
      downloadCount: 2,
    })
    const result = await checkFileEntitlement("user_1", "file_1")
    expect(result.allowed).toBe(true)
    expect(result.downloadsRemaining).toBe(3)
  })

  test("computes downloadsRemaining from per-file cap when set (takes precedence)", async () => {
    prisma.productFile.findUnique.mockResolvedValue({
      ...baseFile,
      maxDownloadsPerUser: 4,
    })
    prisma.userDownload.findFirst.mockResolvedValue({
      ...baseEntitlement,
      downloadLimit: 10,
      downloadCount: 1,
    })
    prisma.downloadLog.count.mockResolvedValue(1)
    const result = await checkFileEntitlement("user_1", "file_1")
    expect(result.allowed).toBe(true)
    expect(result.downloadsRemaining).toBe(3)   // 4 cap - 1 consumed
  })
})
