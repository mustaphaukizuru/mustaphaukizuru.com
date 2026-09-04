/**
 * Integration · consultation booking over HTTP.
 *
 * Two members race for the same host + slot: the fake prisma enforces the
 * [assignedAdminId, scheduledAt] unique on consultation.create, so the loser
 * gets P2002 which consultationService maps to 409 SLOT_UNAVAILABLE.
 */
const request = require("supertest")
const { buildApp } = require("../helpers/appFactory")

let ctx
beforeAll(() => { ctx = buildApp() })

const SLOT = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
SLOT.setUTCMinutes(0, 0, 0)
const TZ = "America/Mexico_City"

function primeAvailability() {
  ctx.mocks.availabilityService.getAvailableSlots.mockResolvedValue([{ startUtc: SLOT.toISOString(), endUtc: new Date(SLOT.getTime() + 30 * 60_000).toISOString() }])
  ctx.mocks.availabilityService.resolveHostUserId.mockResolvedValue(ctx.host.id)
  ctx.mocks.availabilityService.loadServicePolicy.mockResolvedValue({ bookingDurationMin: 30, bookingRequiresPayment: false })
}

beforeAll(() => {
  ctx.host    = ctx.seedUser({ fullName: "Host Admin", email: "host@example.com", role: "admin" })
  ctx.service = ctx.prisma.seed("service", { title: "Discovery Call", slug: "discovery", isActive: true })
  primeAvailability()
})

