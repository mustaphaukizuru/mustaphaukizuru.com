// ─────────────────────────────────────────────────────────────────────────────
// availabilityService — unit tests
//
// Covers the booking core: slot expansion, timezone/DST math, exception
// handling (block vs custom), busy-slot collision, lead-time / horizon policy,
// host resolution + caching, service policy loading and the admin CRUD guards.
//
// All Prisma access is mocked. Time is frozen with fake timers so every
// assertion is deterministic.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({
  service:               { findUnique: jest.fn() },
  user:                  { findFirst:  jest.fn() },
  availabilityRule:      { findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  availabilityException: { findMany: jest.fn(), create: jest.fn(), delete: jest.fn() },
  consultation:          { findMany: jest.fn() },
}))

const prisma = require("../src/lib/prisma")
const { utcToZonedTime, format: tzFormat } = require("date-fns-tz")

const svc = require("../src/services/availabilityService")
const {
  parseHHmm,
  localDateTimeToUtc,
  expandRuleForDate,
  computeSlotsForDate,
  resolveHostUserId,
  loadServicePolicy,
  loadCancellationPolicy,
  getAvailableSlots,
  getAvailableDaysInMonth,
  createRule,
  updateRule,
  createException,
  listRules,
  listExceptions,
  deleteRule,
  deleteException,
  ACTIVE_BOOKING_STATUSES,
} = svc

const MX = "America/Mexico_City"
const TOKYO = "Asia/Tokyo"

// A Thursday, 10:00 UTC. 2026 → Mexico City is a fixed UTC-6 (DST abolished 2022).
const NOW = new Date("2026-03-05T10:00:00.000Z")

const localHHmm = (d, tz = MX) => tzFormat(utcToZonedTime(d, tz), "HH:mm", { timeZone: tz })
const isoTimes  = (slots) => slots.map((s) => s.startUtc.toISOString())

function rule(over = {}) {
  return {
    id: "rule_1",
    hostUserId: "host_1",
    serviceId: null,
    dayOfWeek: 1,            // Monday
    startTime: "09:00",
    endTime:   "12:00",
    timezone:  MX,
    slotDurationMin: 60,
    bufferMin: 0,
    isActive: true,
    ...over,
  }
}

function baseArgs(over = {}) {
  return {
    dateLocal: "2026-03-09",   // a Monday
    displayTimezone: MX,
    rules: [rule()],
    exceptions: [],
    busyIntervals: [],
    policy: { slotDurationMin: 60, bufferMin: 0, minNoticeHours: 0, maxAdvanceDays: 365 },
    now: NOW,
    ...over,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] }).setSystemTime(NOW)
  delete process.env.DEFAULT_HOST_USER_ID
})

afterEach(() => { jest.useRealTimers() })

/* ───────────────────────────── parseHHmm ────────────────────────────────── */

describe("parseHHmm", () => {
  it("parses zero-padded and single-digit hours", () => {
    expect(parseHHmm("09:30")).toEqual({ h: 9, m: 30 })
    expect(parseHHmm("9:05")).toEqual({ h: 9, m: 5 })
    expect(parseHHmm("00:00")).toEqual({ h: 0, m: 0 })
    expect(parseHHmm("23:59")).toEqual({ h: 23, m: 59 })
  })

  it.each([["24:00"], ["12:60"]])("rejects out-of-range %s", (v) => {
    expect(() => parseHHmm(v)).toThrow(/Time out of range/)
  })

  it.each([[null], [undefined], [930], [{}]])("rejects non-string %p", (v) => {
    expect(() => parseHHmm(v)).toThrow(/Invalid time string/)
  })

  it("rejects malformed strings", () => {
    expect(() => parseHHmm("9:5")).toThrow(/Invalid time string/)
    expect(() => parseHHmm("0930")).toThrow(/Invalid time string/)
    expect(() => parseHHmm("-1:00")).toThrow(/Invalid time string/)
  })
})

/* ─────────────────────── timezone conversion ────────────────────────────── */

