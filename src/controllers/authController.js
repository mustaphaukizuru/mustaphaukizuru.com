const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const asyncHandler = require("../utils/asyncHandler");
const generateToken = require("../utils/generateToken");
const prisma = require("../lib/prisma");
const {
  sendPasswordResetConfirmationEmail,
  sendResetEmail, // template-free fallback (built inline in mailer.js)
} = require("../utils/mailer");
const { sendTemplateEmail } = require("../services/emailService");
const { resolveUserLocale } = require("../utils/resolveUserLocale");
const { notifyWelcome, notifyPasswordChanged } = require("../services/notificationService");

const {
  registerUser,
  loginUser,
  getUserProfile,
} = require("../services/authService");

const {
  verifyGoogleToken,
  findOrCreateGoogleUser,
  buildAuthUrl: buildGoogleAuthUrl,
  exchangeCodeForProfile: exchangeGoogleCodeForProfile,
} = require("../services/googleAuthService")

const {
  buildAuthUrl: buildMicrosoftAuthUrl,
  exchangeCodeForProfile: exchangeMicrosoftCodeForProfile,
  findOrCreateMicrosoftUser,
} = require("../services/microsoftAuthService")

const {
  buildAuthUrl: buildFacebookAuthUrl,
  exchangeCodeForProfile: exchangeFacebookCodeForProfile,
  findOrCreateFacebookUser,
} = require("../services/facebookAuthService");

/* ────────────────────────────────────────────────────────────────────────
 * Google OAuth redirect flow · helpers
 * ────────────────────────────────────────────────────────────────────────
 * `STATE_COOKIE` lives only for the duration of the OAuth round-trip
 * (5 minutes max). It pairs the user's session with the auth request, so
 * a forged callback URL from an attacker can't trick us into completing
 * the flow against the wrong session.
 *
 * The cookie must be sameSite=lax (NOT strict) — Google's 302 back to our
 * /callback is a top-level cross-site navigation, and strict cookies are
 * dropped on that hop. lax allows GET requests to carry the cookie,
 * which is exactly what we need.
 * ──────────────────────────────────────────────────────────────────── */
const STATE_COOKIE = "g_oauth_state"
const NONCE_COOKIE = "g_oauth_nonce"
const RETURN_COOKIE = "g_oauth_return"
const STATE_TTL_MS = 5 * 60 * 1000 // 5 minutes

// Tiny inline cookie parser — the codebase doesn't use cookie-parser
// middleware and we only need to read three cookies on one route, so a
// dedicated dep would be overkill. Format follows RFC 6265 closely
// enough for our purposes: `name=value; name2=value2`. URL-decodes
// values written by Express's res.cookie().
function parseRequestCookies(req) {
  const header = req.headers.cookie || ""
  const out = {}
  if (!header) return out
  for (const part of header.split(";")) {
    const idx = part.indexOf("=")
    if (idx < 0) continue
    const name = part.slice(0, idx).trim()
    if (!name) continue
    const raw = part.slice(idx + 1).trim()
    try { out[name] = decodeURIComponent(raw) } catch { out[name] = raw }
  }
  return out
}

function getRedirectUri(req) {
  // PRECEDENCE:
  //   1. OAUTH_REDIRECT_URI env var — explicit operator override. This is
  //      the recommended production setting because reverse-proxy header
  //      forwarding is fragile on shared hosts (Hostinger/cPanel/Plesk
  //      often don't pass X-Forwarded-Proto/X-Forwarded-Host reliably,
  //      so the auto-detected URI ends up as `http://` while Google has
  //      `https://` registered → invalid_grant on the code exchange).
  //   2. Auto-detection from X-Forwarded-Proto / X-Forwarded-Host.
  //   3. Bare `req.protocol` + `req.headers.host` (works for localhost
  //      and any deployment without a reverse proxy in the way).
  //
  // The redirect_uri sent to Google in `/start` MUST byte-identically
  // match the one sent on the `/callback` exchange AND the one registered
  // in Google Cloud Console. Any difference — trailing slash, http vs
  // https, www vs apex — produces `invalid_grant`. Setting the env var
  // pins it to one canonical value across both legs and matches the
  // Console exactly.
  if (process.env.OAUTH_REDIRECT_URI) return process.env.OAUTH_REDIRECT_URI

  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https"
  const host  = req.headers["x-forwarded-host"]  || req.headers.host
  return `${proto}://${host}/api/auth/google/callback`
}

