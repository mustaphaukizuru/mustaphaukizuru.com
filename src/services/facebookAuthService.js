/**
 * facebookAuthService.js · Facebook OAuth 2.0 redirect flow
 * ─────────────────────────────────────────────────────────────────────────
 * Same architecture as googleAuthService.js and microsoftAuthService.js.
 *
 * Facebook OAuth endpoints:
 *   Authorization: https://www.facebook.com/dialog/oauth
 *   Token:         https://graph.facebook.com/v19.0/oauth/access_token
 *   User info:     https://graph.facebook.com/v19.0/me
 *
 * Required env vars:
 *   FACEBOOK_CLIENT_ID          — Meta App Dashboard → App ID
 *   FACEBOOK_CLIENT_SECRET      — Meta App Dashboard → App Secret
 *   FACEBOOK_OAUTH_REDIRECT_URI — Exact URI in Meta App → Facebook Login → Settings
 *
 * Setup:
 *   1. developers.facebook.com → Create App → "Authenticate and request data
 *      from users with Facebook Login"
 *   2. Facebook Login → Settings → Valid OAuth Redirect URIs:
 *      https://mustaphaukizuru.com/api/auth/facebook/callback
 *   3. App Settings → Basic → copy App ID → FACEBOOK_CLIENT_ID
 *   4. App Settings → Basic → Show App Secret → FACEBOOK_CLIENT_SECRET
 *   5. Set App to Live mode for production
 */

const axios = require("axios")
const prisma = require("../lib/prisma")

const clientId     = process.env.FACEBOOK_CLIENT_ID
const clientSecret = process.env.FACEBOOK_CLIENT_SECRET

const AUTH_ENDPOINT  = "https://www.facebook.com/dialog/oauth"
const TOKEN_ENDPOINT = "https://graph.facebook.com/v19.0/oauth/access_token"
const GRAPH_ME       = "https://graph.facebook.com/v19.0/me"

const SCOPES = ["email", "public_profile"]

/**
 * Build the Facebook authorization URL.
 */
function buildAuthUrl({ state, redirectUri, loginHint }) {
  if (!clientId) throw new Error("FACEBOOK_CLIENT_ID is not configured on the API server")
  if (!state) throw new Error("state is required")

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    scope:         SCOPES.join(","),
    state,
    response_type: "code",
    auth_type:     "rerequest", // re-ask for any denied permissions
  })

  if (loginHint) params.set("login_hint", loginHint)

  return `${AUTH_ENDPOINT}?${params.toString()}`
}

/**
 * Exchange the authorization code for a Facebook user profile.
 */
async function exchangeCodeForProfile({ code, redirectUri }) {
  if (!clientId || !clientSecret) {
    throw new Error("FACEBOOK_CLIENT_ID and FACEBOOK_CLIENT_SECRET must both be set")
  }
  if (!code) throw new Error("Missing OAuth code")

  // Step 1: Exchange code for access token
  const tokenResponse = await axios.get(TOKEN_ENDPOINT, {
    params: {
      client_id:     clientId,
      client_secret: clientSecret,
      redirect_uri:  redirectUri,
      code,
    },
  })

  const { access_token } = tokenResponse.data
  if (!access_token) throw new Error("Facebook did not return an access token")

  // Step 2: Fetch user profile — request only what we need
  const profileResponse = await axios.get(GRAPH_ME, {
    params: {
      fields:       "id,name,email,picture.type(large)",
      access_token,
    },
  })

  const profile = profileResponse.data
  const email = (profile.email || "").toLowerCase().trim()

  if (!email) {
    throw new Error(
      "Facebook account did not return an email. " +
      "Ensure the app has the 'email' permission and the account has a verified email.",
    )
  }

  return {
    facebookId:    profile.id,
    email,
    fullName:      profile.name || email.split("@")[0],
    avatarUrl:     profile.picture?.data?.url || null,
    emailVerified: true, // Facebook only returns email when it is verified
  }
}

/**
 * Find an existing user by facebookId or email, or create a new one.
 */
async function findOrCreateFacebookUser(profile) {
  // 1. Try by facebookId
  let user = await prisma.user.findFirst({
    where: { facebookId: profile.facebookId },
    include: { profile: true },
  })

  if (user) {
    return prisma.user.update({
      where: { id: user.id },
      data: {
        avatarUrl:    profile.avatarUrl || user.avatarUrl,
        authProvider: "facebook",
        lastLoginAt:  new Date(),
      },
      include: { profile: true },
    })
  }

  // 2. Fall back to email match
  user = await prisma.user.findUnique({ where: { email: profile.email } })

  if (user) {
    return prisma.user.update({
      where: { id: user.id },
      data: {
        facebookId:   profile.facebookId,
        avatarUrl:    profile.avatarUrl || user.avatarUrl,
        authProvider: "facebook",
        status:       "active",
        lastLoginAt:  new Date(),
      },
      include: { profile: true },
    })
  }

  // 3. Create new user
  return prisma.user.create({
    data: {
      fullName:     profile.fullName,
      email:        profile.email,
      facebookId:   profile.facebookId,
      avatarUrl:    profile.avatarUrl,
      authProvider: "facebook",
      passwordHash: null,
      status:       "active",
      lastLoginAt:  new Date(),
      profile:      { create: {} },
    },
  })
}

module.exports = {
  buildAuthUrl,
  exchangeCodeForProfile,
  findOrCreateFacebookUser,
}
