// ─────────────────────────────────────────────────────────────────────────────
// twoFactorService — unit tests
//
// speakeasy, bcryptjs and jsonwebtoken run FOR REAL so the TOTP window, the
// bcrypt backup-code compare and the JWT purpose/expiry claims are exercised
// end-to-end. Only Prisma and QRCode are mocked.
//
// Clock is frozen with fake timers (Date only — timers themselves are left
// real so bcryptjs' async work still resolves).
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({
  twoFactorAuth: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  user:          { update: jest.fn() },
}))

jest.mock("qrcode", () => ({ toDataURL: jest.fn(async () => "data:image/png;base64,QR") }))

const prisma    = require("../src/lib/prisma")
const QRCode    = require("qrcode")
const speakeasy = require("speakeasy")
const bcrypt    = require("bcryptjs")
const jwt       = require("jsonwebtoken")

const {
  setupTwoFactor,
  verifyAndEnable,
  disableTwoFactor,
  regenerateBackupCodes,
  verifyLoginCode,
  issueTwoFactorToken,
  verifyTwoFactorToken,
  getStatus,
  isEnabledForUser,
  TWO_FACTOR_TOKEN_TTL_SECONDS,
} = require("../src/services/twoFactorService")

const SECRET = speakeasy.generateSecret({ length: 20 }).base32
const USER   = "user_1"
const EMAIL  = "mustapha@example.com"
const NOW    = new Date("2026-03-05T10:00:00.000Z")
const STEP   = 30_000   // TOTP step in ms

/** Only Date/performance are faked — real timers keep bcryptjs happy. */
const REAL_TIMERS = [
  "setTimeout", "clearTimeout", "setInterval", "clearInterval",
  "setImmediate", "clearImmediate", "nextTick", "queueMicrotask",
]

const totpAt = (offsetMs = 0, secret = SECRET) =>
  speakeasy.totp({ secret, encoding: "base32", time: (NOW.getTime() + offsetMs) / 1000 })

const enabledRow = (over = {}) => ({
  userId: USER, secret: SECRET, isEnabled: true, enabledAt: NOW, backupCodes: [], ...over,
})

beforeAll(() => { process.env.JWT_SECRET = "t".repeat(64) })

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers({ doNotFake: REAL_TIMERS }).setSystemTime(NOW)
  prisma.twoFactorAuth.update.mockResolvedValue({})
  prisma.twoFactorAuth.create.mockResolvedValue({})
  prisma.twoFactorAuth.delete.mockResolvedValue({})
  prisma.user.update.mockResolvedValue({})
})

afterEach(() => { jest.useRealTimers() })

/* ───────────────────────────── setup ────────────────────────────────────── */

describe("setupTwoFactor", () => {
  it("creates a disabled row with a fresh secret and returns a QR payload", async () => {
    prisma.twoFactorAuth.findUnique.mockResolvedValue(null)
    const out = await setupTwoFactor({ userId: USER, userEmail: EMAIL })

    expect(prisma.twoFactorAuth.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: USER, isEnabled: false, backupCodes: [] }),
    })
    expect(prisma.twoFactorAuth.update).not.toHaveBeenCalled()
    expect(out.qrCodeDataUrl).toBe("data:image/png;base64,QR")
    expect(out.manualEntryCode).toEqual(expect.stringMatching(/^[A-Z2-7]+$/))
    expect(out.accountLabel).toBe(EMAIL)
    expect(QRCode.toDataURL).toHaveBeenCalledWith(
      expect.stringContaining("otpauth://totp/"),
      expect.any(Object),
    )
  })

  it("rotates the secret of an existing DISABLED row", async () => {
    prisma.twoFactorAuth.findUnique.mockResolvedValue({ userId: USER, secret: "OLD", isEnabled: false })
    const out = await setupTwoFactor({ userId: USER, userEmail: EMAIL })
    expect(prisma.twoFactorAuth.create).not.toHaveBeenCalled()
    expect(prisma.twoFactorAuth.update).toHaveBeenCalledWith({
      where: { userId: USER },
      data:  expect.objectContaining({ isEnabled: false, backupCodes: [] }),
    })
    expect(out.manualEntryCode).not.toBe("OLD")
  })

  it("409s when 2FA is already enabled", async () => {
    prisma.twoFactorAuth.findUnique.mockResolvedValue(enabledRow())
    await expect(setupTwoFactor({ userId: USER, userEmail: EMAIL }))
      .rejects.toMatchObject({ statusCode: 409 })
    expect(prisma.twoFactorAuth.create).not.toHaveBeenCalled()
  })
})