describe("localDateTimeToUtc", () => {
  it("uses the CST (UTC-6) offset Mexico City observes year-round since 2022", () => {
    expect(localDateTimeToUtc("2026-01-15", "09:00", MX).toISOString()).toBe("2026-01-15T15:00:00.000Z")
    expect(localDateTimeToUtc("2026-07-15", "09:00", MX).toISOString()).toBe("2026-07-15T15:00:00.000Z")
  })

  it("honours DST for dates when Mexico City still observed it (pre-2022)", () => {
    // 2022-04-03 was the last spring-forward Mexico City ever had: CST → CDT.
    expect(localDateTimeToUtc("2022-04-02", "12:00", MX).toISOString()).toBe("2022-04-02T18:00:00.000Z")
    expect(localDateTimeToUtc("2022-04-04", "12:00", MX).toISOString()).toBe("2022-04-04T17:00:00.000Z")
  })

  it("converts international client timezones", () => {
    expect(localDateTimeToUtc("2026-03-09", "09:00", TOKYO).toISOString()).toBe("2026-03-09T00:00:00.000Z")
  })
})

/* ────────────────────────── expandRuleForDate ───────────────────────────── */

describe("expandRuleForDate", () => {
  it("emits back-to-back slots when bufferMin is 0", () => {
    const slots = expandRuleForDate(rule({ slotDurationMin: 60 }), "2026-03-09")
    expect(isoTimes(slots)).toEqual([
      "2026-03-09T15:00:00.000Z",
      "2026-03-09T16:00:00.000Z",
      "2026-03-09T17:00:00.000Z",
    ])
    expect(slots[0].endUtc.toISOString()).toBe("2026-03-09T16:00:00.000Z")
  })

  it("strides by duration + buffer", () => {
    const slots = expandRuleForDate(
      rule({ startTime: "09:00", endTime: "11:00", slotDurationMin: 30, bufferMin: 15 }),
      "2026-03-09",
    )
    // stride 45min: 09:00, 09:45, 10:30 (11:15 would end past 11:00)
    expect(slots.map((s) => localHHmm(s.startUtc))).toEqual(["09:00", "09:45", "10:30"])
  })

  it("never emits a slot that would run past the window end", () => {
    const slots = expandRuleForDate(
      rule({ startTime: "09:00", endTime: "10:20", slotDurationMin: 30, bufferMin: 0 }),
      "2026-03-09",
    )
    expect(slots).toHaveLength(2)
    expect(localHHmm(slots.at(-1).endUtc)).toBe("10:00")
  })

  it("emits a slot that ends exactly on the window boundary", () => {
    const slots = expandRuleForDate(
      rule({ startTime: "09:00", endTime: "10:00", slotDurationMin: 60 }),
      "2026-03-09",
    )
    expect(slots).toHaveLength(1)
  })

  it("returns [] for a zero-length or inverted window", () => {
    expect(expandRuleForDate(rule({ startTime: "12:00", endTime: "12:00" }), "2026-03-09")).toEqual([])
    expect(expandRuleForDate(rule({ startTime: "17:00", endTime: "09:00" }), "2026-03-09")).toEqual([])
  })

  it("expands in the RULE's timezone, not the caller's", () => {
    const slots = expandRuleForDate(rule({ timezone: TOKYO, startTime: "09:00", endTime: "10:00" }), "2026-03-09")
    expect(slots[0].startUtc.toISOString()).toBe("2026-03-09T00:00:00.000Z")
  })
})

/* ─────────────────────────── DST boundaries ─────────────────────────────── */

describe("DST boundaries in America/Mexico_City", () => {
  const dstRule = { startTime: "00:00", endTime: "06:00", timezone: MX, slotDurationMin: 60, bufferMin: 0 }

  it("spring-forward (2022-04-03) skips the non-existent 02:00 hour", () => {
    const slots = expandRuleForDate(dstRule, "2022-04-03")
    // A 6h wall-clock window loses an hour → only 5 slots, and 02:00 never appears.
    expect(slots).toHaveLength(5)
    expect(slots.map((s) => localHHmm(s.startUtc))).toEqual(["00:00", "01:00", "03:00", "04:00", "05:00"])
  })

  it("a normal (non-DST) day yields exactly window/stride slots", () => {
    expect(expandRuleForDate(dstRule, "2022-10-28")).toHaveLength(6)
  })

  it("fall-back (2022-10-30) yields 7 real hours for a 6h wall-clock window", () => {
    const slots = expandRuleForDate(dstRule, "2022-10-30")
    expect(slots).toHaveLength(7)
    // Consecutive instants, 1h apart in UTC.
    expect(isoTimes(slots).slice(0, 3)).toEqual([
      "2022-10-30T05:00:00.000Z",
      "2022-10-30T06:00:00.000Z",
      "2022-10-30T07:00:00.000Z",
    ])
  })

  // ── BUG (recorded, not fixed) ────────────────────────────────────────────
  // src/services/availabilityService.js:86-99 (expandRuleForDate)
  // On a fall-back day the repeated wall-clock hour produces TWO slots whose
  // local start label is identical ("01:00"). getAvailableSlots surfaces
  // `startLocal` to the UI, so the booking calendar renders the same time
  // twice and the client cannot tell which instant they are picking.
  test.failing("fall-back day must not produce two slots with the same local start label", () => {
    const slots = expandRuleForDate(dstRule, "2022-10-30")
    const labels = slots.map((s) => localHHmm(s.startUtc))
    expect(new Set(labels).size).toBe(labels.length)
  })
})

