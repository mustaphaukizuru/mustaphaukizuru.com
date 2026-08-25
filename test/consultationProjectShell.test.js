// ─────────────────────────────────────────────────────────────────────────────
// consultationService.ensureProjectShellForConsultation — roadmap step 25
//
// After a booking succeeds, a ClientProject shell is opened (best-effort) so
// the client relationship starts in the dashboard. The Prisma schema makes
// ClientProject.serviceOrderId required + unique, so:
//   1. userId + serviceId + serviceOrderId, no project yet → create shell
//      { projectName from service, projectStatus: "planning" }.
//   2. project already exists for that order → no duplicate.
//   3. no serviceOrderId (free discovery call) → shell linked by consultationId.
//   4. prisma failure → swallowed (returns null), never throws.
//   5. bookConsultation wires the helper after create.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({
  clientProject: { findFirst: jest.fn(), create: jest.fn() },
  service:       { findUnique: jest.fn() },
  serviceOrder:  { findUnique: jest.fn() },
  consultation:  { create: jest.fn(), update: jest.fn() },
}))

jest.mock("../src/lib/googleCalendar", () => ({
  isConfigured: jest.fn(() => false),
  createCalendarEvent: jest.fn(), updateCalendarEvent: jest.fn(), cancelCalendarEvent: jest.fn(),
}))
jest.mock("../src/utils/mailer", () => ({
  sendConsultationConfirmationEmail: jest.fn().mockResolvedValue(undefined),
  sendConsultationRescheduledEmail:  jest.fn().mockResolvedValue(undefined),
  sendConsultationCancelledEmail:    jest.fn().mockResolvedValue(undefined),
  sendConsultationReminderEmail:     jest.fn().mockResolvedValue(undefined),
}))
jest.mock("../src/utils/resolveUserLocale", () => ({ resolveUserLocale: jest.fn(() => "en") }))
jest.mock("../src/services/availabilityService", () => ({
  resolveHostUserId: jest.fn().mockResolvedValue("admin_1"),
  loadServicePolicy: jest.fn().mockResolvedValue({ bookingDurationMin: 30, bookingRequiresPayment: false }),
  getAvailableSlots: jest.fn().mockResolvedValue([{ startUtc: "2099-01-01T15:00:00.000Z" }]),
  ACTIVE_BOOKING_STATUSES: ["pending", "confirmed", "scheduled"],
}))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))

const prisma = require("../src/lib/prisma")
const logger = require("../src/utils/logger")
const {
  ensureProjectShellForConsultation,
  bookConsultation,
} = require("../src/services/consultationService")

const base = {
  id: "c_1",
  userId: "user_1",
  serviceId: "svc_1",
  serviceOrderId: "so_1",
  service: { id: "svc_1", title: "IT Strategy Consulting", slug: "it-strategy-consulting" },
}

beforeEach(() => jest.clearAllMocks())