/* ─────────────────────────── verifyAndEnable ────────────────────────────── */

describe("verifyAndEnable", () => {
  beforeEach(() => {
    prisma.twoFactorAuth.findUnique.mockResolvedValue({ userId: USER, secret: SECRET, isEnabled: false, backupCodes: [] })
  })

  it.each([[""], ["12345"], ["1234567"], ["abcdef"], [null], ["  "]])("400s on malformed code %p", async (code) => {
    await expect(verifyAndEnable({ userId: USER, code })).rejects.toMatchObject({ statusCode: 400 })
  })

  it("404s when no setup is in progress", async () => {
    prisma.twoFactorAuth.findUnique.mockResolvedValue(null)
    await expect(verifyAndEnable({ userId: USER, code: totpAt() })).rejects.toMatchObject({ statusCode: 404 })
  })

  it("409s when 2FA is already enabled", async () => {
    prisma.twoFactorAuth.findUnique.mockResolvedValue(enabledRow())
    await expect(verifyAndEnable({ userId: USER, code: totpAt() })).rejects.toMatchObject({ statusCode: 409 })
  })

  it("400s on a wrong TOTP code", async () => {
    const wrong = totpAt(10 * STEP)   // 5 minutes out — far outside the window
    await expect(verifyAndEnable({ userId: USER, code: wrong })).rejects.toMatchObject({ statusCode: 400 })
    expect(prisma.twoFactorAuth.update).not.toHaveBeenCalled()
  })

  it("enables, stamps enabledAt, hashes 8 backup codes and revokes old JWTs", async () => {
    const { backupCodes } = await verifyAndEnable({ userId: USER, code: totpAt() })

    expect(backupCodes).toHaveLength(8)
    backupCodes.forEach((c) => expect(c).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}$/))
    expect(new Set(backupCodes).size).toBe(8)

    const data = prisma.twoFactorAuth.update.mock.calls[0][0].data
    expect(data.isEnabled).toBe(true)
    expect(data.enabledAt).toEqual(NOW)
    expect(data.backupCodes).toHaveLength(8)
    // Codes are stored hashed, never in the clear.
    data.backupCodes.forEach((e) => {
      expect(e).toMatchObject({ used: false, usedAt: null })
      expect(e.codeHash).toMatch(/^\$2[aby]\$/)
    })
    expect(JSON.stringify(data.backupCodes)).not.toContain(backupCodes[0].replace("-", ""))

    // P9.4 — sessions opened before 2FA existed are invalidated.
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: USER }, data: { tokensValidFrom: NOW } })
  }, 20_000)

  it("still succeeds if the tokensValidFrom bump fails", async () => {
    prisma.user.update.mockRejectedValue(new Error("db down"))
    await expect(verifyAndEnable({ userId: USER, code: totpAt() })).resolves.toHaveProperty("backupCodes")
  }, 20_000)
})

/* ─────────────────────────── TOTP verify window ─────────────────────────── */

