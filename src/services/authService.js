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

  // T5-17 · claim any project membership invited to this address before the
  // account existed. Here because ensureProfile already runs on every
  // finalised sign-in — sign-up, password login, the 2FA second step and
  // OAuth — and a fifth call site is a fifth chance to forget one.
  //
  // Without it an invitation to somebody who signs up afterwards stays
  // email-only forever: they can still reach the project by code and PIN but
  // never from their own dashboard, which is the half-state where somebody
  // assumes the invitation failed. Never throws.
  await linkProjectMemberships(userId);
}

async function linkProjectMemberships(userId) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
    if (!user?.email) return;
    await require("./projectMemberService").linkExistingAccounts(user);
  } catch (_) {
    // A membership that could not be linked must never fail a login.
  }
}

/* ── T3-5 · account lockout ──────────────────────────────────────────────
 *
 * The login rate limiter is keyed per IP, which is the wrong axis for the
 * attack that matters most here: a password-spraying botnet has thousands of
 * addresses and makes one attempt from each, so every request looks like a
 * first attempt and the limiter never fires. These counters are per ACCOUNT,
 * which is where the damage would actually be done.
 *
 * Neither replaces the other. The IP limiter stops one machine hammering one
 * account; this stops many machines hammering one account.
 */

/** Failures before an account stops accepting passwords. */
const MAX_FAILED_LOGINS = 10
/** How long it stays shut. Long enough to ruin a spray, short enough that a
 *  real person who fat-fingered ten times can make coffee and come back. */
const LOCKOUT_MINUTES = 15

/**
 * Record a failed attempt, and lock the account once it has had enough.
 *
 * Never throws: a counter that fails to increment must not turn a wrong
 * password into a 500, which would itself be an oracle (a different response
 * for a real account than for a made-up one).
 */
async function recordFailedLogin(userId) {
  if (!userId) return
  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data:  { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    })
    if (user.failedLoginAttempts >= MAX_FAILED_LOGINS) {
      const until = new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
      await prisma.user.update({
        where: { id: userId },
        // The counter resets with the lock so the next window starts clean;
        // otherwise the eleventh failure ever would lock the account again
        // immediately after every expiry.
        data:  { lockedUntil: until, failedLoginAttempts: 0 },
      })
    }
  } catch (_) { /* best effort */ }
}

/** A successful sign-in clears the slate. */
async function clearFailedLogins(userId) {
  if (!userId) return
  try {
    await prisma.user.update({
      where: { id: userId },
      data:  { failedLoginAttempts: 0, lockedUntil: null },
    })
  } catch (_) { /* best effort */ }
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

  // T3-5 · locked out. Answered with the SAME generic message as a wrong
  // password, deliberately: "this account is temporarily locked" tells an
  // attacker their spray found a real address and that they should come back
  // later, which is two pieces of information they did not have.
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const err = new Error("Invalid email or password");
    err.statusCode = 401;
    throw err;
  }

  if (!user.passwordHash) {
    // T3-5 · one answer for every failure. "This account uses Google
    // sign-in" confirmed both that the address is registered AND how — an
    // oracle that turns a list of addresses into a list of accounts, and
    // tells an attacker which ones to phish rather than guess.
    //
    // The UX cost is covered: the login page already offers "Continue with
    // Google" beside the form, so a Google user who reaches for a password
    // has the right button in front of them.
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
    // Counted per ACCOUNT, which is the axis the per-IP limiter cannot see.
    await recordFailedLogin(user.id);
    const err = new Error("Invalid email or password");
    err.statusCode = 401;
    throw err;
  }

  // The password was right. Whatever failures came before it were somebody
  // mistyping, so the slate is wiped — including a lock that has expired.
  await clearFailedLogins(user.id);

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

/**
 * Step 40 · server-side session revocation.
 *
 * Bumps the user's `tokensValidFrom` watermark to now, which authMiddleware
 * compares against every JWT's `iat`. Because the watermark is per-user this
 * invalidates EVERY outstanding session for that account — the cookie we
 * just cleared, any Bearer token still cached by an old SPA build, and any
 * long-lived rememberMe token on another device. That is the behaviour we
 * want from an explicit sign-out: a session that lives in an httpOnly cookie
 * cannot be deleted by the client itself, so the server has to be the one
 * that makes it unusable.
 *
 * Never throws — sign-out must succeed even if the write fails, otherwise a
 * DB hiccup would leave the user apparently signed in.
 */
async function revokeUserSessions(userId) {
  if (!userId) return false
  try {
    await prisma.user.update({
      where: { id: userId },
      data:  { tokensValidFrom: new Date() },
    })
    return true
  } catch {
    return false
  }
}

module.exports = {
  recordFailedLogin,
  clearFailedLogins,
  MAX_FAILED_LOGINS,
  LOCKOUT_MINUTES,
  registerUser,
  loginUser,
  revokeUserSessions,
  completeLoginAfter2FA,
  getUserProfile,
  findOrCreateUserForCheckout,
  createAccountClaim,
};
