#!/usr/bin/env node
/**
 * scripts/exchange-auth-code.js · one-shot refresh-token exchange
 *
 * Companion to scripts/google-oauth-bootstrap.js, with no interactive
 * prompt — takes the OAuth authorization code (the `4/0Ae...` value
 * inside `?code=` on the post-consent redirect URL) as a single
 * command-line argument, exchanges it with Google, and prints the
 * refresh token formatted as a ready-to-paste .env line.
 *
 * Use when the interactive bootstrap got confusing or its prompt got
 * eaten by the wrong terminal (bash bracket-paste, etc.). Same
 * outcome — just a cleaner UX for one-shot operators.
 *
 * Usage (PowerShell or any shell that doesn't choke on slashes):
 *   node scripts/exchange-auth-code.js "4/0AeoWuM-cTS9JMo9v1n...long-string"
 *
 * Accepts EITHER:
 *   - the bare code  → "4/0AeoWuM-..."
 *   - the full URL   → "http://localhost:5000/api/v1/admin/google/oauth-callback?code=4%2F0AeoWuM-...&scope=..."
 */

require("dotenv").config()
const { google } = require("googleapis")

function fatal(msg) {
  console.error(`\n[exchange] ${msg}\n`)
  process.exit(1)
}

const arg = process.argv.slice(2).join(" ").trim()
if (!arg) {
  fatal(
    "Missing the auth code argument.\n" +
    "  Usage:  node scripts/exchange-auth-code.js \"4/0AeoWuM-cTS9JMo9...\"\n" +
    "  You can also paste the full callback URL — the script will extract the ?code= part."
  )
}

// Accept either the bare code or the full callback URL
let code = arg
try {
  const u = new URL(arg)
  const fromUrl = u.searchParams.get("code")
  if (fromUrl) code = fromUrl
} catch {
  /* not a URL — treat the whole arg as the code */
}

if (!code.startsWith("4/")) {
  fatal(
    `Doesn't look like a Google auth code (must start with '4/', got '${code.slice(0, 8)}…').\n` +
    "  Re-run the consent flow in your browser, copy the URL from the address bar after\n" +
    "  Google redirects, and pass the URL or the ?code= value as the argument."
  )
}

const clientId     = process.env.GOOGLE_OAUTH_CLIENT_ID
const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
const redirectUri  = process.env.GOOGLE_OAUTH_REDIRECT_URI
  || "http://localhost:5000/api/v1/admin/google/oauth-callback"

if (!clientId)     fatal("GOOGLE_OAUTH_CLIENT_ID is not set in .env.")
if (!clientSecret) fatal("GOOGLE_OAUTH_CLIENT_SECRET is not set in .env.")

const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

;(async () => {
  console.log("[exchange] sending auth code to Google's /token endpoint …")
  let tokens
  try {
    const res = await oauth2.getToken(code)
    tokens = res.tokens
  } catch (err) {
    const errCode  = err?.response?.data?.error || ""
    const errDesc  = err?.response?.data?.error_description || err?.message || "unknown error"

    if (errCode === "invalid_grant" || /invalid_grant/i.test(String(errDesc))) {
      fatal(
        `Google rejected the code with 'invalid_grant' (HTTP: ${errDesc}).\n\n` +
        `  Why this happens — auth codes are single-use AND expire in ~60 seconds.\n` +
        `  This code is dead. You need a FRESH one. Steps:\n\n` +
        `    1. Open this URL in your browser (don't close the tab):\n` +
        `         node -e \"const{google}=require('googleapis');require('dotenv').config();const o=new google.auth.OAuth2(process.env.GOOGLE_OAUTH_CLIENT_ID,process.env.GOOGLE_OAUTH_CLIENT_SECRET,process.env.GOOGLE_OAUTH_REDIRECT_URI||'http://localhost:5000/api/v1/admin/google/oauth-callback');console.log(o.generateAuthUrl({access_type:'offline',prompt:'consent',scope:['https://www.googleapis.com/auth/calendar.events']}))\"\n\n` +
        `    2. Sign in → 'Continue' past 'unverified' → 'Continue' on consent.\n` +
        `    3. Browser shows the AUTH_MISSING JSON page. Copy the address-bar URL.\n` +
        `    4. WITHIN 60 SECONDS, run:\n` +
        `         node scripts/exchange-auth-code.js \"<paste the URL or just the ?code= value>\"\n`
      )
    }
    if (errCode === "redirect_uri_mismatch" || /redirect_uri_mismatch/i.test(String(errDesc))) {
      fatal(
        `Google rejected the exchange with 'redirect_uri_mismatch'.\n` +
        `  The redirect URI on this script (${redirectUri}) doesn't match what was used\n` +
        `  when the code was issued. Make sure GOOGLE_OAUTH_REDIRECT_URI in .env matches\n` +
        `  one of the Authorized redirect URIs registered on the new OAuth client.`
      )
    }
    fatal(`Token exchange failed (${errCode || "unknown error"}): ${errDesc}`)
  }

  if (!tokens.refresh_token) {
    fatal(
      "Google returned an access token but no refresh_token. This means Google has\n" +
      "  already remembered your consent for this OAuth client + user combo.\n" +
      "  Revoke the app at https://myaccount.google.com/permissions, then re-run\n" +
      "  scripts/google-oauth-bootstrap.js (which uses prompt=consent to force a new\n" +
      "  refresh_token)."
    )
  }

  // Verify the freshly-issued token works before printing it.
  let liveOk = true
  try {
    oauth2.setCredentials({ refresh_token: tokens.refresh_token })
    await oauth2.getAccessToken()
  } catch (verifyErr) {
    liveOk = false
    console.log("\n[exchange] ⚠ Google issued the token but a live verification call failed:")
    console.log("            " + (verifyErr?.response?.data?.error_description || verifyErr?.message || verifyErr))
    console.log("            Printing it anyway — sometimes Google needs a few seconds.\n")
  }

  console.log("\n══════════════════════════════════════════════════════════════════════")
  console.log("  ✓  Success — copy the SINGLE LINE below into .env (replace line 52)")
  console.log("══════════════════════════════════════════════════════════════════════\n")
  console.log("  ┌────────────────────────────────────────────────────────────────────")
  console.log(`  │ GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}`)
  console.log("  └────────────────────────────────────────────────────────────────────\n")
  console.log("  · The token starts with '1//' — it is NOT the '4/...' code you just used.")
  console.log("  · Copy the WHOLE line above (including 'GOOGLE_OAUTH_REFRESH_TOKEN=').")
  console.log("  · Save .env (nodemon will auto-restart your backend).")
  console.log("  · Then verify with:")
  console.log("      node -e \"require('dotenv').config(); const g=require('./src/lib/googleCalendar'); console.log(g.isConfigured(), '|', g.diagnoseConfig())\"")
  console.log("    Expected: true | ok\n")
  if (!liveOk) {
    console.log("  ⚠  Heads-up: the live verification call failed. If `true | ok` still produces 'invalid_grant' on a real booking, re-run scripts/google-oauth-bootstrap.js for a fresh token.\n")
  }
})()
