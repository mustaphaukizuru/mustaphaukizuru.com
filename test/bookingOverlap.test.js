// ─────────────────────────────────────────────────────────────────────────────
// consultationService — interval overlap guard (Tier 3)
//
// The [assignedAdminId, scheduledAt] unique index only catches two bookings
// that start at the same instant. A 60-min call at 10:00 and a 30-min call
// at 10:30 both pass it. assertNoOverlappingBooking runs inside the booking
// / reschedule transaction and rejects any active consultation for the same
// host whose [scheduledAt, end) intersects the requested window with the
// same 409 SLOT_OVERLAP that classifyBookingWriteError maps a DB exclusion
// violation to.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => {
  const prisma = {
    clientProject: { findFirst: jest.fn(), create: jest.fn() },
    service:       { findUnique: jest.fn() },
    serviceOrder:  { findUnique: jest.fn() },
    consultation:  { create: jest.fn(), update: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
  }
  prisma.$transaction = jest.fn(async (cb) => cb(prisma))
  return prisma
})
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
  resolveHostUserId:      jest.fn().mockResolvedValue("admin_1"),
  loadServicePolicy:      jest.fn().mockResolvedValue({ bookingDurationMin: 60, bookingRequiresPayment: false }),
  loadCancellationPolicy: jest.fn().mockResolvedValue({ bookingRescheduleNoticeHours: 0, bookingCancellationNoticeHours: 0 }),
  getAvailableSlots:      jest.fn().mockResolvedValue([
    { startUtc: "2099-01-01T15:00:00.000Z" },
    { startUtc: "2099-01-01T16:00:00.000Z" },
  ]),
  ACTIVE_BOOKING_STATUSES: ["pending", "confirmed", "scheduled"],
}))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))

const prisma = require("../src/lib/prisma")
const {
  bookConsultation,
  rescheduleConsultation,
  assertNoOverlappingBooking,
} = require("../src/services/consultationService")

const START = new Date("2099-01-01T15:00:00.000Z") // requested 15:00–16:00 (60 min policy)
const END   = new Date("2099-01-01T16:00:00.000Z")

const row = (id, scheduledAt, durationMin, endsAt = null) => ({
  id, scheduledAt: new Date(scheduledAt), durationMin, endsAt: endsAt ? new Date(endsAt) : null,
})

beforeEach(() => {
  jest.clearAllMocks()
  prisma.consultation.findMany.mockResolvedValue([])
  prisma.consultation.create.mockImplementation(async ({ data }) => ({ id: "c_new", ...data }))
  prisma.clientProject.findFirst.mockResolvedValue({ id: "p_1" })
})

describe("assertNoOverlappingBooking", () => {
  test("queries active bookings for the host in the candidate window", async () => {
    await assertNoOverlappingBooking(prisma, { hostId: "admin_1", start: START, end: END })
    expect(prisma.consultation.findMany).toHaveBeenCalledTimes(1)
    const { where } = prisma.consultation.findMany.mock.calls[0][0]
    expect(where.assignedAdminId).toBe("admin_1")
    expect(where.status).toEqual({ in: ["pending", "confirmed", "scheduled"] })
    expect(where.scheduledAt.lt).toEqual(END)
    expect(where.scheduledAt.gt.getTime()).toBeLessThan(START.getTime())
  })

  test.each([
    ["earlier booking that runs into the window (14:30 + 60 min)", row("a", "2099-01-01T14:30:00Z", 60)],
    ["shorter booking starting inside the window (15:30 + 30 min)", row("b", "2099-01-01T15:30:00Z", 30)],
    ["booking that fully contains the window (14:00 + 180 min)",    row("c", "2099-01-01T14:00:00Z", 180)],
    ["exact same slot (15:00 + 60 min)",                            row("d", "2099-01-01T15:00:00Z", 60)],
    ["uses endsAt over durationMin when present",                   row("e", "2099-01-01T14:00:00Z", 30, "2099-01-01T15:15:00Z")],
  ])("rejects %s with 409 SLOT_OVERLAP", async (_label, existing) => {
    prisma.consultation.findMany.mockResolvedValue([existing])
    await expect(assertNoOverlappingBooking(prisma, { hostId: "admin_1", start: START, end: END }))
      .rejects.toMatchObject({ statusCode: 409, code: "SLOT_OVERLAP", conflictId: existing.id })
  })

  test.each([
    ["booking that ends exactly when the window starts (14:00 + 60 min)", row("f", "2099-01-01T14:00:00Z", 60)],
    ["booking that starts exactly when the window ends (16:00 + 30 min)", row("g", "2099-01-01T16:00:00Z", 30)],
    ["endsAt before the window even if durationMin would overlap",        row("h", "2099-01-01T14:30:00Z", 60, "2099-01-01T15:00:00Z")],
  ])("allows %s (touching edges do not overlap)", async (_label, existing) => {
    prisma.consultation.findMany.mockResolvedValue([existing])
    await expect(assertNoOverlappingBooking(prisma, { hostId: "admin_1", start: START, end: END }))
      .resolves.toBeUndefined()
  })

  test("excludes the row being rescheduled", async () => {
    await assertNoOverlappingBooking(prisma, { hostId: "admin_1", start: START, end: END, excludeId: "old" })
    const { where } = prisma.consultation.findMany.mock.calls[0][0]
    expect(where.id).toEqual({ not: "old" })
  })

  test("is a no-op without a host", async () => {
    await assertNoOverlappingBooking(prisma, { hostId: null, start: START, end: END })
    expect(prisma.consultation.findMany).not.toHaveBeenCalled()
  })
})