function setOAuthCookie(res, name, value, isSecure) {
  res.cookie(name, value, {
    httpOnly: true,
    secure:   isSecure,
    sameSite: "lax",
    maxAge:   STATE_TTL_MS,
    path:     "/",
  })
}

function clearOAuthCookies(res) {
  res.clearCookie(STATE_COOKIE,  { path: "/" })
  res.clearCookie(NONCE_COOKIE,  { path: "/" })
  res.clearCookie(RETURN_COOKIE, { path: "/" })
}

const startGoogleOAuth = asyncHandler(async (req, res) => {
  const frontendForFail = (process.env.FRONTEND_URL || process.env.CLIENT_URL || "").replace(/\/$/, "")

  // Fail-fast: if the server is missing either OAuth credential, don't
  // even send the user to Google — we'll just hit exchange_failed when
  // they come back. Surface a distinct error code so the SPA + log
  // immediately make it clear this is operator config, not user error.
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.error(
      "[google-oauth] /start refused — missing credentials.",
      "client_id set:", Boolean(process.env.GOOGLE_CLIENT_ID),
      "client_secret set:", Boolean(process.env.GOOGLE_CLIENT_SECRET),
    )
    return res.redirect(302, `${frontendForFail}/login?google=server_misconfigured`)
  }

  try {
    const state = crypto.randomBytes(32).toString("hex")
    const nonce = crypto.randomBytes(32).toString("hex")
    const redirectUri = getRedirectUri(req)
    // Optional return_to passed in by the SPA — bounded to safe paths only
    // (must start with "/" and not contain "//" or ":" so we can't be
    // turned into an open-redirect against an external host).
    let returnTo = String(req.query.return_to || "/dashboard")
    if (!returnTo.startsWith("/") || returnTo.includes("//") || returnTo.includes(":")) {
      returnTo = "/dashboard"
    }

    const isSecure = (req.headers["x-forwarded-proto"] || req.protocol) === "https"
    setOAuthCookie(res, STATE_COOKIE,  state,    isSecure)
    setOAuthCookie(res, NONCE_COOKIE,  nonce,    isSecure)
    setOAuthCookie(res, RETURN_COOKIE, returnTo, isSecure)

    const authUrl = buildGoogleAuthUrl({
      state,
      nonce,
      redirectUri,
      loginHint: typeof req.query.login_hint === "string" ? req.query.login_hint : undefined,
    })
    return res.redirect(302, authUrl)
  } catch (err) {
    // Configuration error (missing GOOGLE_CLIENT_ID/SECRET, etc.) →
    // route the user to the login page with a recoverable error.
    const frontend = (process.env.FRONTEND_URL || process.env.CLIENT_URL || "").replace(/\/$/, "")
    return res.redirect(302, `${frontend}/login?google=unavailable`)
  }
})

