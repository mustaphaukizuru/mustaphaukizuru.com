const bcrypt = require("bcryptjs");
const prisma = require("../lib/prisma");

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

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
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
    },
  });

  await ensureProfile(user.id);

  return user;
}

async function loginUser({ email, password }) {
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

  // legacy fallback: plain-text password stored in DB
  if (!isMatch && user.passwordHash === password) {
    isMatch = true;

    const upgradedHash = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: upgradedHash },
    });
  }

  if (!isMatch) {
    const err = new Error("Invalid email or password");
    err.statusCode = 401;
    throw err;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  }).catch(() => null);

  await ensureProfile(user.id);

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

async function getUserProfile(userId) {
  return prisma.user.findUnique({
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
    },
  });
}

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
};