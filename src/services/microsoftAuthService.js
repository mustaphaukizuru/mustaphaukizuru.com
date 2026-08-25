/**
 * microsoftAuthService.js · Microsoft OAuth 2.0 redirect flow
 * ─────────────────────────────────────────────────────────────────────────
 * Follows the exact same architecture as googleAuthService.js:
 *   buildAuthUrl()         — builds the Microsoft authorization URL
 *   exchangeCodeForProfile() — exchanges the code for user profile data
 *   findOrCreateMicrosoftUser() — upserts the User row in the DB
 *
 * Microsoft OAuth endpoints (multi-tenant, works for personal + work accounts):
 *   Authorization: https://login.microsoftonline.com/common/oauth2/v2.0/authorize
 *   Token:         https://login.microsoftonline.com/common/oauth2/v2.0/token
 *   User info:     https://graph.microsoft.com/v1.0/me
 *
 * Required env vars:
 *   MICROSOFT_CLIENT_ID         — Azure App Registration → Application (client) ID
 *   MICROSOFT_CLIENT_SECRET     — Azure App Registration → Client Secret value
 *   MICROSOFT_OAUTH_REDIRECT_URI — Exact URI registered in Azure portal
 *
 * Setup:
 *   1. Go to portal.azure.com → App registrations → + New registration
 *   2. Supported account types: "Accounts in any organizational directory
 *      and personal Microsoft accounts" (broadest — covers Outlook, Teams, etc.)
 *   3. Redirect URI: https://mustaphaukizuru.com/api/auth/microsoft/callback
 *   4. After creation: copy Application (client) ID → MICROSOFT_CLIENT_ID
 *   5. Certificates & secrets → + New client secret → copy Value → MICROSOFT_CLIENT_SECRET
 */

const axios = require("axios")
const prisma = require("../lib/prisma")

const clientId     = process.env.MICROSOFT_CLIENT_ID
const clientSecret = process.env.MICROSOFT_CLIENT_SECRET

const AUTH_ENDPOINT  = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
const TOKEN_ENDPOINT = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
const GRAPH_ME       = "https://graph.microsoft.com/v1.0/me"

const SCOPES = ["openid", "email", "profile", "User.Read"]

/**
 * Build the Microsoft authorization URL the browser navigates to.
 *
 * @param {{ state: string, nonce: string, redirectUri: string, loginHint?: string }} args
 * @returns {string} Full authorization URL
 */
function buildAuthUrl({ state, nonce, redirectUri, loginHint }) {
  if (!clientId) throw new Error("MICROSOFT_CLIENT_ID is not configured on the API server")
  if (!state || !nonce) throw new Error("state and nonce are required")

  const params = new URLSearchParams({
    client_id:     clientId,
    response_type: "code",
    redirect_uri:  redirectUri,
    scope:         SCOPES.join(" "),
    state,
    nonce,
    response_mode: "query",
    prompt:        "select_account", // always shows account picker
  })

  if (loginHint) params.set("login_hint", loginHint)

  return `${AUTH_ENDPOINT}?${params.toString()}`
}

/**
 * Exchange the authorization code for a Microsoft user profile.
 * Never returns raw tokens — only the normalised profile.
 *
 * @param {{ code: string, redirectUri: string }} args
 * @returns {Promise<{ microsoftId, email, fullName, avatarUrl, emailVerified }>}
 */
async function exchangeCodeForProfile({ code, redirectUri }) {
  if (!clientId || !clientSecret) {
    throw new Error("MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET must both be set")
  }
  if (!code) throw new Error("Missing OAuth code")

  // Step 1: Exchange code for tokens
  const tokenParams = new URLSearchParams({
    client_id:     clientId,
    client_secret: clientSecret,
    code,
    redirect_uri:  redirectUri,
    grant_type:    "authorization_code",
    scope:         SCOPES.join(" "),
  })

  const tokenResponse = await axios.post(TOKEN_ENDPOINT, tokenParams.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  })

  const { access_token } = tokenResponse.data
  if (!access_token) throw new Error("Microsoft did not return an access token")

  // Step 2: Fetch user profile from Microsoft Graph
  const profileResponse = await axios.get(GRAPH_ME, {
    headers: { Authorization: `Bearer ${access_token}` },
    params: { $select: "id,displayName,mail,userPrincipalName" },
  })

  const profile = profileResponse.data
  const email =
    (profile.mail || profile.userPrincipalName || "").toLowerCase().trim()

  if (!email) throw new Error("Microsoft account did not return an email address")

  return {
    microsoftId:   profile.id,
    email,
    fullName:      profile.displayName || email.split("@")[0],
    avatarUrl:     null, // Graph requires a separate /me/photo request — skip for now
    emailVerified: true, // Microsoft accounts are always verified
  }
}

/**
 * Find an existing user by microsoftId or email, or create a new one.
 */
async function findOrCreateMicrosoftUser(profile) {
  // 1. Try to find by microsoftId (most precise)
  let user = await prisma.user.findFirst({
    where: { microsoftId: profile.microsoftId },
    include: { profile: true },
  })

  if (user) {
    return prisma.user.update({
      where: { id: user.id },
      data: {
        avatarUrl:    profile.avatarUrl || user.avatarUrl,
        authProvider: "microsoft",
        lastLoginAt:  new Date(),
      },
      include: { profile: true },
    })
  }

  // 2. Fall back to email match (account exists via different provider)
  user = await prisma.user.findUnique({ where: { email: profile.email } })

  if (user) {
    return prisma.user.update({
      where: { id: user.id },
      data: {
        microsoftId:  profile.microsoftId,
        avatarUrl:    profile.avatarUrl || user.avatarUrl,
        authProvider: "microsoft",
        status:       "active",
        lastLoginAt:  new Date(),
      },
      include: { profile: true },
    })
  }

  // 3. Create a brand-new user
  return prisma.user.create({
    data: {
      fullName:     profile.fullName,
      email:        profile.email,
      microsoftId:  profile.microsoftId,
      avatarUrl:    profile.avatarUrl,
      authProvider: "microsoft",
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
  findOrCreateMicrosoftUser,
}