const googleOAuthCallback = asyncHandler(async (req, res) => {
  const frontend = (process.env.FRONTEND_URL || process.env.CLIENT_URL || "").replace(/\/$/, "")

  // User denied / closed the consent screen → redirect home softly.
  if (req.query.error) {
    clearOAuthCookies(res)
    return res.redirect(302, `${frontend}/login?google=cancelled`)
  }

  const cookies     = parseRequestCookies(req)
  const code        = String(req.query.code  || "")
  const stateQuery  = String(req.query.state || "")
  const stateCookie = String(cookies[STATE_COOKIE] || "")
  const nonceCookie = String(cookies[NONCE_COOKIE] || "")
  const returnTo    = String(cookies[RETURN_COOKIE] || "/dashboard")

  // CSRF check — state from cookie must equal state from query
  if (!code || !stateQuery || !stateCookie || stateQuery !== stateCookie) {
    clearOAuthCookies(res)
    return res.redirect(302, `${frontend}/login?google=state_mismatch`)
  }

  const redirectUri = getRedirectUri(req)
  try {
    const profile = await exchangeGoogleCodeForProfile({
      code,
      redirectUri,
      expectedNonce: nonceCookie || undefined,
    })
    const user = await findOrCreateGoogleUser(profile)
    const token = generateToken(user)
    clearOAuthCookies(res)

    // Token + user are handed to the SPA via URL FRAGMENT, not query
    // string. Fragments aren't sent in the HTTP request line (the server
    // never sees them) so the token doesn't leak into web-server access
    // logs, proxy logs, or HTTP Referer headers. The SPA's
    // /auth/google/return route reads window.location.hash, persists the
    // session, and immediately replaces the URL so the token is gone
    // from the browser history too.
    const safeUser = encodeURIComponent(JSON.stringify({
      id:           user.id,
      fullName:     user.fullName,
      email:        user.email,
      role:         user.role,
      avatarUrl:    user.avatarUrl || null,
      createdAt:    user.createdAt || null,
      hasPassword:  Boolean(user.passwordHash),
      authProvider: user.authProvider || "google",
    }))
    const safeReturn = encodeURIComponent(returnTo)
    return res.redirect(302, `${frontend}/auth/google/return#token=${encodeURIComponent(token)}&user=${safeUser}&return_to=${safeReturn}`)
  } catch (err) {
    clearOAuthCookies(res)
    // Log the real error so operators can diagnose. Google's failures
    // come back with a `response.data.error` like "invalid_grant",
    // "redirect_uri_mismatch", or "invalid_client" — each points at a
    // different config knob, so naming the exact code in the logs is
    // far more useful than the swallowed "exchange_failed" the user
    // sees in the toast.
    const googleErr = err?.response?.data?.error
                   || err?.response?.data?.error_description
                   || err?.message
                   || "unknown"
    console.error(
      "[google-oauth] exchange failed:",
      googleErr,
      "· redirectUri used:", redirectUri,
      "· client_id ending:", (process.env.GOOGLE_CLIENT_ID || "").slice(-12),
      "· client_secret set:", Boolean(process.env.GOOGLE_CLIENT_SECRET),
    )
    return res.redirect(302, `${frontend}/login?google=exchange_failed`)
  }
})

const signup = asyncHandler(async (req, res) => {
  const { fullName, email, password } = req.body;

  if (!fullName || !email || !password) {
    return res.status(400).json({ success: false, message: "fullName, email, and password are required" });
  }
  const trimmedName = String(fullName).trim()
  const trimmedEmail = String(email).trim().toLowerCase()
  if (trimmedName.length < 2 || trimmedName.length > 100) {
    return res.status(400).json({ success: false, message: "Full name must be 2–100 characters" })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return res.status(400).json({ success: false, message: "Invalid email address" })
  }
  if (password.length < 8) {
    return res.status(400).json({ success: false, message: "Password must be at least 8 characters" })
  }
  if (password.length > 128) {
    return res.status(400).json({ success: false, message: "Password too long" })
  }

  const user = await registerUser({ fullName, email, password });
  const token = generateToken(user);

  // Welcome email + in-app notification (non-blocking).
  // Uses the DB-driven template so admin can customize the copy from the
  // EmailTemplates panel without redeploying.
  const dashboardUrl = `${(process.env.FRONTEND_URL || process.env.CLIENT_URL || "").replace(/\/$/, "")}/dashboard`
  // I18N05 · respect the locale the visitor signed up under (URL prefix /es,
  // Accept-Language, or explicit body.locale). Falls back to "en".
  const signupLocale = resolveUserLocale({ req });
  sendTemplateEmail({
    to:          user.email,
    templateKey: "auth.welcome",
    userId:      user.id,
    locale:      signupLocale,
    variables: {
      customerName: user.fullName?.split(" ")[0] || "there",
      dashboardUrl,
    },
  }).catch((e) => console.error("[signup] welcome email:", e.message))
  notifyWelcome(user).catch(() => {})

  res.status(201).json({
    success: true,
    message: "Account created successfully",
    data: { user, token },
  });
});