describe("POST /api/v1/consultations", () => {
  test("unauthenticated without customerEmail → 400 VALIDATION_ERROR (guest booking needs name + email)", async () => {
    const res = await request(ctx.app).post("/api/v1/consultations").send({ startUtc: SLOT.toISOString(), timezone: TZ })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe("VALIDATION_ERROR")
    expect(ctx.prisma.rows("consultation")).toHaveLength(0)
  })

  test("guest with a new email → 201, passwordless account + claim email", async () => {
    // Distinct slot so the host+slot unique index is untouched for the race test below
    const guestSlot = new Date(SLOT.getTime() + 2 * 60 * 60_000)
    ctx.mocks.availabilityService.getAvailableSlots.mockResolvedValueOnce([{ startUtc: guestSlot.toISOString() }])
    const res = await request(ctx.app)
      .post("/api/v1/consultations")
      .send({ serviceId: ctx.service.id, startUtc: guestSlot.toISOString(), timezone: TZ, customerName: "Guest Gal", customerEmail: "guest@example.com" })
    expect(res.status).toBe(201)
    expect(res.body.data.isNewUser).toBe(true)
    const guest = ctx.prisma.rows("user").find((u) => u.email === "guest@example.com")
    expect(guest).toMatchObject({ authProvider: "checkout", passwordHash: null })
    expect(res.body.data.userId).toBe(guest.id)
    await new Promise((r) => setImmediate(r))
    expect(ctx.mocks.emailService.sendTemplateEmail).toHaveBeenCalledWith(expect.objectContaining({ templateKey: "auth.account-claim", to: "guest@example.com" }))
    expect(ctx.mocks.mailer.sendConsultationConfirmationEmail).toHaveBeenCalledTimes(1)
    ctx.mocks.mailer.sendConsultationConfirmationEmail.mockClear()
  })

  test("guest using the email of a password account → 401 ACCOUNT_EXISTS, no booking", async () => {
    const owner = ctx.seedUser({ fullName: "Owner", email: "owner@example.com" })
    const res = await request(ctx.app)
      .post("/api/v1/consultations")
      .send({ serviceId: ctx.service.id, startUtc: SLOT.toISOString(), timezone: TZ, customerName: "Owner", customerEmail: owner.email })
    expect(res.status).toBe(401)
    expect(res.body.code).toBe("ACCOUNT_EXISTS")
    expect(ctx.prisma.rows("consultation").some((c) => c.userId === owner.id)).toBe(false)
  })

  test("missing startUtc/timezone → 400", async () => {
    const m = ctx.seedUser()
    const res = await request(ctx.app).post("/api/v1/consultations").set("Authorization", `Bearer ${ctx.signToken(m.id)}`).send({ timezone: TZ })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe("BAD_REQUEST")
  })

  test("slot no longer in the published availability → 409 SLOT_UNAVAILABLE", async () => {
    const m = ctx.seedUser()
    ctx.mocks.availabilityService.getAvailableSlots.mockResolvedValueOnce([])
    const res = await request(ctx.app)
      .post("/api/v1/consultations")
      .set("Authorization", `Bearer ${ctx.signToken(m.id)}`)
      .send({ serviceId: ctx.service.id, startUtc: SLOT.toISOString(), timezone: TZ })
    expect(res.status).toBe(409)
    expect(res.body.code).toBe("SLOT_UNAVAILABLE")
    expect(ctx.prisma.rows("consultation").some((c) => c.userId === m.id)).toBe(false)
  })

  test("two members racing for the same host+slot → one 201, one 409 SLOT_UNAVAILABLE", async () => {
    const alice = ctx.seedUser({ fullName: "Alice", email: "alice@example.com" })
    const bob   = ctx.seedUser({ fullName: "Bob",   email: "bob@example.com" })

    const book = (user) => request(ctx.app)
      .post("/api/v1/consultations")
      .set("Authorization", `Bearer ${ctx.signToken(user.id)}`)
      .send({ serviceId: ctx.service.id, startUtc: SLOT.toISOString(), timezone: TZ, clientNotes: `from ${user.fullName}` })

    const [a, b] = await Promise.all([book(alice), book(bob)])
    const statuses = [a.status, b.status].sort()
    expect(statuses).toEqual([201, 409])

    const winner = a.status === 201 ? a : b
    const loser  = a.status === 201 ? b : a
    expect(loser.body.code).toBe("SLOT_UNAVAILABLE")
    expect(loser.body.message).toMatch(/just taken/i)

    expect(winner.body.data).toMatchObject({
      status: "confirmed", assignedAdminId: ctx.host.id, serviceId: ctx.service.id, timezone: TZ,
      durationMin: 30, meetingProvider: "manual", meetingLink: null,
    })
    expect(new Date(winner.body.data.scheduledAt).getTime()).toBe(SLOT.getTime())
    expect(winner.body.data.assignedAdmin).toMatchObject({ id: ctx.host.id, email: "host@example.com" })

    const rows = ctx.prisma.rows("consultation").filter((c) => c.scheduledAt.getTime() === SLOT.getTime())
    expect(rows).toHaveLength(1)
    expect(rows[0].confirmationToken).toBeTruthy()
    // project shell opened for the winner
    expect(ctx.prisma.rows("clientProject")).toContainEqual(expect.objectContaining({ consultationId: rows[0].id, userId: winner.body.data.userId, projectName: "Discovery Call" }))
    await new Promise((r) => setImmediate(r))
    expect(ctx.mocks.mailer.sendConsultationConfirmationEmail).toHaveBeenCalledTimes(1)
  })

  test("same member, different slot → 201 and a Google Meet link when Calendar is configured", async () => {
    const carol = ctx.seedUser({ fullName: "Carol", email: "carol@example.com" })
    const later = new Date(SLOT.getTime() + 60 * 60_000)
    ctx.mocks.availabilityService.getAvailableSlots.mockResolvedValueOnce([{ startUtc: later.toISOString() }])
    ctx.mocks.googleCalendar.isConfigured.mockReturnValueOnce(true)
    ctx.mocks.googleCalendar.createCalendarEvent.mockResolvedValueOnce({ meetLink: "https://meet.google.com/abc-defg-hij", eventId: "evt-1" })

    const res = await request(ctx.app)
      .post("/api/v1/consultations")
      .set("Authorization", `Bearer ${ctx.signToken(carol.id)}`)
      .send({ serviceId: ctx.service.id, startUtc: later.toISOString(), timezone: TZ })

    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({ meetingProvider: "google_meet", meetingLink: "https://meet.google.com/abc-defg-hij", googleEventId: "evt-1" })
    expect(ctx.mocks.googleCalendar.createCalendarEvent).toHaveBeenCalledWith(expect.objectContaining({ attendeeEmail: "carol@example.com", timezone: TZ }))
  })

  test("booking in the past → 400 PAST_SLOT", async () => {
    const m = ctx.seedUser()
    const res = await request(ctx.app)
      .post("/api/v1/consultations")
      .set("Authorization", `Bearer ${ctx.signToken(m.id)}`)
      .send({ startUtc: new Date(Date.now() - 60_000).toISOString(), timezone: TZ })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe("PAST_SLOT")
  })

  test("paid-booking gate: bookingRequiresPayment without serviceOrderId → 402", async () => {
    const m = ctx.seedUser()
    ctx.mocks.availabilityService.loadServicePolicy.mockResolvedValueOnce({ bookingDurationMin: 30, bookingRequiresPayment: true })
    const res = await request(ctx.app)
      .post("/api/v1/consultations")
      .set("Authorization", `Bearer ${ctx.signToken(m.id)}`)
      .send({ serviceId: ctx.service.id, startUtc: SLOT.toISOString(), timezone: TZ })
    expect(res.status).toBe(402)
    expect(res.body.code).toBe("PAYMENT_REQUIRED")
  })

  test("GET /api/v1/consultations lists only the caller's bookings", async () => {
    const carol = ctx.prisma.rows("user").find((u) => u.email === "carol@example.com")
    const res = await request(ctx.app).get("/api/v1/consultations").set("Authorization", `Bearer ${ctx.signToken(carol.id)}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].userId).toBe(carol.id)
  })
})
