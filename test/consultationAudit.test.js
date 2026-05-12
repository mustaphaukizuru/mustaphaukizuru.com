// ─────────────────────────────────────────────────────────────────────────────
// consultationService.adminUpdateConsultation — admin-audit tests (Jest)
//
// Phase 5 wired AdminAuditLog rows inside the same $transaction as the
// consultation update so we never have one without the other. Phase 9.7
// locks that contract in with unit tests:
//
//   1. Audit row written on admin status transition (confirmed/cancelled/
//      completed) with before/after snapshots.
//   2. Audit row written for plain field updates (no status change).
//   3. No audit row when ctx.adminUserId is omitted (service callers).
//   4. Auto-Jitsi meeting link generated on first-time confirm.
//   5. Manual meetingLink in patch wins over auto-generation.
//   6. Confirmation email fires only on the confirmed transition.
//   7. NOT_FOUND when the consultation doesn't exist.
//
// Mock everything around the function so tests exercise ONLY the orchestrator
// logic (read → audit/update transaction → email side-effect). Same pattern
// as refundService.test.js + the Phase 9.5 webhook tests.
// ─────────────────────────────────────────────────────────────────────────────

/* ────────────────────────────── mocks ──────────────────────────────────── */

jest.mock("../src/lib/prisma", () => {
  const tx = {
    consultation:  { update: jest.fn() },
    adminAuditLog: { create: jest.fn() },
  }
  return {
    consultation: {
      findUnique: jest.fn(),
      // Phase 11 · provisionMeetingAndNotify (the post-transaction Google
      // Meet provisioner) calls prisma.consultation.update DIRECTLY
      // (not through $transaction). Mock at the top level so it doesn't
      // throw TypeError: not a function. Returns a row populated with
      // the user/service/assignedAdmin relations the email helper
      // downstream needs (via the include: PUBLIC_INCLUDE on the real
      // call). Without these, sendConsultationConfirmedEmail short-
      // circuits at `if (!to) return` and the email assertion fails.
      update: jest.fn(({ data }) => Promise.resolve({
        id:          "c_1",
        status:      "confirmed",
        scheduledAt: new Date("2026-06-15T14:00:00Z"),
        durationMin: 30,
        timezone:    "America/Mexico_City",
        ...data,
        userId:       "user_1",
        user:         { id: "user_1", fullName: "Client Test", email: "client@example.com" },
        service:      { id: "svc_1",  title: "Discovery call", slug: "discovery" },
        assignedAdmin:{ id: "admin_1", fullName: "Mustapha Ukizuru", email: "host@example.com" },
      })),
    },
    user: {
      update: jest.fn().mockResolvedValue({}),  // no-op for unrelated callers
    },
    $transaction: jest.fn(async (cb) => {
      tx.consultation.update.mockClear()
      tx.adminAuditLog.create.mockClear()
      tx.consultation.update.mockResolvedValue({})
      tx.adminAuditLog.create.mockResolvedValue({})
      return cb(tx)
    }),
    __tx: tx,
  }
})

// Phase 11 · Google Meet is now the only auto-provisioned provider, so
// these tests need to control whether the booking flow believes Google
// is configured. Default = NOT configured → exercises the "no link
// generated, admin attention" branch. Tests that want to assert on the
// Google-success path override per-call via mockReturnValueOnce(true)
// + createCalendarEvent.mockResolvedValueOnce(...).
jest.mock("../src/lib/googleCalendar", () => ({
  isConfigured:        jest.fn(() => false),
  createCalendarEvent: jest.fn(),
  updateCalendarEvent: jest.fn(),
  cancelCalendarEvent: jest.fn(),
}))

// emailService is dynamically required inside sendConsultationConfirmedEmail
// (`require("./emailService")` at function call time). The jest.mock here
// catches that require and lets us spy on sendTemplateEmail without booting
// the real transport.
jest.mock("../src/services/emailService", () => ({
  sendTemplateEmail: jest.fn().mockResolvedValue({ ok: true }),
}))

jest.mock("../src/utils/resolveUserLocale", () => ({
  resolveUserLocale: jest.fn(() => "en"),
}))

// availabilityService is required at the top of consultationService —
// stub it so we don't drag the booking calendar into these tests.
jest.mock("../src/services/availabilityService", () => ({
  resolveHostUserId:     jest.fn(),
  loadServicePolicy:     jest.fn(),
  getAvailableSlots:     jest.fn(),
  ACTIVE_BOOKING_STATUSES: ["pending", "confirmed", "scheduled"],
}))

