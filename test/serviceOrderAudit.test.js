// ─────────────────────────────────────────────────────────────────────────────
// serviceOrderService.adminUpdateServiceOrder — admin-audit tests (Jest)
//
// Phase 9.7 mirrors the audit pattern from consultationService onto
// service-order admin mutations. This suite locks in:
//
//   1. Audit row written on admin status transitions (new → active →
//      completed → cancelled), with before/after snapshots.
//   2. Audit row written for non-status patches (notes / dates).
//   3. No audit row when ctx.adminUserId is omitted (internal callers).
//   4. Update + audit happen inside the SAME $transaction.
//   5. Allowlist drops keys outside { status, notes, startDate, endDate }.
//   6. NOT_FOUND when the service-order row doesn't exist (no Prisma update).
//
// Pattern matches consultationAudit.test.js — same Prisma mock with
// `__tx` exposed and per-test mockResolvedValueOnce stubs.
// ─────────────────────────────────────────────────────────────────────────────

/* ────────────────────────────── mocks ──────────────────────────────────── */

jest.mock("../src/lib/prisma", () => {
  const tx = {
    serviceOrder:  { update: jest.fn() },
    adminAuditLog: { create: jest.fn() },
  }
  return {
    serviceOrder: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(async (cb) => {
      tx.serviceOrder.update.mockClear()
      tx.adminAuditLog.create.mockClear()
      tx.serviceOrder.update.mockResolvedValue({})
      tx.adminAuditLog.create.mockResolvedValue({})
      return cb(tx)
    }),
    __tx: tx,
  }
})

jest.mock("../src/utils/logger", () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(),
}))

// authService is `require`d inside orderByTier on the guest-checkout path.
// We don't exercise that here, but the module is loaded at require-time so
// we need a stub to keep require() resolution clean.
jest.mock("../src/services/authService", () => ({
  findOrCreateUserForCheckout: jest.fn(),
}))

/* ───────────────────────── system-under-test ───────────────────────────── */

const prisma = require("../src/lib/prisma")
const { adminUpdateServiceOrder } = require("../src/services/serviceOrderService")

/* ─────────────────────────── fixtures ──────────────────────────────────── */

function buildExistingServiceOrder({
  id        = "so_1",
  status    = "new",
  notes     = null,
  startDate = null,
  endDate   = null,
  projectId = null,
} = {}) {
  return {
    id, status, notes, startDate, endDate, projectId,
    orderId:        "order_1",
    orderItemId:    "item_1",
    userId:         "user_1",
    serviceId:      "svc_1",
    servicePackageId: "pkg_1",
    createdAt:      new Date("2026-01-01T00:00:00Z"),
    updatedAt:      new Date("2026-01-01T00:00:00Z"),
  }
}

beforeEach(() => {
  jest.clearAllMocks()
})

/* ─────────────────────────── tests ─────────────────────────────────────── */

describe("adminUpdateServiceOrder — audit log", () => {
  test("writes AdminAuditLog with before/after snapshot on status=active", async () => {
    const before = buildExistingServiceOrder({ status: "new" })
    const after  = buildExistingServiceOrder({ status: "active" })
    prisma.serviceOrder.findUnique.mockResolvedValueOnce(before)
    prisma.__tx.serviceOrder.update.mockResolvedValueOnce(after)

    await adminUpdateServiceOrder("so_1", { status: "active" }, {
      adminUserId: "admin_42",
      ipAddress:   "10.0.0.5",
    })

    expect(prisma.__tx.adminAuditLog.create).toHaveBeenCalledTimes(1)
    const auditData = prisma.__tx.adminAuditLog.create.mock.calls[0][0].data
    expect(auditData).toMatchObject({
      adminUserId: "admin_42",
      action:      "service-order.active",
      targetType:  "ServiceOrder",
      targetId:    "so_1",
      ipAddress:   "10.0.0.5",
    })
    expect(auditData.beforeJson.status).toBe("new")
    expect(auditData.afterJson.status).toBe("active")
  })

  test("action key reflects every status transition (completed / cancelled / on_hold)", async () => {
    for (const status of ["completed", "cancelled", "on_hold"]) {
      jest.clearAllMocks()
      prisma.serviceOrder.findUnique.mockResolvedValueOnce(buildExistingServiceOrder({ status: "active" }))
      prisma.__tx.serviceOrder.update.mockResolvedValueOnce(buildExistingServiceOrder({ status }))

      await adminUpdateServiceOrder("so_1", { status }, { adminUserId: "admin_1" })

      expect(prisma.__tx.adminAuditLog.create.mock.calls[0][0].data.action)
        .toBe(`service-order.${status}`)
    }
  })

  test("non-status patch records action='service-order.updated'", async () => {
    prisma.serviceOrder.findUnique.mockResolvedValueOnce(buildExistingServiceOrder({ status: "active" }))
    prisma.__tx.serviceOrder.update.mockResolvedValueOnce(buildExistingServiceOrder({
      status: "active",
      notes:  "Updated kickoff brief",
    }))

    await adminUpdateServiceOrder("so_1", { notes: "Updated kickoff brief" }, { adminUserId: "admin_1" })

    expect(prisma.__tx.adminAuditLog.create.mock.calls[0][0].data.action).toBe("service-order.updated")
  })

  test("no audit row when ctx.adminUserId is omitted (internal callers)", async () => {
    prisma.serviceOrder.findUnique.mockResolvedValueOnce(buildExistingServiceOrder())
    prisma.__tx.serviceOrder.update.mockResolvedValueOnce(buildExistingServiceOrder({ status: "active" }))

    await adminUpdateServiceOrder("so_1", { status: "active" }, {})

    expect(prisma.__tx.serviceOrder.update).toHaveBeenCalledTimes(1)
    expect(prisma.__tx.adminAuditLog.create).not.toHaveBeenCalled()
  })

  test("update + audit happen in the SAME prisma.$transaction call", async () => {
    prisma.serviceOrder.findUnique.mockResolvedValueOnce(buildExistingServiceOrder())
    prisma.__tx.serviceOrder.update.mockResolvedValueOnce(buildExistingServiceOrder({ status: "completed" }))

    await adminUpdateServiceOrder("so_1", { status: "completed" }, { adminUserId: "admin_1" })

    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(prisma.__tx.serviceOrder.update).toHaveBeenCalled()
    expect(prisma.__tx.adminAuditLog.create).toHaveBeenCalled()
  })
})

