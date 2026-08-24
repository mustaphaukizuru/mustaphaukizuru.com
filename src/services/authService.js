const bcrypt = require("bcryptjs");
const prisma = require("../lib/prisma");
const twoFactorService = require("./twoFactorService");

// ─────────────────────────────────────────────────────────────────────────────
// B10 · bcrypt cost = 12
//
// New password hashes are computed at cost factor 12 (~250ms/hash on a modern
// CPU, ~1s on Hostinger shared). Existing user hashes were created at cost 10
// — bcrypt.compare() reads the cost from the hash itself, so they continue to
// verify successfully without any data migration. On their next password
// change they'll be re-hashed at cost 12. Zero downtime, zero migration.
//
// If you want to force-upgrade existing hashes proactively, add a one-time
// step inside the loginUser success block to re-hash and persist when the
// stored hash starts with "$2a$10$" or "$2b$10$".
// ─────────────────────────────────────────────────────────────────────────────

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function ensureProfile(userId) {
  try {
    const existing = await prisma.userProfile.findUnique({
      where: { userId },
    });

    if (!existing) {
      await prisma.userProfile.create({
        data: { userId },
      });
    }
  } catch (_) {
    // ignore if profile table is not available yet
  }
}

async function registerUser({ fullName, email, password }) {
  const normalizedEmail = normalizeEmail(email);

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    throw new Error("A user with this email already exists");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const createdRaw = await prisma.user.create({
    data: {
      fullName,
      email: normalizedEmail,
      passwordHash,
      authProvider: "local",
      status: "active",
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      avatarUrl: true,
      createdAt: true,
      passwordHash: true,
      authProvider: true,
    },
  });

  // Strip the hash before downstream code touches it — only `hasPassword`
  // (the boolean derived from passwordHash) ever leaves the server.
  const { passwordHash: _hash, ...rest } = createdRaw;
  const user = {
    ...rest,
    hasPassword: Boolean(_hash),
  };

  await ensureProfile(user.id);

  return user;
}

/**
 * Login flow with optional 2FA branch (B09).
 *
 * Verifies the password as before. Then checks whether the user has 2FA
 * enabled — if so, returns `{ requires2FA: true, twoFactorToken, userId }`
 * INSTEAD of the user object. The caller (authController.login) sees the
 * shape and decides what to send to the client.
 *
 * @param {object} opts
 * @param {string} opts.email
 * @param {string} opts.password
 * @param {boolean} [opts.rememberMe] - propagated into the 2FA pending
 *   token so the final session JWT (issued by /2fa/login-verify) honors it.
 *
 * @returns {Promise<
 *     { requires2FA: true, twoFactorToken: string, userId: string }
 *   | { id, fullName, email, role, createdAt }
 * >}
 */
async function loginUser({ email, password, rememberMe = false }) {
  const normalizedEmail = normalizeEmail(email);

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    const err = new Error("Invalid email or password");
    err.statusCode = 401;
    throw err;
  }

  if (user.status && user.status !== "active") {
    const err = new Error("This account is not active");
    err.statusCode = 403;
    throw err;
  }

  if (!user.passwordHash) {
    if (user.authProvider === "google") {
      const err = new Error("This account uses Google sign-in");
      err.statusCode = 400;
      throw err;
    }

    const err = new Error("Invalid email or password");
    err.statusCode = 401;
    throw err;
  }

  let isMatch = false;

  try {
    isMatch = await bcrypt.compare(password, user.passwordHash);
  } catch (_) {
    isMatch = false;
  }

  // Security · no plaintext fallback. Rows that are not bcrypt hashes are
  // invalidated by scripts/invalidate-plaintext-passwords.js; those users
  // must use "forgot password".

  if (!isMatch) {
    const err = new Error("Invalid email or password");
    err.statusCode = 401;
    throw err;
  }

  // ── B09 · 2FA gate ────────────────────────────────────────────────────
  // Password verified. If the user has 2FA enabled, do NOT update
  // lastLoginAt yet — that happens after the second factor is verified
  // by completeLogin().
  const twoFactorEnabled = await twoFactorService.isEnabledForUser(user.id);
  if (twoFactorEnabled) {
    const twoFactorToken = twoFactorService.issueTwoFactorToken({
      userId: user.id,
      rememberMe: Boolean(rememberMe),
    });
    return {
      requires2FA: true,
      twoFactorToken,
      userId: user.id,
    };
  }

  // No 2FA — finalize login immediately
  await prisma.user.update({
    where: { id: user.id },
    data:  { lastLoginAt: new Date() },
  }).catch(() => null);

  await ensureProfile(user.id);

  // Include `hasPassword` and `authProvider` in the login response so the
  // dashboard's password section renders the correct form immediately
  // after sign-in, without waiting for the subsequent /me fetch.
  return {
    id:           user.id,
    fullName:     user.fullName,
    email:        user.email,
    role:         user.role,
    createdAt:    user.createdAt,
    hasPassword:  Boolean(user.passwordHash),
    authProvider: user.authProvider || "local",
  };
}