describe("verifyLoginCode — TOTP window", () => {
  beforeEach(() => { prisma.twoFactorAuth.findUnique.mockResolvedValue(enabledRow()) })

  it("accepts the current step", async () => {
    await expect(verifyLoginCode({ userId: USER, code: totpAt(0) })).resolves.toEqual({ ok: true, method: "totp" })
  })

  it.each([[-STEP, "one step behind"], [STEP, "one step ahead"]])("accepts %p ms (%s)", async (offset) => {
    await expect(verifyLoginCode({ userId: USER, code: totpAt(offset) })).resolves.toEqual({ ok: true, method: "totp" })
  })

  it.each([[-2 * STEP], [2 * STEP], [-10 * STEP]])("rejects %p ms — outside the ±1 step window", async (offset) => {
    await expect(verifyLoginCode({ userId: USER, code: totpAt(offset) })).rejects.toMatchObject({ statusCode: 400 })
  })

  it("rejects a code generated from a different secret", async () => {
    const other = speakeasy.generateSecret({ length: 20 }).base32
    await expect(verifyLoginCode({ userId: USER, code: totpAt(0, other) })).rejects.toMatchObject({ statusCode: 400 })
  })

  it("trims surrounding whitespace", async () => {
    await expect(verifyLoginCode({ userId: USER, code: `  ${totpAt(0)}  ` })).resolves.toMatchObject({ ok: true })
  })

  it("400s when 2FA is not enabled or the row is missing", async () => {
    prisma.twoFactorAuth.findUnique.mockResolvedValue(null)
    await expect(verifyLoginCode({ userId: USER, code: "123456" })).rejects.toMatchObject({ statusCode: 400 })
    prisma.twoFactorAuth.findUnique.mockResolvedValue(enabledRow({ isEnabled: false }))
    await expect(verifyLoginCode({ userId: USER, code: "123456" })).rejects.toMatchObject({ statusCode: 400 })
  })

  it.each([[""], ["   "], [null], [undefined]])("400s on empty code %p", async (code) => {
    await expect(verifyLoginCode({ userId: USER, code })).rejects.toMatchObject({ statusCode: 400 })
  })

  // ── BUG (recorded, not fixed) ────────────────────────────────────────────
  // src/services/twoFactorService.js:180-189 (verifyLoginCode, path A)
  // A successful TOTP verification is never recorded — there is no
  // lastUsedStep/lastUsedAt column and no write on the success path. Repro:
  // an attacker who observes one 6-digit code (shoulder-surf, phishing proxy,
  // MITM'd form post) can replay it as many times as they like for the whole
  // ±1-step window (up to ~90s), each replay minting a fresh session.
  // RFC 6238 §5.2 requires the verifier to reject a second use of the same
  // code. Fix = persist the accepted step and reject step <= lastUsedStep.
  test("a TOTP code cannot be replayed a second time inside its window", async () => {
    // Stateful mock — the point of the fix is that the consumed step
    // PERSISTS, so the second read has to see what the first write stored.
    const row = enabledRow()
    prisma.twoFactorAuth.findUnique.mockImplementation(async () => ({ ...row }))
    prisma.twoFactorAuth.update.mockImplementation(async ({ data }) => {
      Object.assign(row, data)
      return { ...row }
    })

    const code = totpAt(0)
    await expect(verifyLoginCode({ userId: USER, code })).resolves.toMatchObject({ ok: true, method: "totp" })
    expect(row.lastUsedStep).toBeDefined()
    await expect(verifyLoginCode({ userId: USER, code })).rejects.toMatchObject({ statusCode: 400 })
  })
})

/* ────────────────────── backup codes (single use) ───────────────────────── */

describe("verifyLoginCode — backup codes", () => {
  const PLAIN = "AB12-CD34"
  let hashed

  beforeAll(async () => {
    hashed = await bcrypt.hash("AB12CD34", 10)
  }, 20_000)

  const withCodes = (over = {}) => enabledRow({
    backupCodes: [
      { codeHash: hashed, used: false, usedAt: null },
      { codeHash: "$2a$10$notarealhashnotarealhashnotarealhashnotarealhashno", used: false, usedAt: null },
    ],
    ...over,
  })

  it("accepts a valid backup code and marks exactly that entry used", async () => {
    prisma.twoFactorAuth.findUnique.mockResolvedValue(withCodes())
    await expect(verifyLoginCode({ userId: USER, code: PLAIN })).resolves.toEqual({ ok: true, method: "backup-code" })

    const data = prisma.twoFactorAuth.update.mock.calls[0][0].data
    expect(data.backupCodes[0]).toMatchObject({ used: true, usedAt: NOW.toISOString() })
    expect(data.backupCodes[1].used) .toBe(false)
    expect(data.backupCodes[0].codeHash).toBe(hashed)   // hash preserved
  })

  it("normalizes case, dashes and whitespace", async () => {
    for (const variant of ["ab12-cd34", "AB12CD34", " ab12 cd34 ", "Ab12-cD34"]) {
      jest.clearAllMocks()
      prisma.twoFactorAuth.update.mockResolvedValue({})
      prisma.twoFactorAuth.findUnique.mockResolvedValue(withCodes())
      await expect(verifyLoginCode({ userId: USER, code: variant })).resolves.toMatchObject({ method: "backup-code" })
    }
  }, 20_000)

  it("refuses a backup code that is already used (single use)", async () => {
    prisma.twoFactorAuth.findUnique.mockResolvedValue(enabledRow({
      backupCodes: [{ codeHash: hashed, used: true, usedAt: NOW.toISOString() }],
    }))
    await expect(verifyLoginCode({ userId: USER, code: PLAIN })).rejects.toMatchObject({ statusCode: 400 })
    expect(prisma.twoFactorAuth.update).not.toHaveBeenCalled()
  })

  it("refuses an unknown backup code", async () => {
    prisma.twoFactorAuth.findUnique.mockResolvedValue(withCodes())
    await expect(verifyLoginCode({ userId: USER, code: "ZZZZ-ZZZZ" })).rejects.toMatchObject({ statusCode: 400 })
  })

  it("survives a corrupt/null entry in the backupCodes array", async () => {
    prisma.twoFactorAuth.findUnique.mockResolvedValue(enabledRow({
      backupCodes: [null, { codeHash: "not-a-bcrypt-hash", used: false }, { codeHash: hashed, used: false }],
    }))
    await expect(verifyLoginCode({ userId: USER, code: PLAIN })).resolves.toMatchObject({ method: "backup-code" })
  })

  it("treats a non-array backupCodes column as empty", async () => {
    prisma.twoFactorAuth.findUnique.mockResolvedValue(enabledRow({ backupCodes: null }))
    await expect(verifyLoginCode({ userId: USER, code: PLAIN })).rejects.toMatchObject({ statusCode: 400 })
  })

  it("falls through from a failed 6-digit TOTP to the backup-code path", async () => {
    const numericHash = await bcrypt.hash("000000", 10)
    prisma.twoFactorAuth.findUnique.mockResolvedValue(enabledRow({
      backupCodes: [{ codeHash: numericHash, used: false, usedAt: null }],
    }))
    await expect(verifyLoginCode({ userId: USER, code: "000000" })).resolves.toEqual({ ok: true, method: "backup-code" })
  }, 20_000)
})

