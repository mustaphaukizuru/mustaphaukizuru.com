const crypto = require("crypto")
const bcrypt = require("bcryptjs")
const speakeasy = require("speakeasy")
const QRCode = require("qrcode")
const jwt = require("jsonwebtoken")
const prisma = require("../lib/prisma")

/**
 * 2FA service (B09)
 *
 * Wraps the TOTP + backup-code logic. Persistence model:
 *
 *   TwoFactorAuth.secret       — base32-encoded TOTP secret
 *   TwoFactorAuth.isEnabled    — false until user verifies their first code
 *   TwoFactorAuth.backupCodes  — Json array of { codeHash, used, usedAt }
 *
 * Two-factor token (issued by /api/auth/login when 2FA is required):
 *   short-lived JWT signed with JWT_SECRET, claim purpose: "2fa-pending",
 *   5-minute expiry. Verified by /api/auth/2fa/login-verify.
 */

const ISSUER = "Mustapha Ukizuru"
const TWO_FACTOR_TOKEN_TTL_SECONDS = 5 * 60      // 5 minutes
const TWO_FACTOR_TOKEN_PURPOSE = "2fa-pending"
const BACKUP_CODE_COUNT = 8
const TOTP_VERIFY_WINDOW = 1                      // ±1 step (≈ ±30s clock drift)

/* ────────────────────────────────────────────────────────────────────────────
 * Setup / lifecycle
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Begin enrollment. Generates a TOTP secret, persists the row in disabled
 * state (secret only — no backup codes yet), returns the QR data URL and the
 * manual entry code so the user can paste into their authenticator app.
 *
 * If a row already exists in disabled state, we reuse and rotate its secret.
 * If a row already exists in ENABLED state, we throw — caller must disable
 * first to re-enroll.
 */
async function setupTwoFactor({ userId, userEmail }) {
  const existing = await prisma.twoFactorAuth.findUnique({ where: { userId } })

  if (existing?.isEnabled) {
    throw httpError(409, "2FA is already enabled. Disable it first to re-enroll.")
  }

  const secret = speakeasy.generateSecret({
    length: 20,
    name:   `${ISSUER}:${userEmail}`,
    issuer: ISSUER,
  })

  // otpauth_url is what the QR encodes — Google Authenticator and Authy
  // recognize the standard otpauth:// URI scheme.
  const otpauthUrl = secret.otpauth_url
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 240,
    color: { dark: "#1A1B23", light: "#FFFFFF" },
  })

  const data = {
    userId,
    secret:      secret.base32,
    isEnabled:   false,
    backupCodes: [],
  }

  if (existing) {
    await prisma.twoFactorAuth.update({ where: { userId }, data })
  } else {
    await prisma.twoFactorAuth.create({ data })
  }

  return {
    qrCodeDataUrl,
    manualEntryCode: secret.base32,
    issuer: ISSUER,
    accountLabel: userEmail,
  }
}

/**
 * Confirm enrollment. Validates the user's first TOTP code against the
 * stored secret. On success: flip isEnabled, generate + hash 8 backup codes,
 * stamp enabledAt, return the PLAINTEXT codes (only chance the user sees).
 */
async function verifyAndEnable({ userId, code }) {
  if (!code || !/^\d{6}$/.test(String(code).trim())) {
    throw httpError(400, "Code must be 6 digits")
  }

  const row = await prisma.twoFactorAuth.findUnique({ where: { userId } })
  if (!row) throw httpError(404, "No 2FA setup in progress. Run setup first.")
  if (row.isEnabled) throw httpError(409, "2FA is already enabled.")

  const ok = speakeasy.totp.verify({
    secret:   row.secret,
    encoding: "base32",
    token:    String(code).trim(),
    window:   TOTP_VERIFY_WINDOW,
  })

  if (!ok) throw httpError(400, "Invalid code. Make sure your device clock is set to network time.")

  const { plain, hashed } = await generateBackupCodeBatch(BACKUP_CODE_COUNT)

  await prisma.twoFactorAuth.update({
    where: { userId },
    data: {
      isEnabled:   true,
      enabledAt:   new Date(),
      backupCodes: hashed,
    },
  })

  return { backupCodes: plain }
}

/**
 * Disable + delete the row. Caller must verify the user's password before
 * calling this — controller enforces that.
 */
async function disableTwoFactor({ userId }) {
  const row = await prisma.twoFactorAuth.findUnique({ where: { userId } })
  if (!row) return { disabled: false, reason: "Not enabled" }
  await prisma.twoFactorAuth.delete({ where: { userId } })
  return { disabled: true }
}

/**
 * Regenerate backup codes. Invalidates the previous batch entirely. Caller
 * must verify password before calling.
 */