/**
 * Login with optional 2FA branch (B09).
 *
 * If the user has 2FA enabled, loginUser returns:
 *   { requires2FA: true, twoFactorToken, userId }
 *
 * In that case we return a 200 with `{ data: { requires2FA, twoFactorToken } }`.
 * The frontend swaps to its 2FA prompt and POSTs to /api/auth/2fa/login-verify
 * to exchange the temp token + 2FA code for the real session JWT.
 *
 * Otherwise, the existing { user, token } shape is returned unchanged.
 */
const login = asyncHandler(async (req, res) => {
  const { email, password, rememberMe } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "email and password are required",
    });
  }

  try {
    const result = await loginUser({ email, password, rememberMe: Boolean(rememberMe) });

    // ── 2FA-gated path ──────────────────────────────────────────────────
    if (result?.requires2FA) {
      return res.status(200).json({
        success: true,
        message: "Two-factor authentication required",
        data: {
          requires2FA:    true,
          twoFactorToken: result.twoFactorToken,
        },
      });
    }

    // ── Standard path ───────────────────────────────────────────────────
    const user = result;
    const token = generateToken(user, Boolean(rememberMe));

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user,
        token,
      },
    });
  } catch (error) {
    // If DB is unreachable, return a clear 503 message
    const msg = error?.message || ""
    if (msg.includes("Can't reach database") || msg.includes("ECONNREFUSED") || msg.includes("P1001")) {
      return res.status(503).json({
        success: false,
        message: "The server is temporarily unavailable. Please try again in a moment.",
        code: "DB_UNAVAILABLE",
      })
    }
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Login failed",
    });
  }
});

const googleLogin = asyncHandler(async (req, res) => {
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({
      success: false,
      message: "Google credential is required",
    });
  }

  const profile = await verifyGoogleToken(credential);
  const user = await findOrCreateGoogleUser(profile);
  const token = generateToken(user);

  res.status(200).json({
    success: true,
    message: "Google login successful",
    data: {
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl || null,
        createdAt: user.createdAt || null,
        // Surface hasPassword + authProvider on the login response so
        // the dashboard's "Set a password" tile renders on the very
        // first paint after Google sign-in — no need to wait for a
        // subsequent /me roundtrip.
        hasPassword: Boolean(user.passwordHash),
        authProvider: user.authProvider || "google",
      },
      token,
    },
  });
});