/* ─────────────────── disable / regenerate lifecycle ─────────────────────── */

describe("disableTwoFactor", () => {
  it("reports not-enabled without touching anything", async () => {
    prisma.twoFactorAuth.findUnique.mockResolvedValue(null)
    await expect(disableTwoFactor({ userId: USER })).resolves.toEqual({ disabled: false, reason: "Not enabled" })
    expect(prisma.twoFactorAuth.delete).not.toHaveBeenCalled()
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it("deletes the row and revokes existing JWTs", async () => {
    prisma.twoFactorAuth.findUnique.mockResolvedValue(enabledRow())
    await expect(disableTwoFactor({ userId: USER })).resolves.toEqual({ disabled: true })
    expect(prisma.twoFactorAuth.delete).toHaveBeenCalledWith({ where: { userId: USER } })
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: USER }, data: { tokensValidFrom: NOW } })
  })

  it("deletes a row that is still mid-setup (isEnabled false)", async () => {
    prisma.twoFactorAuth.findUnique.mockResolvedValue(enabledRow({ isEnabled: false }))
    await expect(disableTwoFactor({ userId: USER })).resolves.toEqual({ disabled: true })
  })
})

describe("regenerateBackupCodes", () => {
  it("404s when 2FA is not enabled", async () => {
    prisma.twoFactorAuth.findUnique.mockResolvedValue(null)
    await expect(regenerateBackupCodes({ userId: USER })).rejects.toMatchObject({ statusCode: 404 })
    prisma.twoFactorAuth.findUnique.mockResolvedValue(enabledRow({ isEnabled: false }))
    await expect(regenerateBackupCodes({ userId: USER })).rejects.toMatchObject({ statusCode: 404 })
  })

  it("replaces the whole batch with 8 fresh unused codes", async () => {
    prisma.twoFactorAuth.findUnique.mockResolvedValue(enabledRow({
      backupCodes: [{ codeHash: "old", used: true, usedAt: "x" }],
    }))
    const { backupCodes } = await regenerateBackupCodes({ userId: USER })
    expect(backupCodes).toHaveLength(8)
    const data = prisma.twoFactorAuth.update.mock.calls[0][0].data
    expect(data.backupCodes).toHaveLength(8)
    expect(data.backupCodes.every((e) => e.used === false)).toBe(true)
    expect(data.backupCodes.map((e) => e.codeHash)).not.toContain("old")
  }, 20_000)
})

/* ───────────────────── two-factor pending tokens ────────────────────────── */