/* ────────────────────────── computeSlotsForDate ─────────────────────────── */

describe("computeSlotsForDate", () => {
  it("only expands rules whose dayOfWeek matches the requested local date", () => {
    // 2026-03-09 is a Monday (dayOfWeek 1).
    expect(computeSlotsForDate(baseArgs({ rules: [rule({ dayOfWeek: 1 })] }))).toHaveLength(3)
    expect(computeSlotsForDate(baseArgs({ rules: [rule({ dayOfWeek: 2 })] }))).toHaveLength(0)
  })

  it("maps Sunday to dayOfWeek 0 (JS convention, not ISO 7)", () => {
    const slots = computeSlotsForDate(baseArgs({
      dateLocal: "2026-03-08",           // Sunday
      rules: [rule({ dayOfWeek: 0 })],
    }))
    expect(slots).toHaveLength(3)
  })

  it("ignores inactive rules", () => {
    expect(computeSlotsForDate(baseArgs({ rules: [rule({ isActive: false })] }))).toEqual([])
  })

  it("falls back to policy duration/buffer when the rule omits them", () => {
    const slots = computeSlotsForDate(baseArgs({
      rules: [rule({ slotDurationMin: null, bufferMin: null })],
      policy: { slotDurationMin: 30, bufferMin: 30, minNoticeHours: 0, maxAdvanceDays: 365 },
    }))
    // rule.bufferMin === null is nullish → policy.bufferMin (30) wins → stride 60.
    expect(slots).toHaveLength(3)
  })

  it("dedupes identical start times produced by overlapping rules", () => {
    const slots = computeSlotsForDate(baseArgs({
      rules: [rule({ id: "a" }), rule({ id: "b" })],
    }))
    expect(slots).toHaveLength(3)
  })

  it("returns slots sorted by start time", () => {
    const slots = computeSlotsForDate(baseArgs({
      rules: [
        rule({ id: "pm", startTime: "14:00", endTime: "16:00" }),
        rule({ id: "am", startTime: "09:00", endTime: "11:00" }),
      ],
    }))
    const times = slots.map((s) => s.startUtc.getTime())
    expect(times).toEqual([...times].sort((a, b) => a - b))
    expect(localHHmm(slots[0].startUtc)).toBe("09:00")
  })

  /* ── exceptions ────────────────────────────────────────────────────────── */

  it("a BLOCK exception with a window removes only the overlapping slots", () => {
    const slots = computeSlotsForDate(baseArgs({
      exceptions: [{
        id: "ex1", type: "block", timezone: MX,
        date: localDateTimeToUtc("2026-03-09", "00:00", MX),
        startTime: "10:00", endTime: "11:00",
      }],
    }))
    expect(slots.map((s) => localHHmm(s.startUtc))).toEqual(["09:00", "11:00"])
  })

  it("a BLOCK exception with no times blocks the whole local day", () => {
    const slots = computeSlotsForDate(baseArgs({
      exceptions: [{
        id: "ex1", type: "block", timezone: MX,
        date: localDateTimeToUtc("2026-03-09", "00:00", MX),
        startTime: null, endTime: null,
      }],
    }))
    expect(slots).toEqual([])
  })

  it("ignores exceptions whose local date is not the requested date", () => {
    const slots = computeSlotsForDate(baseArgs({
      exceptions: [{
        id: "ex1", type: "block", timezone: MX,
        date: localDateTimeToUtc("2026-03-10", "00:00", MX),   // next day
        startTime: null, endTime: null,
      }],
    }))
    expect(slots).toHaveLength(3)
  })

  it("a CUSTOM exception adds a window outside the recurring rules", () => {
    const slots = computeSlotsForDate(baseArgs({
      rules: [],
      exceptions: [{
        id: "ex1", type: "custom", timezone: MX,
        date: localDateTimeToUtc("2026-03-09", "00:00", MX),
        startTime: "18:00", endTime: "20:00",
      }],
    }))
    expect(slots.map((s) => localHHmm(s.startUtc))).toEqual(["18:00", "19:00"])
  })

  it("a CUSTOM exception on a day with no matching rule still opens slots", () => {
    const slots = computeSlotsForDate(baseArgs({
      dateLocal: "2026-03-14",   // Saturday — rule is Monday-only
      exceptions: [{
        id: "ex1", type: "custom", timezone: MX,
        date: localDateTimeToUtc("2026-03-14", "00:00", MX),
        startTime: "10:00", endTime: "11:00",
      }],
    }))
    expect(slots).toHaveLength(1)
  })

  it("a CUSTOM exception missing startTime/endTime contributes nothing", () => {
    const slots = computeSlotsForDate(baseArgs({
      rules: [],
      exceptions: [{
        id: "ex1", type: "custom", timezone: MX,
        date: localDateTimeToUtc("2026-03-09", "00:00", MX),
        startTime: null, endTime: null,
      }],
    }))
    expect(slots).toEqual([])
  })

  it("a BLOCK exception also removes CUSTOM-exception slots", () => {
    const day = localDateTimeToUtc("2026-03-09", "00:00", MX)
    const slots = computeSlotsForDate(baseArgs({
      rules: [],
      exceptions: [
        { id: "c", type: "custom", timezone: MX, date: day, startTime: "18:00", endTime: "20:00" },
        { id: "b", type: "block",  timezone: MX, date: day, startTime: "18:00", endTime: "19:00" },
      ],
    }))
    expect(slots.map((s) => localHHmm(s.startUtc))).toEqual(["19:00"])
  })

  /* ── collision with existing consultations ─────────────────────────────── */

  it("removes slots that overlap a booked consultation", () => {
    const slots = computeSlotsForDate(baseArgs({
      busyIntervals: [{
        startUtc: new Date("2026-03-09T16:30:00.000Z"),   // 10:30 local
        endUtc:   new Date("2026-03-09T17:00:00.000Z"),
      }],
    }))
    // The 10:00–11:00 slot overlaps; 09:00 and 11:00 survive.
    expect(slots.map((s) => localHHmm(s.startUtc))).toEqual(["09:00", "11:00"])
  })

  it("keeps a slot that merely abuts a booking (slot end === busy start)", () => {
    const slots = computeSlotsForDate(baseArgs({
      busyIntervals: [{
        startUtc: new Date("2026-03-09T16:00:00.000Z"),   // exactly when slot 1 ends
        endUtc:   new Date("2026-03-09T16:30:00.000Z"),
      }],
    }))
    expect(slots.map((s) => localHHmm(s.startUtc))).toEqual(["09:00", "11:00"])
  })

  it("a booking that spans the whole window clears the day", () => {
    const slots = computeSlotsForDate(baseArgs({
      busyIntervals: [{
        startUtc: new Date("2026-03-09T14:00:00.000Z"),
        endUtc:   new Date("2026-03-09T20:00:00.000Z"),
      }],
    }))
    expect(slots).toEqual([])
  })

  /* ── lead time / horizon ───────────────────────────────────────────────── */

  it("drops slots inside the minimum-notice window", () => {
    const relaxed = computeSlotsForDate(baseArgs({
      dateLocal: "2026-03-05",                       // today (Thursday), now = 10:00Z
      rules: [rule({ dayOfWeek: 4, startTime: "09:00", endTime: "18:00" })],
      policy: { slotDurationMin: 60, bufferMin: 0, minNoticeHours: 4, maxAdvanceDays: 365 },
    }))
    // Local window 09:00–18:00 = 15:00Z–00:00Z; now+4h = 14:00Z → nothing dropped.
    expect(relaxed[0].startUtc.toISOString()).toBe("2026-03-05T15:00:00.000Z")

    const stricter = computeSlotsForDate(baseArgs({
      dateLocal: "2026-03-05",
      rules: [rule({ dayOfWeek: 4, startTime: "09:00", endTime: "18:00" })],
      policy: { slotDurationMin: 60, bufferMin: 0, minNoticeHours: 8, maxAdvanceDays: 365 },
    }))
    // now + 8h = 18:00Z → the 15:00Z / 16:00Z / 17:00Z slots are gone.
    expect(stricter[0].startUtc.toISOString()).toBe("2026-03-05T18:00:00.000Z")
  })

  it("keeps a slot that starts exactly at the notice boundary", () => {
    const slots = computeSlotsForDate(baseArgs({
      dateLocal: "2026-03-05",
      rules: [rule({ dayOfWeek: 4, startTime: "09:00", endTime: "18:00" })],
      policy: { slotDurationMin: 60, bufferMin: 0, minNoticeHours: 5, maxAdvanceDays: 365 },
    }))
    expect(slots[0].startUtc.toISOString()).toBe("2026-03-05T15:00:00.000Z")
  })

  it("drops slots beyond the maxAdvanceDays horizon", () => {
    const args = baseArgs({ dateLocal: "2026-06-08" })  // a Monday, ~95 days out
    expect(computeSlotsForDate({ ...args, policy: { ...args.policy, maxAdvanceDays: 60 } })).toEqual([])
    expect(computeSlotsForDate({ ...args, policy: { ...args.policy, maxAdvanceDays: 120 } })).toHaveLength(3)
  })

  it("defaults to 24h notice / 60d horizon when the policy omits them", () => {
    const slots = computeSlotsForDate(baseArgs({
      dateLocal: "2026-03-05",
      rules: [rule({ dayOfWeek: 4, startTime: "09:00", endTime: "18:00" })],
      policy: { slotDurationMin: 60, bufferMin: 0 },
    }))
    // now + 24h = 2026-03-06T10:00Z — every slot today is inside the notice window.
    expect(slots).toEqual([])
  })

  it("interprets dateLocal in the DISPLAY timezone for day-of-week matching", () => {
    // 2026-03-09 noon in Tokyo is still a Monday; the rule is Mexico-City-based.
    const slots = computeSlotsForDate(baseArgs({ displayTimezone: TOKYO }))
    expect(slots).toHaveLength(3)
    // …but the window itself is expanded in the host rule's timezone.
    expect(slots[0].startUtc.toISOString()).toBe("2026-03-09T15:00:00.000Z")
  })
})