async function regenerateBackupCodes({ userId }) {
  const row = await prisma.twoFactorAuth.findUnique({ where: { userId } })
  if (!row || !row.isEnabled) throw httpError(404, "2FA is not enabled")

  const { plain, hashed } = await generateBackupCodeBatch(BACKUP_CODE_COUNT)

  await prisma.twoFactorAuth.update({
    where: { userId },
    data:  { backupCodes: hashed },
  })

  return { backupCodes: plain }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Verification (login-time)
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Verify a code at login time. Tries TOTP first, then backup code. On a
 * successful backup-code match, marks that code used in-place.
 */
async function verifyLoginCode({ userId, code }) {
  const row = await prisma.twoFactorAuth.findUnique({ where: { userId } })
  if (!row || !row.isEnabled) throw httpError(400, "2FA is not enabled for this account")

  const trimmed = String(code || "").trim()
  if (!trimmed) throw httpError(400, "Code is required")

  // Path A: 6-digit TOTP
  if (/^\d{6}$/.test(trimmed)) {
    const ok = speakeasy.totp.verify({
      secret:   row.secret,
      encoding: "base32",
      token:    trimmed,
      window:   TOTP_VERIFY_WINDOW,
    })
    if (ok) return { ok: true, method: "totp" }
  }

  // Path B: backup code (8-character hex / mixed). Iterate, bcrypt-compare.
  const codes = Array.isArray(row.backupCodes) ? row.backupCodes : []
  const normalizedInput = normalizeBackupCode(trimmed)

  for (let i = 0; i < codes.length; i++) {
    const entry = codes[i]
    if (!entry || entry.used) continue
    let match = false
    try {
      match = await bcrypt.compare(normalizedInput, entry.codeHash)
    } catch {
      match = false
    }
    if (match) {
      // Mark used in-place and persist
      const updated = codes.slice()
      updated[i] = { ...entry, used: true, usedAt: new Date().toISOString() }
      await prisma.twoFactorAuth.update({
        where: { userId },
        data:  { backupCodes: updated },
      })
      return { ok: true, method: "backup-code" }
    }
  }

  throw httpError(400, "Invalid 2FA code")
}

/* ────────────────────────────────────────────────────────────────────────────
 * Two-factor pending tokens
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Issue a short-lived token after primary auth (password) succeeds but
 * before 2FA is verified. Frontend exchanges this token + a valid 6-digit
 * code at /api/auth/2fa/login-verify to receive the real session JWT.
 */
function issueTwoFactorToken({ userId, rememberMe = false }) {
  return jwt.sign(
    {
      userId,
      rememberMe: Boolean(rememberMe),
      purpose:    TWO_FACTOR_TOKEN_PURPOSE,
    },
    process.env.JWT_SECRET,
    { expiresIn: TWO_FACTOR_TOKEN_TTL_SECONDS }
  )
}

/**
 * Verify a two-factor pending token. Throws on bad/expired/wrong-purpose.
 */
function verifyTwoFactorToken(token) {
  if (!token) throw httpError(400, "Two-factor token is required")
  let payload
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET)
  } catch (err) {
    if (err.name === "TokenExpiredError") throw httpError(401, "Two-factor token has expired. Please log in again.")
    throw httpError(401, "Invalid two-factor token")
  }
  if (payload?.purpose !== TWO_FACTOR_TOKEN_PURPOSE) {
    throw httpError(401, "Invalid two-factor token")
  }
  return { userId: payload.userId, rememberMe: Boolean(payload.rememberMe) }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Status / introspection
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Used by the dashboard page to render the right state (disabled / setup /
 * enabled) without exposing the secret or hashed codes.
 */
async function getStatus(userId) {
  const row = await prisma.twoFactorAuth.findUnique({ where: { userId } })
  if (!row) return { isEnabled: false, isSetupInProgress: false }
  if (!row.isEnabled) {
    return { isEnabled: false, isSetupInProgress: true }
  }
  const codes = Array.isArray(row.backupCodes) ? row.backupCodes : []
  return {
    isEnabled:        true,
    enabledAt:        row.enabledAt,
    backupCodesTotal: codes.length,
    backupCodesUsed:  codes.filter((c) => c?.used).length,
  }
}

/**
 * Helper used by the login flow — returns true/false without throwing.
 */
async function isEnabledForUser(userId) {
  try {
    const row = await prisma.twoFactorAuth.findUnique({
      where:  { userId },
      select: { isEnabled: true },
    })
    return Boolean(row?.isEnabled)
  } catch {
    return false
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Backup code shape: groups of 4 + 4 hex chars, e.g. "AB12-CD34". Easy to
 * read, easy to type. Stored hashed.
 */
function generateRandomCodeRaw() {
  // 4 random bytes → 8 hex chars → split as XXXX-XXXX
  const hex = crypto.randomBytes(4).toString("hex").toUpperCase()
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`
}

function normalizeBackupCode(input) {
  return String(input || "").trim().toUpperCase().replace(/\s+/g, "").replace(/-/g, "")
}

async function generateBackupCodeBatch(count) {
  const plain  = []
  const hashed = []

  for (let i = 0; i < count; i++) {
    const code = generateRandomCodeRaw()
    plain.push(code)
    const codeHash = await bcrypt.hash(normalizeBackupCode(code), 10)
    hashed.push({ codeHash, used: false, usedAt: null })
  }

  return { plain, hashed }
}

function httpError(statusCode, message) {
  const err = new Error(message)
  err.statusCode = statusCode
  return err
}

module.exports = {
  // Setup / lifecycle
  setupTwoFactor,
  verifyAndEnable,
  disableTwoFactor,
  regenerateBackupCodes,
  // Login-time
  verifyLoginCode,
  // Pending tokens
  issueTwoFactorToken,
  verifyTwoFactorToken,
  // Status
  getStatus,
  isEnabledForUser,
  // Constants exposed for tests
  TWO_FACTOR_TOKEN_TTL_SECONDS,
}