describe("issueTwoFactorToken / verifyTwoFactorToken", () => {
  it("round-trips userId and rememberMe", () => {
    const token = issueTwoFactorToken({ userId: USER, rememberMe: true })
    expect(verifyTwoFactorToken(token)).toEqual({ userId: USER, rememberMe: true })
  })

  it("defaults rememberMe to false and coerces truthy input to a boolean", () => {
    expect(verifyTwoFactorToken(issueTwoFactorToken({ userId: USER }))).toEqual({ userId: USER, rememberMe: false })
    expect(verifyTwoFactorToken(issueTwoFactorToken({ userId: USER, rememberMe: "yes" })).rememberMe).toBe(true)
  })

  it("stamps the 2fa-pending purpose and a 5-minute TTL", () => {
    const payload = jwt.decode(issueTwoFactorToken({ userId: USER }))
    expect(payload.purpose).toBe("2fa-pending")
    expect(TWO_FACTOR_TOKEN_TTL_SECONDS).toBe(300)
    expect(payload.exp - payload.iat).toBe(TWO_FACTOR_TOKEN_TTL_SECONDS)
  })

  it.each([[""], [null], [undefined]])("400s on a missing token %p", (t) => {
    expect(() => verifyTwoFactorToken(t)).toThrow(expect.objectContaining({ statusCode: 400 }))
  })

  it("401s on a garbage token", () => {
    expect(() => verifyTwoFactorToken("not.a.jwt")).toThrow(
      expect.objectContaining({ statusCode: 401, message: "Invalid two-factor token" }),
    )
  })

  it("401s on a token signed with a different secret", () => {
    const forged = jwt.sign({ userId: USER, purpose: "2fa-pending" }, "x".repeat(64), { expiresIn: 300 })
    expect(() => verifyTwoFactorToken(forged)).toThrow(expect.objectContaining({ statusCode: 401 }))
  })

  it("401s once the 5-minute TTL has elapsed", () => {
    const token = issueTwoFactorToken({ userId: USER })
    jest.setSystemTime(new Date(NOW.getTime() + (TWO_FACTOR_TOKEN_TTL_SECONDS + 5) * 1000))
    expect(() => verifyTwoFactorToken(token)).toThrow(/expired/)
    expect(() => verifyTwoFactorToken(token)).toThrow(expect.objectContaining({ statusCode: 401 }))
  })

  it("REFUSES a full session JWT — purpose enforcement is the whole point", () => {
    const sessionToken = jwt.sign({ userId: USER, role: "admin" }, process.env.JWT_SECRET, { expiresIn: "7d" })
    expect(() => verifyTwoFactorToken(sessionToken)).toThrow(
      expect.objectContaining({ statusCode: 401, message: "Invalid two-factor token" }),
    )
  })

  it("refuses a token carrying any other purpose claim", () => {
    for (const purpose of ["password-reset", "2FA-PENDING", "", null]) {
      const token = jwt.sign({ userId: USER, purpose }, process.env.JWT_SECRET, { expiresIn: 300 })
      expect(() => verifyTwoFactorToken(token)).toThrow(expect.objectContaining({ statusCode: 401 }))
    }
  })
})

/* ──────────────────────── status / introspection ────────────────────────── */

describe("getStatus", () => {
  it("reports the untouched state", async () => {
    prisma.twoFactorAuth.findUnique.mockResolvedValue(null)
    await expect(getStatus(USER)).resolves.toEqual({ isEnabled: false, isSetupInProgress: false })
  })

  it("reports setup-in-progress for a disabled row", async () => {
    prisma.twoFactorAuth.findUnique.mockResolvedValue(enabledRow({ isEnabled: false }))
    await expect(getStatus(USER)).resolves.toEqual({ isEnabled: false, isSetupInProgress: true })
  })

  it("counts used vs total backup codes and never leaks the secret", async () => {
    prisma.twoFactorAuth.findUnique.mockResolvedValue(enabledRow({
      backupCodes: [
        { codeHash: "a", used: true }, { codeHash: "b", used: false },
        { codeHash: "c", used: false }, null,
      ],
    }))
    const status = await getStatus(USER)
    expect(status).toEqual({ isEnabled: true, enabledAt: NOW, backupCodesTotal: 4, backupCodesUsed: 1 })
    expect(JSON.stringify(status)).not.toContain(SECRET)
  })

  it("tolerates a non-array backupCodes column", async () => {
    prisma.twoFactorAuth.findUnique.mockResolvedValue(enabledRow({ backupCodes: null }))
    await expect(getStatus(USER)).resolves.toMatchObject({ backupCodesTotal: 0, backupCodesUsed: 0 })
  })
})

describe("isEnabledForUser", () => {
  it.each([
    [{ isEnabled: true },  true],
    [{ isEnabled: false }, false],
    [null,                 false],
  ])("maps row %p to %p", async (row, expected) => {
    prisma.twoFactorAuth.findUnique.mockResolvedValue(row)
    await expect(isEnabledForUser(USER)).resolves.toBe(expected)
  })

  it("swallows DB errors and returns false (login must not hard-fail)", async () => {
    prisma.twoFactorAuth.findUnique.mockRejectedValue(new Error("db down"))
    await expect(isEnabledForUser(USER)).resolves.toBe(false)
  })
})