/* ────────────────────────── resolveHostUserId ───────────────────────────── */

describe("resolveHostUserId", () => {
  it("prefers Service.createdById", async () => {
    prisma.service.findUnique.mockResolvedValue({ createdById: "creator_1" })
    await expect(resolveHostUserId("svc_a")).resolves.toBe("creator_1")
    expect(prisma.user.findFirst).not.toHaveBeenCalled()
  })

  it("caches the resolution per serviceId", async () => {
    prisma.service.findUnique.mockResolvedValue({ createdById: "creator_2" })
    await resolveHostUserId("svc_cache")
    await resolveHostUserId("svc_cache")
    expect(prisma.service.findUnique).toHaveBeenCalledTimes(1)
  })

  it("falls back to DEFAULT_HOST_USER_ID when the service has no creator", async () => {
    process.env.DEFAULT_HOST_USER_ID = "env_host"
    prisma.service.findUnique.mockResolvedValue({ createdById: null })
    await expect(resolveHostUserId("svc_b")).resolves.toBe("env_host")
    expect(prisma.user.findFirst).not.toHaveBeenCalled()
  })

  it("falls back to the oldest active admin when nothing else is configured", async () => {
    prisma.service.findUnique.mockResolvedValue({ createdById: null })
    prisma.user.findFirst.mockResolvedValue({ id: "admin_1" })
    await expect(resolveHostUserId("svc_c")).resolves.toBe("admin_1")
    expect(prisma.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where:   { role: "admin", status: "active" },
      orderBy: { createdAt: "asc" },
    }))
  })

  it("works with no serviceId at all (generic discovery call)", async () => {
    prisma.user.findFirst.mockResolvedValue({ id: "admin_1" })
    await expect(resolveHostUserId(undefined)).resolves.toBe("admin_1")
    expect(prisma.service.findUnique).not.toHaveBeenCalled()
  })

  it("does not cache when there is no serviceId", async () => {
    prisma.user.findFirst.mockResolvedValue({ id: "admin_1" })
    await resolveHostUserId(null)
    await resolveHostUserId(null)
    expect(prisma.user.findFirst).toHaveBeenCalledTimes(2)
  })

  it("tolerates a missing service row", async () => {
    prisma.service.findUnique.mockResolvedValue(null)
    prisma.user.findFirst.mockResolvedValue({ id: "admin_1" })
    await expect(resolveHostUserId("svc_missing")).resolves.toBe("admin_1")
  })

  it("throws BOOKING_NO_HOST when no host can be found", async () => {
    prisma.service.findUnique.mockResolvedValue({ createdById: null })
    prisma.user.findFirst.mockResolvedValue(null)
    await expect(resolveHostUserId("svc_nohost")).rejects.toMatchObject({
      code: "BOOKING_NO_HOST",
      statusCode: 500,
    })
  })
})