jest.mock("../src/utils/logger", () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(),
}))

/* ───────────────────────── system-under-test ───────────────────────────── */

const prisma = require("../src/lib/prisma")
const { sendTemplateEmail } = require("../src/services/emailService")
const { adminUpdateConsultation } = require("../src/services/consultationService")

/* ─────────────────────────── fixtures ──────────────────────────────────── */

function buildExistingConsultation({
  id          = "c_1",
  status      = "pending",
  meetingLink = null,
  meetingProvider = "manual",
  userId      = "user_1",
  assignedAdminId = "admin_1",
  scheduledAt = new Date("2026-06-15T14:00:00Z"),
} = {}) {
  return {
    id, status, meetingLink, meetingProvider, userId, assignedAdminId,
    scheduledAt,
    durationMin: 30,
    timezone:    "America/Mexico_City",
    confirmedAt: null,
    cancelledAt: null,
    completedAt: null,
    service:       { id: "svc_1", title: "Discovery call", slug: "discovery" },
    assignedAdmin: { id: assignedAdminId, fullName: "Mustapha Ukizuru", email: "host@example.com", avatarUrl: null },
    user:          { id: userId, fullName: "Client Test", email: "client@example.com" },
  }
}

function buildUpdatedConsultation(overrides = {}) {
  return { ...buildExistingConsultation(), ...overrides }
}

beforeEach(() => {
  jest.clearAllMocks()
})

/* ─────────────────────────── tests ─────────────────────────────────────── */

describe("adminUpdateConsultation — audit log", () => {
  test("writes AdminAuditLog row with before/after snapshot on status=confirmed", async () => {
    const before = buildExistingConsultation({ status: "pending" })
    // Phase 11 · meetingLink is NO LONGER set inside the transaction.
    // The transaction-side update only flips status/confirmedAt; the
    // meeting link is provisioned AFTER the commit by
    // provisionMeetingAndNotify. The audit row captures the
    // pre-provisioning snapshot, so meetingLink stays null here.
    const after = buildUpdatedConsultation({
      status:      "confirmed",
      confirmedAt: new Date(),
      meetingLink: null,
    })
    prisma.consultation.findUnique.mockResolvedValueOnce(before)
    prisma.__tx.consultation.update.mockResolvedValueOnce(after)

    await adminUpdateConsultation("c_1", { status: "confirmed" }, {
      adminUserId: "admin_99",
      ipAddress:   "10.0.0.1",
    })

    expect(prisma.__tx.adminAuditLog.create).toHaveBeenCalledTimes(1)
    const auditCall = prisma.__tx.adminAuditLog.create.mock.calls[0][0].data
    expect(auditCall).toMatchObject({
      adminUserId: "admin_99",
      action:      "consultation.confirmed",
      targetType:  "Consultation",
      targetId:    "c_1",
      ipAddress:   "10.0.0.1",
    })
    expect(auditCall.beforeJson.status).toBe("pending")
    expect(auditCall.afterJson.status).toBe("confirmed")
  })

  test("action key reflects the new status (cancelled/completed)", async () => {
    prisma.consultation.findUnique.mockResolvedValueOnce(buildExistingConsultation({ status: "confirmed" }))
    prisma.__tx.consultation.update.mockResolvedValueOnce(buildUpdatedConsultation({ status: "cancelled" }))

    await adminUpdateConsultation("c_1", { status: "cancelled" }, { adminUserId: "admin_1" })

    expect(prisma.__tx.adminAuditLog.create.mock.calls[0][0].data.action).toBe("consultation.cancelled")
  })

  test("non-status patch records action='consultation.updated'", async () => {
    prisma.consultation.findUnique.mockResolvedValueOnce(buildExistingConsultation({ status: "confirmed" }))
    prisma.__tx.consultation.update.mockResolvedValueOnce(buildUpdatedConsultation({
      meetingLink: "https://zoom.us/j/123",
    }))

    await adminUpdateConsultation("c_1", { meetingLink: "https://zoom.us/j/123" }, { adminUserId: "admin_1" })

    expect(prisma.__tx.adminAuditLog.create.mock.calls[0][0].data.action).toBe("consultation.updated")
  })

  test("no audit row when ctx.adminUserId is omitted", async () => {
    prisma.consultation.findUnique.mockResolvedValueOnce(buildExistingConsultation())
    prisma.__tx.consultation.update.mockResolvedValueOnce(buildUpdatedConsultation({ status: "confirmed" }))

    await adminUpdateConsultation("c_1", { status: "confirmed" }, {})

    // Update happens, audit does not
    expect(prisma.__tx.consultation.update).toHaveBeenCalledTimes(1)
    expect(prisma.__tx.adminAuditLog.create).not.toHaveBeenCalled()
  })

  test("audit + update are wrapped in the same prisma.$transaction call", async () => {
    prisma.consultation.findUnique.mockResolvedValueOnce(buildExistingConsultation())
    prisma.__tx.consultation.update.mockResolvedValueOnce(buildUpdatedConsultation({ status: "confirmed" }))

    await adminUpdateConsultation("c_1", { status: "confirmed" }, { adminUserId: "admin_1" })

    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    // Inside that single call both writes fired
    expect(prisma.__tx.consultation.update).toHaveBeenCalled()
    expect(prisma.__tx.adminAuditLog.create).toHaveBeenCalled()
  })
})

