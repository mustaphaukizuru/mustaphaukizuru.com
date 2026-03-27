const { OAuth2Client } = require("google-auth-library");
const prisma = require("../lib/prisma");

const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
const client = new OAuth2Client(googleClientId);

async function verifyGoogleToken(credential) {
  if (!googleClientId) {
    throw new Error("GOOGLE_CLIENT_ID is not configured on the API server");
  }

  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: googleClientId,
  });

  const payload = ticket.getPayload();

  if (!payload) {
    throw new Error("Invalid Google token");
  }

  return {
    googleId: payload.sub,
    email: String(payload.email || "").toLowerCase(),
    fullName: payload.name,
    avatarUrl: payload.picture || null,
    emailVerified: payload.email_verified,
  };
}

async function findOrCreateGoogleUser(profile) {
  if (!profile.emailVerified) {
    throw new Error("Google email is not verified");
  }

  let user = await prisma.user.findUnique({ where: { email: profile.email } });

  if (user) {
    user = await prisma.user.update({
      where: { email: profile.email },
      data: {
        googleId: profile.googleId,
        avatarUrl: profile.avatarUrl,
        authProvider: "google",
        status: "active",
        lastLoginAt: new Date(),
      },
      include: { profile: true },
    });

    if (!user.profile) {
      await prisma.userProfile.create({ data: { userId: user.id } });
    }

    return user;
  }

  user = await prisma.user.create({
    data: {
      fullName: profile.fullName,
      email: profile.email,
      googleId: profile.googleId,
      avatarUrl: profile.avatarUrl,
      authProvider: "google",
      passwordHash: null,
      status: "active",
      lastLoginAt: new Date(),
      profile: { create: {} },
    },
  });

  return user;
}

module.exports = {
  verifyGoogleToken,
  findOrCreateGoogleUser,
};