/* ────────────────────── loadServicePolicy / cancellation ────────────────── */

describe("loadServicePolicy", () => {
  it("returns free-discovery-call defaults with no serviceId", async () => {
    await expect(loadServicePolicy(null)).resolves.toMatchObject({
      bookingDurationMin: 30,
      bookingBufferMin: 15,
      bookingMinNoticeHours: 24,
      bookingMaxAdvanceDays: 60,
      bookingRequiresPayment: false,
      bookingCancellationNoticeHours: 12,
      bookingRescheduleNoticeHours: 12,
      isBookable: true,
    })
    expect(prisma.service.findUnique).not.toHaveBeenCalled()
  })

  it("throws SERVICE_NOT_FOUND for an unknown service", async () => {
    prisma.service.findUnique.mockResolvedValue(null)
    await expect(loadServicePolicy("svc_x")).rejects.toMatchObject({ code: "SERVICE_NOT_FOUND", statusCode: 404 })
  })

  it("throws SERVICE_NOT_BOOKABLE when the service is not bookable", async () => {
    prisma.service.findUnique.mockResolvedValue({ isBookable: false, title: "Audit" })
    await expect(loadServicePolicy("svc_x")).rejects.toMatchObject({ code: "SERVICE_NOT_BOOKABLE", statusCode: 400 })
  })

  it("returns the service row when bookable", async () => {
    prisma.service.findUnique.mockResolvedValue({ isBookable: true, bookingDurationMin: 45 })
    await expect(loadServicePolicy("svc_x")).resolves.toMatchObject({ bookingDurationMin: 45 })
  })
})

