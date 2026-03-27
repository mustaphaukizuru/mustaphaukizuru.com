const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const asyncHandler = require("../utils/asyncHandler");
const generateToken = require("../utils/generateToken");
const prisma = require("../lib/prisma");
const { sendResetEmail } = require("../utils/mailer");
const { sendWelcomeEmail, sendPasswordResetConfirmationEmail } = require("../utils/mailer");

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

  res.status(201).json({
    success: true,
    message: "Account created successfully",
    data: { user, token },
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password, rememberMe } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "email and password are required",
    });
  }

  try {
    const user = await loginUser({ email, password });
    // rememberMe=true → 30-day token; false/missing → 7-day default
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
    select: { id: true, email: true },
  });

  if (!user) {
    return res.status(200).json({
      success: true,
      message: "If the email exists, a reset link has been generated.",
      data: {},
    });
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiry = new Date(Date.now() + 60 * 60 * 1000);
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

  let mailSent = false;
  let emailError = null;

  try {
    await sendResetEmail(user.email, resetLink);
    mailSent = true;
  } catch (error) {
    emailError = error;
    console.error("Failed to send reset email:", error.message);
  }

  // ⚠ NEVER expose resetLink in response — even in dev.
  // The token must only travel via email to prevent interception/logging attacks.
  return res.status(200).json({
    success: true,
    message: "If this email is registered, a reset link will be sent shortly.",
    data: {},
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ success: false, message: "Token and new password are required" });
  }
  if (password.length < 8) {
    return res.status(400).json({ success: false, message: "Password must be at least 8 characters" })
  }
  if (password.length > 128) {
    return res.status(400).json({ success: false, message: "Password too long" })
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

  const passwordHash = await bcrypt.hash(password, 10);

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

  res.status(200).json({
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
