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
} = require("../services/googleAuthService");

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

module.exports = {
  signup,
  login,
  googleLogin,
  me,
  forgotPassword,
  resetPassword,
};