describe("loadCancellationPolicy", () => {
  it("returns 12/12 defaults without a serviceId", async () => {
    await expect(loadCancellationPolicy(null)).resolves.toEqual({
      bookingCancellationNoticeHours: 12,
      bookingRescheduleNoticeHours: 12,
    })
  })

  it("returns defaults (does NOT throw) when the service was de-listed", async () => {
    prisma.service.findUnique.mockResolvedValue(null)
    await expect(loadCancellationPolicy("gone")).resolves.toEqual({
      bookingCancellationNoticeHours: 12,
      bookingRescheduleNoticeHours: 12,
    })
  })

  it("coerces null columns to the 12h default", async () => {
    prisma.service.findUnique.mockResolvedValue({
      bookingCancellationNoticeHours: null,
      bookingRescheduleNoticeHours: 48,
    })
    await expect(loadCancellationPolicy("svc")).resolves.toEqual({
      bookingCancellationNoticeHours: 12,
      bookingRescheduleNoticeHours: 48,
    })
  })
})

/* ─────────────────────────── getAvailableSlots ──────────────────────────── */

describe("getAvailableSlots", () => {
  beforeEach(() => {
    prisma.availabilityRule.findMany.mockResolvedValue([])
    prisma.availabilityException.findMany.mockResolvedValue([])
    prisma.consultation.findMany.mockResolvedValue([])
    prisma.user.findFirst.mockResolvedValue({ id: "host_1" })
  })

  it.each([[""], ["09/03/2026"], ["2026-3-9"], [null]])("rejects dateLocal %p with BAD_DATE", async (d) => {
    await expect(getAvailableSlots({ dateLocal: d, displayTimezone: MX }))
      .rejects.toMatchObject({ code: "BAD_DATE", statusCode: 400 })
  })

  it("rejects a missing timezone with BAD_TIMEZONE", async () => {
    await expect(getAvailableSlots({ dateLocal: "2026-03-09" }))
      .rejects.toMatchObject({ code: "BAD_TIMEZONE", statusCode: 400 })
  })

  it("returns ISO + localized slots for the generic discovery call", async () => {
    prisma.availabilityRule.findMany.mockResolvedValue([
      rule({ dayOfWeek: 1, startTime: "09:00", endTime: "11:00", slotDurationMin: 30, bufferMin: 0 }),
    ])
    const slots = await getAvailableSlots({ dateLocal: "2026-03-09", displayTimezone: MX })
    expect(slots).toHaveLength(4)
    expect(slots[0]).toEqual({
      startUtc:    "2026-03-09T15:00:00.000Z",
      endUtc:      "2026-03-09T15:30:00.000Z",
      startLocal:  "2026-03-09T09:00:00-06:00",
      durationMin: 30,
    })
  })

  it("only considers consultations in the active booking statuses", async () => {
    await getAvailableSlots({ dateLocal: "2026-03-09", displayTimezone: MX })
    expect(prisma.consultation.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        assignedAdminId: "host_1",
        status: { in: ACTIVE_BOOKING_STATUSES },
      }),
    }))
    expect(ACTIVE_BOOKING_STATUSES).toEqual(["pending", "confirmed", "scheduled"])
  })

  it("derives the busy end from durationMin when endsAt is null", async () => {
    prisma.availabilityRule.findMany.mockResolvedValue([
      rule({ dayOfWeek: 1, startTime: "09:00", endTime: "12:00", slotDurationMin: 60 }),
    ])
    prisma.consultation.findMany.mockResolvedValue([
      { scheduledAt: new Date("2026-03-09T16:00:00.000Z"), endsAt: null, durationMin: 60 },
    ])
    const slots = await getAvailableSlots({ dateLocal: "2026-03-09", displayTimezone: MX })
    expect(slots.map((s) => s.startUtc)).toEqual([
      "2026-03-09T15:00:00.000Z",
      "2026-03-09T17:00:00.000Z",
    ])
  })

  it("queries rules scoped to the host, including service-specific ones", async () => {
    prisma.service.findUnique.mockResolvedValue({
      isBookable: true, bookingDurationMin: 30, bookingBufferMin: 0,
      bookingMinNoticeHours: 0, bookingMaxAdvanceDays: 365, createdById: "host_9",
    })
    await getAvailableSlots({ serviceId: "svc_rules", dateLocal: "2026-03-09", displayTimezone: MX })
    expect(prisma.availabilityRule.findMany).toHaveBeenCalledWith({
      where: {
        hostUserId: "host_9",
        isActive: true,
        OR: [{ serviceId: null }, { serviceId: "svc_rules" }],
      },
    })
  })
})