const me = asyncHandler(async (req, res) => {
  const user = await getUserProfile(req.user.id);

  res.status(200).json({
    success: true,
    data: user,
  });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email is required",
    });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, fullName: true },
  });

  if (!user) {
    // Neutral response — do not leak whether the email exists.
    return res.status(200).json({
      success: true,
      message: "If the email exists, a reset link has been generated.",
      data: {},
    });
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || "http://localhost:5173";
  const resetLink = `${frontendUrl}/reset-password/${rawToken}`;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetPasswordToken: hashedToken,
      resetPasswordExpires: expiry,
    },
  });

  try {
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        token: hashedToken,
        expiresAt: expiry,
      },
    });
  } catch (_) {
    // Keep reset flow working even if PasswordReset table is not available yet.
  }

  // ── Email dispatch with hard fallback ─────────────────────────────────
  // Primary path: DB-driven template "auth.password-reset" (admin-editable
  // via EmailTemplates panel). Fallback path: template-free `sendResetEmail`
  // built inline in mailer.js — guarantees the user receives the link even
  // if the EmailTemplate row is missing, inactive, or contains bad markup.
  //
  // Both paths log to EmailLog (sent | failed) so the admin can audit
  // delivery from the dashboard.
  let mailSent = false;
  let lastError = null;

  try {
    const resetLocale = resolveUserLocale({ req });
    const result = await sendTemplateEmail({
      to:          user.email,
      templateKey: "auth.password-reset",
      userId:      user.id,
      locale:      resetLocale,
      variables: {
        customerName: user.fullName?.split(" ")[0] || "there",
        resetUrl:     resetLink,
      },
    });
    if (result?.ok) {
      mailSent = true;
    } else {
      lastError = new Error(result?.error || "Reset email template send failed");
      console.warn(
        `[forgotPassword] template path failed (${lastError.message}) — falling back to inline email`,
      );
    }
  } catch (error) {
    lastError = error;
    console.warn(
      `[forgotPassword] template path threw (${error.message}) — falling back to inline email`,
    );
  }

  // Fallback — only attempt if the template path did not deliver.
  if (!mailSent) {
    try {
      await sendResetEmail(user.email, resetLink);
      mailSent = true;
      console.log(`[forgotPassword] inline fallback delivered → ${user.email}`);
    } catch (error) {
      lastError = error;
      console.error(
        `[forgotPassword] inline fallback also failed for ${user.email}:`,
        error.message,
      );
    }
  }

  // ⚠ NEVER expose resetLink in production responses — the token must only
  // travel via email to prevent interception/logging attacks.
  // In non-production environments, surface a `devResetUrl` so Mustapha can
  // recover during local dev when SMTP is unavailable.
  const isDev = process.env.NODE_ENV !== "production";
  return res.status(200).json({
    success: true,
    message: "If this email is registered, a reset link will be sent shortly.",
    data: isDev && !mailSent ? { devResetUrl: resetLink } : {},
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ success: false, message: "Token and new password are required" });
  }
  if (password.length < 8) {
    return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
  }
  if (password.length > 128) {
    return res.status(400).json({ success: false, message: "Password too long" });
  }

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await prisma.user.findFirst({
    where: {
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { gt: new Date() },
    },
  });

  if (!user) {
    return res.status(400).json({
      success: false,
      message: "Invalid or expired reset token.",
    });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      authProvider: "local",
      resetPasswordToken: null,
      resetPasswordExpires: null,
      lastLoginAt: new Date(),
      // P9.4 · Revoke any JWT issued before the password change. A new token
      // will be minted by the next sign-in; pre-existing 30-day rememberMe
      // tokens stop being honoured the moment the password rotates.
      tokensValidFrom: new Date(),
    },
  });

  try {
    await prisma.passwordReset.updateMany({
      where: { token: hashedToken, userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
  } catch (_) {
    // Optional table.
  }

  // Confirmation email + in-app notification (non-blocking).
  sendPasswordResetConfirmationEmail(user.email).catch((e) =>
    console.error("[resetPassword] confirmation email:", e.message),
  );
  notifyPasswordChanged(user).catch(() => {});

  return res.status(200).json({
    success: true,
    message: "Password updated successfully.",
  });
});

/* ════════════════════════════════════════════════════════════════════════
 * MICROSOFT OAUTH — redirect flow
 * Same pattern as Google: state cookie → redirect → callback → token → session
 * ════════════════════════════════════════════════════════════════════════ */

const MS_STATE_COOKIE  = "ms_oauth_state"
const MS_NONCE_COOKIE  = "ms_oauth_nonce"
const MS_RETURN_COOKIE = "ms_oauth_return"

function getMicrosoftRedirectUri(req) {
  if (process.env.MICROSOFT_OAUTH_REDIRECT_URI) return process.env.MICROSOFT_OAUTH_REDIRECT_URI
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https"
  const host  = req.headers["x-forwarded-host"]  || req.headers.host
  return `${proto}://${host}/api/auth/microsoft/callback`
}

const startMicrosoftOAuth = asyncHandler(async (req, res) => {
  const frontend = (process.env.FRONTEND_URL || process.env.CLIENT_URL || "").replace(/\/$/, "")

  if (!process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET) {
    console.error("[microsoft-oauth] /start refused — missing credentials")
    return res.redirect(302, `${frontend}/login?microsoft=server_misconfigured`)
  }

  try {
    const state = crypto.randomBytes(32).toString("hex")
    const nonce = crypto.randomBytes(32).toString("hex")
    const redirectUri = getMicrosoftRedirectUri(req)
    let returnTo = String(req.query.return_to || "/dashboard")
    if (!returnTo.startsWith("/") || returnTo.includes("//") || returnTo.includes(":")) returnTo = "/dashboard"

    const isSecure = (req.headers["x-forwarded-proto"] || req.protocol) === "https"
    const cookieOpts = { httpOnly: true, secure: isSecure, sameSite: "lax", maxAge: 5 * 60 * 1000, path: "/" }
    res.cookie(MS_STATE_COOKIE,  state,    cookieOpts)
    res.cookie(MS_NONCE_COOKIE,  nonce,    cookieOpts)
    res.cookie(MS_RETURN_COOKIE, returnTo, cookieOpts)

    const authUrl = buildMicrosoftAuthUrl({ state, nonce, redirectUri })
    return res.redirect(302, authUrl)
  } catch (err) {
    const frontend2 = (process.env.FRONTEND_URL || process.env.CLIENT_URL || "").replace(/\/$/, "")
    return res.redirect(302, `${frontend2}/login?microsoft=unavailable`)
  }
})

const microsoftOAuthCallback = asyncHandler(async (req, res) => {
  const frontend = (process.env.FRONTEND_URL || process.env.CLIENT_URL || "").replace(/\/$/, "")

  if (req.query.error) {
    res.clearCookie(MS_STATE_COOKIE, { path: "/" })
    res.clearCookie(MS_NONCE_COOKIE, { path: "/" })
    res.clearCookie(MS_RETURN_COOKIE, { path: "/" })
    return res.redirect(302, `${frontend}/login?microsoft=cancelled`)
  }

  const cookies     = parseRequestCookies(req)
  const code        = String(req.query.code  || "")
  const stateQuery  = String(req.query.state || "")
  const stateCookie = String(cookies[MS_STATE_COOKIE] || "")
  const returnTo    = String(cookies[MS_RETURN_COOKIE] || "/dashboard")

  res.clearCookie(MS_STATE_COOKIE,  { path: "/" })
  res.clearCookie(MS_NONCE_COOKIE,  { path: "/" })
  res.clearCookie(MS_RETURN_COOKIE, { path: "/" })

  if (!code || !stateQuery || !stateCookie || stateQuery !== stateCookie) {
    return res.redirect(302, `${frontend}/login?microsoft=state_mismatch`)
  }

  const redirectUri = getMicrosoftRedirectUri(req)
  try {
    const profile = await exchangeMicrosoftCodeForProfile({ code, redirectUri })
    const user    = await findOrCreateMicrosoftUser(profile)
    const token   = generateToken(user)

    const safeUser = encodeURIComponent(JSON.stringify({
      id: user.id, fullName: user.fullName, email: user.email, role: user.role,
      avatarUrl: user.avatarUrl || null, createdAt: user.createdAt || null,
      hasPassword: Boolean(user.passwordHash), authProvider: "microsoft",
    }))
    return res.redirect(302, `${frontend}/auth/microsoft/return#token=${encodeURIComponent(token)}&user=${safeUser}&return_to=${encodeURIComponent(returnTo)}`)
  } catch (err) {
    console.error("[microsoft-oauth] exchange failed:", err?.response?.data?.error || err?.message || "unknown")
    return res.redirect(302, `${frontend}/login?microsoft=exchange_failed`)
  }
})

/* ════════════════════════════════════════════════════════════════════════
 * FACEBOOK OAUTH — redirect flow
 * ════════════════════════════════════════════════════════════════════════ */

const FB_STATE_COOKIE  = "fb_oauth_state"
const FB_RETURN_COOKIE = "fb_oauth_return"

function getFacebookRedirectUri(req) {
  if (process.env.FACEBOOK_OAUTH_REDIRECT_URI) return process.env.FACEBOOK_OAUTH_REDIRECT_URI
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https"
  const host  = req.headers["x-forwarded-host"]  || req.headers.host
  return `${proto}://${host}/api/auth/facebook/callback`
}

const startFacebookOAuth = asyncHandler(async (req, res) => {
  const frontend = (process.env.FRONTEND_URL || process.env.CLIENT_URL || "").replace(/\/$/, "")

  if (!process.env.FACEBOOK_CLIENT_ID || !process.env.FACEBOOK_CLIENT_SECRET) {
    console.error("[facebook-oauth] /start refused — missing credentials")
    return res.redirect(302, `${frontend}/login?facebook=server_misconfigured`)
  }

  try {
    const state = crypto.randomBytes(32).toString("hex")
    const redirectUri = getFacebookRedirectUri(req)
    let returnTo = String(req.query.return_to || "/dashboard")
    if (!returnTo.startsWith("/") || returnTo.includes("//") || returnTo.includes(":")) returnTo = "/dashboard"

    const isSecure = (req.headers["x-forwarded-proto"] || req.protocol) === "https"
    const cookieOpts = { httpOnly: true, secure: isSecure, sameSite: "lax", maxAge: 5 * 60 * 1000, path: "/" }
    res.cookie(FB_STATE_COOKIE,  state,    cookieOpts)
    res.cookie(FB_RETURN_COOKIE, returnTo, cookieOpts)

    const authUrl = buildFacebookAuthUrl({ state, redirectUri })
    return res.redirect(302, authUrl)
  } catch (err) {
    const frontend2 = (process.env.FRONTEND_URL || process.env.CLIENT_URL || "").replace(/\/$/, "")
    return res.redirect(302, `${frontend2}/login?facebook=unavailable`)
  }
})

const facebookOAuthCallback = asyncHandler(async (req, res) => {
  const frontend = (process.env.FRONTEND_URL || process.env.CLIENT_URL || "").replace(/\/$/, "")

  if (req.query.error || req.query.error_code) {
    res.clearCookie(FB_STATE_COOKIE,  { path: "/" })
    res.clearCookie(FB_RETURN_COOKIE, { path: "/" })
    return res.redirect(302, `${frontend}/login?facebook=cancelled`)
  }

  const cookies     = parseRequestCookies(req)
  const code        = String(req.query.code  || "")
  const stateQuery  = String(req.query.state || "")
  const stateCookie = String(cookies[FB_STATE_COOKIE] || "")
  const returnTo    = String(cookies[FB_RETURN_COOKIE] || "/dashboard")

  res.clearCookie(FB_STATE_COOKIE,  { path: "/" })
  res.clearCookie(FB_RETURN_COOKIE, { path: "/" })

  if (!code || !stateQuery || !stateCookie || stateQuery !== stateCookie) {
    return res.redirect(302, `${frontend}/login?facebook=state_mismatch`)
  }

  const redirectUri = getFacebookRedirectUri(req)
  try {
    const profile = await exchangeFacebookCodeForProfile({ code, redirectUri })
    const user    = await findOrCreateFacebookUser(profile)
    const token   = generateToken(user)

    const safeUser = encodeURIComponent(JSON.stringify({
      id: user.id, fullName: user.fullName, email: user.email, role: user.role,
      avatarUrl: user.avatarUrl || null, createdAt: user.createdAt || null,
      hasPassword: Boolean(user.passwordHash), authProvider: "facebook",
    }))
    return res.redirect(302, `${frontend}/auth/facebook/return#token=${encodeURIComponent(token)}&user=${safeUser}&return_to=${encodeURIComponent(returnTo)}`)
  } catch (err) {
    console.error("[facebook-oauth] exchange failed:", err?.response?.data?.error || err?.message || "unknown")
    return res.redirect(302, `${frontend}/login?facebook=exchange_failed`)
  }
})

module.exports = {
  signup,
  login,
  googleLogin,
  // Google OAuth redirect flow
  startGoogleOAuth,
  googleOAuthCallback,
  // Microsoft OAuth redirect flow
  startMicrosoftOAuth,
  microsoftOAuthCallback,
  // Facebook OAuth redirect flow
  startFacebookOAuth,
  facebookOAuthCallback,
  me,
  forgotPassword,
  resetPassword,
};
