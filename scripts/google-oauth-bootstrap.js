#!/usr/bin/env node
/**
 * scripts/google-oauth-bootstrap.js · one-time refresh-token issuer
 *
 * Run this ONCE — after you've created OAuth credentials in Google Cloud
 * Console — to obtain a long-lived refresh token. Paste the printed token
 * into .env.production as GOOGLE_OAUTH_REFRESH_TOKEN and never run this
 * again unless the token is revoked.
 *
 * Usage:
 *   node scripts/google-oauth-bootstrap.js
 *
 * Required env vars (set in .env, NOT .env.production yet):
 *   GOOGLE_OAUTH_CLIENT_ID
 *   GOOGLE_OAUTH_CLIENT_SECRET
 *   GOOGLE_OAUTH_REDIRECT_URI  (default: http://localhost:5000/api/v1/admin/google/oauth-callback)
 *
 * What it does:
 *   1. Builds the OAuth consent URL with the calendar.events scope
 *   2. Prints the URL — you open it in a browser, sign in as
 *      hello@mustaphaukizuru.com, and click Allow
 *   3. Google redirects to your redirect URI with `?code=…`
 *   4. You paste the FULL redirect URL back into this terminal
 *   5. Script exchanges the code for tokens and prints the refresh token
 *
 * Why not auto-start a local HTTP server to catch the redirect:
 *   - This is a one-shot operation; the manual paste is simpler and works
 *     even when you're bootstrapping from a remote SSH session where
 *     you can't open localhost.
 *   - No port conflict with the live API server.
 */

require("dotenv").config()
const readline = require("node:readline")
const { google } = require("googleapis")

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"]

function fatal(message) {
  console.error(`\n[bootstrap] ${message}\n`)
  process.exit(1)
}

const clientId     = process.env.GOOGLE_OAUTH_CLIENT_ID
const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
const redirectUri  = process.env.GOOGLE_OAUTH_REDIRECT_URI
  || "http://localhost:5000/api/v1/admin/google/oauth-callback"

if (!clientId)     fatal("GOOGLE_OAUTH_CLIENT_ID is not set. Add it to .env first.")
if (!clientSecret) fatal("GOOGLE_OAUTH_CLIENT_SECRET is not set. Add it to .env first.")

const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

const authUrl = oauth2.generateAuthUrl({
  // 'offline' is REQUIRED to get a refresh_token. Without it, Google issues
  // only a short-lived access token and the integration can't keep working
  // after the first hour.
  access_type: "offline",
  scope:       SCOPES,
  // 'consent' forces the consent screen on every run so we always get a
  // refresh_token in the response, even after the user has consented before.
  prompt:      "consent",
})

console.log("\n══════════════════════════════════════════════════════════════════════")
console.log("  Step 1 · Open this URL in your browser:")
console.log("══════════════════════════════════════════════════════════════════════\n")
console.log("  " + authUrl + "\n")
console.log("  · Sign in as hello@mustaphaukizuru.com when prompted.")
console.log("  · Click 'Allow' to grant calendar.events access.")
console.log("  · You'll be redirected to a URL that LOOKS BROKEN (it points")
console.log("    at your redirect URI which doesn't have a server right now)")
console.log("    — that's expected. Copy the FULL URL from the browser bar.\n")
console.log("══════════════════════════════════════════════════════════════════════")
console.log("  Step 2 · Paste the full redirect URL below (then press Enter):")
console.log("══════════════════════════════════════════════════════════════════════\n")

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
rl.question("Redirect URL: ", async (input) => {
  rl.close()
  const trimmed = String(input || "").trim()
  if (!trimmed) fatal("No URL provided.")

  let code = null
  try {
    const url = new URL(trimmed)
    code = url.searchParams.get("code")
  } catch {
    // Maybe they pasted just the code; tolerate that.
    code = trimmed.includes("=") ? null : trimmed
  }
  if (!code) fatal("Couldn't find ?code= in the URL. Paste the full redirect URL.")

  try {
    const { tokens } = await oauth2.getToken(code)
    if (!tokens.refresh_token) {
      fatal(
        "No refresh_token in the response. This usually means Google has\n" +
        "  already remembered your consent. Revoke the app at\n" +
        "  https://myaccount.google.com/permissions, then re-run this script."
      )
    }
    console.log("\n══════════════════════════════════════════════════════════════════════")
    console.log("  ✓  Success — paste this into .env.production:")
    console.log("══════════════════════════════════════════════════════════════════════\n")
    console.log(`  GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}\n`)
    console.log("  (Also keep GOOGLE_OAUTH_CLIENT_ID + _SECRET in the same env file.)\n")
    process.exit(0)
  } catch (err) {
    fatal(`Token exchange failed: ${err?.message || err}`)
  }
})