/* ──────────────────────── getAvailableDaysInMonth ───────────────────────── */

describe("getAvailableDaysInMonth", () => {
  beforeEach(() => {
    prisma.availabilityRule.findMany.mockResolvedValue([
      rule({ dayOfWeek: 1, startTime: "09:00", endTime: "11:00", slotDurationMin: 60 }),
    ])
    prisma.availabilityException.findMany.mockResolvedValue([])
    prisma.consultation.findMany.mockResolvedValue([])
    prisma.user.findFirst.mockResolvedValue({ id: "host_1" })
  })

  it.each([[2026, 0], [2026, 13], [2026, null], [null, 3]])("rejects year=%p month=%p", async (year, month) => {
    await expect(getAvailableDaysInMonth({ year, month, displayTimezone: MX }))
      .rejects.toMatchObject({ code: "BAD_MONTH", statusCode: 400 })
  })

  it("returns only the Mondays inside the booking horizon", async () => {
    const days = await getAvailableDaysInMonth({ year: 2026, month: 3, displayTimezone: MX })
    // now = 2026-03-05, default horizon 60d + 24h notice → every Monday after Mar 6.
    expect(days).toEqual(["2026-03-09", "2026-03-16", "2026-03-23", "2026-03-30"])
  })

  it("caps the scan at maxAdvanceDays", async () => {
    prisma.service.findUnique.mockResolvedValue({
      isBookable: true, bookingDurationMin: 60, bookingBufferMin: 0,
      bookingMinNoticeHours: 0, bookingMaxAdvanceDays: 10, createdById: "host_1",
    })
    const days = await getAvailableDaysInMonth({ serviceId: "svc_h", year: 2026, month: 3, displayTimezone: MX })
    expect(days).toEqual(["2026-03-09"])
  })
})

/* ──────────────────────────── admin CRUD guards ─────────────────────────── */