/**
 * Finalize a 2FA-gated login. Called by the 2FA controller after the second
 * factor has been verified. Returns the same user shape as a no-2FA loginUser.
 *
 * Intentionally not exposed to the public API — only call from
 * twoFactorController after verifyLoginCode succeeds.
 */
async function completeLoginAfter2FA(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    const err = new Error("User no longer exists");
    err.statusCode = 401;
    throw err;
  }

  if (user.status && user.status !== "active") {
    const err = new Error("This account is not active");
    err.statusCode = 403;
    throw err;
  }

  await prisma.user.update({
    where: { id: user.id },
    data:  { lastLoginAt: new Date() },
  }).catch(() => null);

  await ensureProfile(user.id);

  return {
    id:           user.id,
    fullName:     user.fullName,
    email:        user.email,
    role:         user.role,
    createdAt:    user.createdAt,
    hasPassword:  Boolean(user.passwordHash),
    authProvider: user.authProvider || "local",
  };
}

async function getUserProfile(userId) {
  // `passwordHash` is selected ONLY to compute `hasPassword`; we strip
  // the hash itself before returning so the literal bcrypt string never
  // leaves the server. `authProvider` is informational for the client
  // (used by the dashboard "set password" tile to show context like
  // "You signed up with Google. Set a password as a backup.").
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      avatarUrl: true,
      phone: true,
      company: true,
      createdAt: true,
      passwordHash: true,
      authProvider: true,
    },
  });
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return { ...safe, hasPassword: Boolean(passwordHash) };
}

/* ────────────────────────────────────────────────────────────────────────
   Guest checkout · auto-account flow
   ──────────────────────────────────────────────────────────────────── */

async function findOrCreateUserForCheckout({ fullName, email }) {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) throw new Error("Email is required")

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, fullName: true, email: true, role: true, status: true, authProvider: true, passwordHash: true },
  })
  if (existing) {
    // Security · an email that belongs to a CLAIMED account (has a password,
    // or signs in via OAuth) must authenticate before an order is attached
    // to it. Otherwise anyone could push orders and emails into a stranger's
    // dashboard. Only "checkout"-created accounts that were never claimed
    // (no password) may keep buying by email — they'll get another claim link.
    const requiresLogin = Boolean(existing.passwordHash) || existing.authProvider !== "checkout"
    const { passwordHash: _ph, ...user } = existing
    return { user, isNew: false, requiresLogin }
  }

  // Create a passwordless account so the buyer can immediately access
  // /dashboard/downloads via the email claim link.
  let created
  try {
    created = await prisma.user.create({
      data: {
        fullName:     (fullName || normalizedEmail.split("@")[0]).trim() || "Customer",
        email:        normalizedEmail,
        passwordHash: null,
        authProvider: "checkout",
        status:       "active",
      },
      select: { id: true, fullName: true, email: true, role: true, status: true, authProvider: true },
    })
  } catch (e) {
    // P2002 = race lost; another request created the row first. Just fetch it.
    if (e?.code === "P2002") {
      created = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true, fullName: true, email: true, role: true, status: true, authProvider: true },
      })
      if (!created) throw e
      return { user: created, isNew: false }
    }
    throw e
  }

  await ensureProfile(created.id)

  const claimToken = await createAccountClaim(created.id)
  return { user: created, isNew: true, claimToken }
}

async function createAccountClaim(userId) {
  const crypto = require("crypto")
  const rawToken    = crypto.randomBytes(32).toString("hex")
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex")
  const expiresAt   = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days

  await prisma.user.update({
    where: { id: userId },
    data:  { resetPasswordToken: hashedToken, resetPasswordExpires: expiresAt },
  })
  try {
    await prisma.passwordReset.create({
      data: { userId, token: hashedToken, expiresAt },
    })
  } catch {
    // Audit table missing in some envs — non-fatal.
  }

  return rawToken
}

module.exports = {
  registerUser,
  loginUser,
  completeLoginAfter2FA,
  getUserProfile,
  findOrCreateUserForCheckout,
  createAccountClaim,
};