describe("adminUpdateServiceOrder — allowlist enforcement", () => {
  test("ignores keys outside { status, notes, startDate, endDate }", async () => {
    prisma.serviceOrder.findUnique.mockResolvedValueOnce(buildExistingServiceOrder())
    prisma.__tx.serviceOrder.update.mockResolvedValueOnce(buildExistingServiceOrder({ status: "active" }))

    await adminUpdateServiceOrder("so_1", {
      status:    "active",
      userId:    "user_HIJACK",      // ← must be ignored
      orderId:   "order_HIJACK",     // ← must be ignored
      projectId: "proj_HIJACK",      // ← must be ignored
    }, { adminUserId: "admin_1" })

    const dataPassedToPrisma = prisma.__tx.serviceOrder.update.mock.calls[0][0].data
    expect(dataPassedToPrisma).toEqual({ status: "active" })  // EXACT shape — no extras
    expect(dataPassedToPrisma).not.toHaveProperty("userId")
    expect(dataPassedToPrisma).not.toHaveProperty("orderId")
    expect(dataPassedToPrisma).not.toHaveProperty("projectId")
  })

  test("startDate/endDate strings are coerced to Date objects", async () => {
    prisma.serviceOrder.findUnique.mockResolvedValueOnce(buildExistingServiceOrder())
    prisma.__tx.serviceOrder.update.mockResolvedValueOnce(buildExistingServiceOrder())

    await adminUpdateServiceOrder("so_1", {
      startDate: "2026-07-01T00:00:00Z",
      endDate:   "2026-07-15T00:00:00Z",
    }, { adminUserId: "admin_1" })

    const data = prisma.__tx.serviceOrder.update.mock.calls[0][0].data
    expect(data.startDate).toBeInstanceOf(Date)
    expect(data.endDate).toBeInstanceOf(Date)
    expect(data.startDate.toISOString()).toBe("2026-07-01T00:00:00.000Z")
  })

  test("empty-string date clears the column to null", async () => {
    prisma.serviceOrder.findUnique.mockResolvedValueOnce(buildExistingServiceOrder({
      startDate: new Date("2026-07-01T00:00:00Z"),
    }))
    prisma.__tx.serviceOrder.update.mockResolvedValueOnce(buildExistingServiceOrder())

    await adminUpdateServiceOrder("so_1", { startDate: "" }, { adminUserId: "admin_1" })

    expect(prisma.__tx.serviceOrder.update.mock.calls[0][0].data.startDate).toBeNull()
  })
})

describe("adminUpdateServiceOrder — error path", () => {
  test("throws NOT_FOUND when the service-order doesn't exist (no DB write)", async () => {
    prisma.serviceOrder.findUnique.mockResolvedValueOnce(null)

    await expect(
      adminUpdateServiceOrder("missing", { status: "active" }, { adminUserId: "admin_1" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" })

    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(prisma.__tx.serviceOrder.update).not.toHaveBeenCalled()
    expect(prisma.__tx.adminAuditLog.create).not.toHaveBeenCalled()
  })
})