describe("admin CRUD", () => {
  it("createRule rejects an out-of-range or non-integer dayOfWeek", async () => {
    for (const dayOfWeek of [-1, 7, 1.5, "1", null]) {
      await expect(createRule({ hostUserId: "h", dayOfWeek, startTime: "09:00", endTime: "10:00", timezone: MX }))
        .rejects.toMatchObject({ code: "BAD_DAY", statusCode: 400 })
    }
  })

  it("createRule rejects a bad time string", async () => {
    await expect(createRule({ hostUserId: "h", dayOfWeek: 1, startTime: "9am", endTime: "10:00", timezone: MX }))
      .rejects.toThrow(/Invalid time string/)
  })

  it("createRule requires a timezone", async () => {
    await expect(createRule({ hostUserId: "h", dayOfWeek: 1, startTime: "09:00", endTime: "10:00" }))
      .rejects.toMatchObject({ code: "BAD_TIMEZONE", statusCode: 400 })
  })

  it("createRule applies defaults and clears the host cache", async () => {
    prisma.availabilityRule.create.mockResolvedValue({ id: "r1" })
    await createRule({ hostUserId: "h", dayOfWeek: 3, startTime: "09:00", endTime: "10:00", timezone: MX })
    expect(prisma.availabilityRule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ serviceId: null, slotDurationMin: 30, bufferMin: 0, isActive: true }),
    })
    // Cache cleared → a previously-cached serviceId resolves through Prisma again.
    prisma.service.findUnique.mockResolvedValue({ createdById: "creator_2" })
    await resolveHostUserId("svc_cache")
    expect(prisma.service.findUnique).toHaveBeenCalled()
  })

  it("createRule honours isActive:false", async () => {
    prisma.availabilityRule.create.mockResolvedValue({ id: "r1" })
    await createRule({ hostUserId: "h", dayOfWeek: 3, startTime: "09:00", endTime: "10:00", timezone: MX, isActive: false })
    expect(prisma.availabilityRule.create).toHaveBeenCalledWith({ data: expect.objectContaining({ isActive: false }) })
  })

  it("updateRule validates patched times and days", async () => {
    prisma.availabilityRule.update.mockResolvedValue({ id: "r1" })
    await expect(updateRule("r1", { startTime: "99:00" })).rejects.toThrow(/Time out of range/)
    await expect(updateRule("r1", { dayOfWeek: 9 })).rejects.toMatchObject({ code: "BAD_DAY" })
    await expect(updateRule("r1", { isActive: false })).resolves.toEqual({ id: "r1" })
  })

  it("createException requires a date, a valid type and a timezone", async () => {
    await expect(createException({ hostUserId: "h", type: "block", timezone: MX }))
      .rejects.toMatchObject({ code: "BAD_DATE" })
    await expect(createException({ hostUserId: "h", date: "2026-03-09", type: "nope", timezone: MX }))
      .rejects.toMatchObject({ code: "BAD_TYPE" })
    await expect(createException({ hostUserId: "h", date: "2026-03-09", type: "custom", timezone: MX }))
      .rejects.toMatchObject({ code: "BAD_CUSTOM" })
    await expect(createException({ hostUserId: "h", date: "2026-03-09", type: "block" }))
      .rejects.toMatchObject({ code: "BAD_TIMEZONE" })
  })

  it("createException normalizes date to UTC midnight of the LOCAL day", async () => {
    prisma.availabilityException.create.mockResolvedValue({ id: "e1" })
    await createException({ hostUserId: "h", date: "2026-03-09T18:30:00Z", type: "block", timezone: MX })
    expect(prisma.availabilityException.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        date: new Date("2026-03-09T06:00:00.000Z"),
        type: "block",
        startTime: null,
        endTime: null,
        reason: null,
      }),
    })
  })

  it("listRules / listExceptions / deletes pass through to Prisma", async () => {
    prisma.availabilityRule.findMany.mockResolvedValue([])
    prisma.availabilityException.findMany.mockResolvedValue([])
    prisma.availabilityRule.delete.mockResolvedValue({ id: "r" })
    prisma.availabilityException.delete.mockResolvedValue({ id: "e" })

    await listRules({ hostUserId: "h" })
    expect(prisma.availabilityRule.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { hostUserId: "h" } }))

    await listExceptions({ hostUserId: "h" })
    expect(prisma.availabilityException.findMany).toHaveBeenCalledWith({ where: { hostUserId: "h" }, orderBy: { date: "asc" } })

    await listExceptions({ hostUserId: "h", from: "2026-03-01", to: "2026-03-31" })
    expect(prisma.availabilityException.findMany).toHaveBeenLastCalledWith({
      where: { hostUserId: "h", date: { gte: new Date("2026-03-01"), lte: new Date("2026-03-31") } },
      orderBy: { date: "asc" },
    })

    await expect(deleteRule("r")).resolves.toEqual({ id: "r" })
    await expect(deleteException("e")).resolves.toEqual({ id: "e" })
  })
})