describe("ensureProjectShellForConsultation", () => {
  test("creates a planning ClientProject shell when none exists for the order", async () => {
    prisma.clientProject.findFirst.mockResolvedValue(null)
    prisma.clientProject.create.mockResolvedValue({ id: "cp_1" })

    const out = await ensureProjectShellForConsultation(base)

    expect(out).toEqual({ id: "cp_1" })
    expect(prisma.clientProject.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { OR: [{ serviceOrderId: "so_1" }, { consultationId: "c_1" }] } }),
    )
    expect(prisma.clientProject.create).toHaveBeenCalledTimes(1)
    const { data } = prisma.clientProject.create.mock.calls[0][0]
    expect(data).toMatchObject({
      serviceOrderId: "so_1",
      userId: "user_1",
      projectName: "IT Strategy Consulting",
      projectStatus: "planning",
    })
    expect(data.description).toContain("c_1")
  })

  test("falls back to a Service lookup for the title when the relation is missing", async () => {
    prisma.clientProject.findFirst.mockResolvedValue(null)
    prisma.service.findUnique.mockResolvedValue({ title: "AI Integration & Workflow Automation" })
    prisma.clientProject.create.mockResolvedValue({ id: "cp_2" })

    await ensureProjectShellForConsultation({ ...base, service: undefined })

    expect(prisma.service.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "svc_1" } }),
    )
    expect(prisma.clientProject.create.mock.calls[0][0].data.projectName)
      .toBe("AI Integration & Workflow Automation")
  })

  test("does not duplicate when a project already exists for the order", async () => {
    prisma.clientProject.findFirst.mockResolvedValue({ id: "cp_existing" })

    const out = await ensureProjectShellForConsultation(base)

    expect(out).toEqual({ id: "cp_existing" })
    expect(prisma.clientProject.create).not.toHaveBeenCalled()
  })

  test("free discovery calls (no serviceOrderId) open a shell linked by consultationId", async () => {
    prisma.clientProject.findFirst.mockResolvedValue(null)
    prisma.clientProject.create.mockResolvedValue({ id: "cp_free" })

    const out = await ensureProjectShellForConsultation({ ...base, serviceOrderId: null })

    expect(out).toEqual({ id: "cp_free" })
    expect(prisma.clientProject.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { OR: [{ consultationId: "c_1" }] } }),
    )
    const { data } = prisma.clientProject.create.mock.calls[0][0]
    expect(data).toMatchObject({ serviceOrderId: null, consultationId: "c_1", userId: "user_1", projectStatus: "planning" })
  })

  test("skips when userId or serviceId is missing", async () => {
    expect(await ensureProjectShellForConsultation({ ...base, serviceId: null })).toBeNull()
    expect(await ensureProjectShellForConsultation({ ...base, userId: null })).toBeNull()
    expect(prisma.clientProject.create).not.toHaveBeenCalled()
  })

  test("never throws when prisma fails", async () => {
    prisma.clientProject.findFirst.mockRejectedValue(new Error("db down"))

    await expect(ensureProjectShellForConsultation(base)).resolves.toBeNull()
    expect(logger.warn).toHaveBeenCalled()
  })
})

describe("bookConsultation → project shell wiring", () => {
  test("opens the shell after the consultation row is created (paid order path)", async () => {
    prisma.serviceOrder.findUnique.mockResolvedValue({ id: "so_1", userId: "user_1", serviceId: "svc_1" })
    prisma.consultation.create.mockResolvedValue({ ...base, status: "pending" })
    prisma.clientProject.findFirst.mockResolvedValue(null)
    prisma.clientProject.create.mockResolvedValue({ id: "cp_1" })

    const row = await bookConsultation({
      userId: "user_1",
      serviceId: "svc_1",
      serviceOrderId: "so_1",
      startUtc: "2099-01-01T15:00:00.000Z",
      timezone: "America/Mexico_City",
      autoConfirm: false,
    })

    expect(row.id).toBe("c_1")
    expect(prisma.clientProject.create).toHaveBeenCalledTimes(1)
    expect(prisma.clientProject.create.mock.calls[0][0].data.projectStatus).toBe("planning")
  })

  test("free discovery call books fine and opens a project shell", async () => {
    prisma.consultation.create.mockResolvedValue({ ...base, serviceOrderId: null, status: "pending" })
    prisma.clientProject.findFirst.mockResolvedValue(null)
    prisma.clientProject.create.mockResolvedValue({ id: "cp_free" })

    const row = await bookConsultation({
      userId: "user_1",
      serviceId: "svc_1",
      startUtc: "2099-01-01T15:00:00.000Z",
      timezone: "America/Mexico_City",
      autoConfirm: false,
    })

    expect(row.id).toBe("c_1")
    expect(prisma.clientProject.create).toHaveBeenCalledTimes(1)
    expect(prisma.clientProject.create.mock.calls[0][0].data.consultationId).toBe("c_1")
  })
})