describe("adminUpdateConsultation — auto Google Meet link on first confirm", () => {
  // Phase 11 polish: the legacy Jitsi auto-generator was removed.
  // When admin confirms a pending booking without supplying a link,
  // the code calls provisionMeetingAndNotify AFTER the transaction
  // commits — which either creates a Google Calendar event with a
  // Meet link, or (when Google isn't configured / fails) leaves
  // meetingLink null for the admin to fill in manually.

  test("creates a Google Meet event when Google is configured", async () => {
    const googleCalendar = require("../src/lib/googleCalendar")
    googleCalendar.isConfigured.mockReturnValueOnce(true)
    googleCalendar.createCalendarEvent.mockResolvedValueOnce({
      eventId:  "gcal_evt_123",
      meetLink: "https://meet.google.com/abc-defg-hij",
      htmlLink: "https://www.google.com/calendar/event?eid=...",
    })

    prisma.consultation.findUnique.mockResolvedValueOnce(buildExistingConsultation({
      status: "pending", meetingLink: null,
    }))
    prisma.__tx.consultation.update.mockResolvedValueOnce(
      buildUpdatedConsultation({ status: "confirmed", meetingLink: null })
    )
    // The post-transaction provisioner writes the Meet link via the
    // top-level prisma.consultation.update mocked at the top of this
    // file (default impl echoes the patch back). Capture the call.

    await adminUpdateConsultation("c_1", { status: "confirmed" }, { adminUserId: "admin_1" })

    expect(googleCalendar.createCalendarEvent).toHaveBeenCalledTimes(1)
    // The provisioner persists the Meet link via prisma.consultation.update
    expect(prisma.consultation.update).toHaveBeenCalled()
    const updateCall = prisma.consultation.update.mock.calls.find(
      (c) => c[0]?.data?.meetingProvider === "google_meet"
    )
    expect(updateCall).toBeDefined()
    expect(updateCall[0].data.meetingLink).toBe("https://meet.google.com/abc-defg-hij")
    expect(updateCall[0].data.googleEventId).toBe("gcal_evt_123")
  })

  test("leaves meetingLink null (for admin attention) when Google is NOT configured", async () => {
    // Default googleCalendar.isConfigured() = false (set at module mock).
    prisma.consultation.findUnique.mockResolvedValueOnce(buildExistingConsultation({
      status: "pending", meetingLink: null,
    }))
    prisma.__tx.consultation.update.mockResolvedValueOnce(
      buildUpdatedConsultation({ status: "confirmed", meetingLink: null })
    )

    await adminUpdateConsultation("c_1", { status: "confirmed" }, { adminUserId: "admin_1" })

    // The "not configured" branch updates the row with meetingLink=null
    // + meetingProvider="manual" so the admin dashboard surfaces it.
    expect(prisma.consultation.update).toHaveBeenCalled()
    const updateCall = prisma.consultation.update.mock.calls.find(
      (c) => c[0]?.data?.meetingLink === null
    )
    expect(updateCall).toBeDefined()
    expect(updateCall[0].data.meetingProvider).toBe("manual")
    expect(updateCall[0].data.googleEventId).toBeNull()
  })

  test("respects an explicit meetingLink in the patch (manual override wins)", async () => {
    prisma.consultation.findUnique.mockResolvedValueOnce(buildExistingConsultation({
      status: "pending", meetingLink: null,
    }))
    prisma.__tx.consultation.update.mockResolvedValueOnce(buildUpdatedConsultation({
      status: "confirmed",
      meetingLink: "https://meet.google.com/abc-defg-hij",
    }))

    await adminUpdateConsultation("c_1", {
      status:      "confirmed",
      meetingLink: "https://meet.google.com/abc-defg-hij",
    }, { adminUserId: "admin_1" })

    // The transaction's data carries the explicit link from the patch.
    const txCall = prisma.__tx.consultation.update.mock.calls[0][0].data
    expect(txCall.meetingLink).toBe("https://meet.google.com/abc-defg-hij")
    // Provisioner is skipped because patch.meetingLink !== undefined.
    const googleCalendar = require("../src/lib/googleCalendar")
    expect(googleCalendar.createCalendarEvent).not.toHaveBeenCalled()
  })

  test("does NOT regenerate a meeting link when one already exists on the booking", async () => {
    prisma.consultation.findUnique.mockResolvedValueOnce(buildExistingConsultation({
      status: "pending", meetingLink: "https://meet.google.com/existing-link",
    }))
    prisma.__tx.consultation.update.mockResolvedValueOnce(buildUpdatedConsultation({ status: "confirmed" }))

    await adminUpdateConsultation("c_1", { status: "confirmed" }, { adminUserId: "admin_1" })

    // before.meetingLink is set → willAutoProvision is false → no Google call
    const googleCalendar = require("../src/lib/googleCalendar")
    expect(googleCalendar.createCalendarEvent).not.toHaveBeenCalled()
    const data = prisma.__tx.consultation.update.mock.calls[0][0].data
    expect(data.meetingLink).toBeUndefined()  // not in `allowed` since patch didn't include it
  })
})