describe("bookConsultation", () => {
  const args = { userId: "user_1", serviceId: "svc_1", startUtc: START.toISOString(), timezone: "UTC", autoConfirm: false }

  test("runs the guard and the insert inside one transaction and books when clear", async () => {
    const res = await bookConsultation(args)
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(prisma.consultation.findMany).toHaveBeenCalledTimes(1)
    expect(prisma.consultation.create).toHaveBeenCalledTimes(1)
    expect(res.id).toBe("c_new")
    // The guard ran before the insert.
    const guardOrder  = prisma.consultation.findMany.mock.invocationCallOrder[0]
    const insertOrder = prisma.consultation.create.mock.invocationCallOrder[0]
    expect(guardOrder).toBeLessThan(insertOrder)
  })

  test("rejects a 60-min booking that overlaps a 30-min booking starting 30 minutes later", async () => {
    prisma.consultation.findMany.mockResolvedValue([row("x", "2099-01-01T15:30:00Z", 30)])
    await expect(bookConsultation(args)).rejects.toMatchObject({ statusCode: 409, code: "SLOT_OVERLAP" })
    expect(prisma.consultation.create).not.toHaveBeenCalled()
  })

  test("the unique-index race still maps to the 409 SLOT_UNAVAILABLE", async () => {
    prisma.consultation.create.mockRejectedValue(Object.assign(new Error("Unique constraint"), { code: "P2002" }))
    await expect(bookConsultation(args)).rejects.toMatchObject({ statusCode: 409, code: "SLOT_UNAVAILABLE" })
  })
})

describe("rescheduleConsultation", () => {
  const existing = {
    id: "old", userId: "user_1", assignedAdminId: "admin_1", serviceId: "svc_1", serviceOrderId: null,
    status: "confirmed", scheduledAt: new Date("2099-01-01T10:00:00Z"), durationMin: 60, timezone: "UTC",
    clientNotes: null, meetingProvider: null, meetingLink: null, googleEventId: null, revision: 0,
  }

  beforeEach(() => {
    prisma.consultation.findUnique.mockResolvedValue(existing)
    prisma.consultation.update.mockResolvedValue({ ...existing, status: "rescheduled" })
  })

  test("moves the booking when the new window is clear, excluding the retired row", async () => {
    const res = await rescheduleConsultation({ id: "old", userId: "user_1", isAdmin: true, newStartUtc: "2099-01-01T16:00:00Z" })
    expect(res.id).toBe("c_new")
    expect(res.rescheduledFromId).toBe("old")
    const { where } = prisma.consultation.findMany.mock.calls[0][0]
    expect(where.assignedAdminId).toBe("admin_1")
    expect(where.id).toEqual({ not: "old" })
    expect(where.scheduledAt.lt).toEqual(new Date("2099-01-01T17:00:00Z"))
  })

  test("rejects a reschedule into a window another booking overlaps with 409 SLOT_OVERLAP", async () => {
    prisma.consultation.findMany.mockResolvedValue([row("y", "2099-01-01T16:30:00Z", 30)])
    await expect(rescheduleConsultation({ id: "old", userId: "user_1", isAdmin: true, newStartUtc: "2099-01-01T16:00:00Z" }))
      .rejects.toMatchObject({ statusCode: 409, code: "SLOT_OVERLAP" })
    expect(prisma.consultation.create).not.toHaveBeenCalled()
    // Inside the transaction — a real DB rolls the status update back.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
  })
})