describe("adminUpdateConsultation — confirmation email", () => {
  test("fires sendTemplateEmail when transitioning to confirmed", async () => {
    // Phase 11 · simulate the Google-Meet-configured path so the
    // provisioner produces a real link before the email fires.
    const googleCalendar = require("../src/lib/googleCalendar")
    googleCalendar.isConfigured.mockReturnValueOnce(true)
    googleCalendar.createCalendarEvent.mockResolvedValueOnce({
      eventId:  "gcal_evt_email_test",
      meetLink: "https://meet.google.com/abc-defg-hij",
      htmlLink: null,
    })

    prisma.consultation.findUnique.mockResolvedValueOnce(buildExistingConsultation({ status: "pending" }))
    prisma.__tx.consultation.update.mockResolvedValueOnce(buildUpdatedConsultation({
      status: "confirmed",
      meetingLink: null,  // link added post-transaction by provisioner
    }))

    await adminUpdateConsultation("c_1", { status: "confirmed" }, { adminUserId: "admin_1" })

    // Email is fire-and-forget after the transaction — let any
    // microtask queued by Promise.catch settle before asserting.
    await new Promise((r) => setImmediate(r))

    expect(sendTemplateEmail).toHaveBeenCalledTimes(1)
    const args = sendTemplateEmail.mock.calls[0][0]
    expect(args.templateKey).toBe("consultation.confirmed")
    expect(args.to).toBe("client@example.com")
    expect(args.variables.meetingLink).toBe("https://meet.google.com/abc-defg-hij")
  })

  test("does NOT fire email on a non-status patch", async () => {
    prisma.consultation.findUnique.mockResolvedValueOnce(buildExistingConsultation({ status: "confirmed" }))
    prisma.__tx.consultation.update.mockResolvedValueOnce(buildUpdatedConsultation({
      summaryNotes: "Updated notes",
    }))

    await adminUpdateConsultation("c_1", { summaryNotes: "Updated notes" }, { adminUserId: "admin_1" })
    await new Promise((r) => setImmediate(r))

    expect(sendTemplateEmail).not.toHaveBeenCalled()
  })

  test("does NOT fire email when already in confirmed state (no transition)", async () => {
    prisma.consultation.findUnique.mockResolvedValueOnce(buildExistingConsultation({ status: "confirmed" }))
    prisma.__tx.consultation.update.mockResolvedValueOnce(buildUpdatedConsultation({ status: "confirmed" }))

    await adminUpdateConsultation("c_1", { status: "confirmed" }, { adminUserId: "admin_1" })
    await new Promise((r) => setImmediate(r))

    expect(sendTemplateEmail).not.toHaveBeenCalled()
  })
})

describe("adminUpdateConsultation — error path", () => {
  test("throws NOT_FOUND when the consultation doesn't exist", async () => {
    prisma.consultation.findUnique.mockResolvedValueOnce(null)

    await expect(
      adminUpdateConsultation("missing", { status: "confirmed" }, { adminUserId: "admin_1" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" })

    expect(prisma.__tx.consultation.update).not.toHaveBeenCalled()
    expect(prisma.__tx.adminAuditLog.create).not.toHaveBeenCalled()
  })
})
