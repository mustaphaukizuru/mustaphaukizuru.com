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
const fs       = require("node:fs")
const path     = require("node:path")
const readline = require("node:readline")
const { google } = require("googleapis")

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"]

function fatal(message) {
  console.error(`\n[bootstrap] ${message}\n`)
  process.exit(1)
}

/**
 * Parse CLI flags so the operator can pass the auth code (or the full
 * redirect URL) directly, skipping the interactive prompt entirely.
 *
 * Why: the previous interactive-only flow had a sharp failure mode —
 * if the operator hit Enter without the script running, they'd paste
 * the redirect URL into their shell, which interprets `&` as a job
 * separator and silently mangles the URL. With these flags, the call
 * is one atomic command:
 *
 *   npm run google:bootstrap -- --code=4/0Ae...
 *   npm run google:bootstrap -- --redirect-url="http://localhost:5000/api/v1/admin/google/oauth-callback?code=4/0Ae...&scope=..."
 *   npm run google:bootstrap -- --code=4/0Ae... --yes    (skip the [Y/n] write confirm)
 *
 * Supported flags:
 *   --code=<auth-code>          one-time auth code from the redirect URL
 *   --redirect-url=<full-url>   the entire redirect URL — we extract ?code= ourselves
 *   --yes / -y                  skip the "Write to .env? [Y/n]" prompt
 *   --help / -h                 print usage and exit 0
 */
function parseArgs(argv) {
  const out = { code: null, redirectUrl: null, yes: false, help: false }
  for (const raw of argv.slice(2)) {
    if (raw === "--help" || raw === "-h")          { out.help = true;  continue }
    if (raw === "--yes"  || raw === "-y")          { out.yes  = true;  continue }
    if (raw.startsWith("--code="))                  { out.code = raw.slice("--code=".length);          continue }
    if (raw.startsWith("--redirect-url="))          { out.redirectUrl = raw.slice("--redirect-url=".length); continue }
  }
  return out
}

/**
 * Pull the one-time auth code out of either a raw code string or a full
 * redirect URL. Tolerates URL-encoded codes (4%2F…), bare codes (4/…),
 * and the whole redirect-URL form. Returns null if nothing usable.
 */
function extractCode(rawInput) {
  const trimmed = String(rawInput || "").trim()
  if (!trimmed) return null
  // Full URL form — let URL() do the parsing + decoding.
  try {
    const u = new URL(trimmed)
    const code = u.searchParams.get("code")
    if (code) return code
  } catch { /* not a URL — fall through */ }
  // `key=value` form without scheme (e.g. someone copied just "code=4/…")
  if (trimmed.includes("=") && /(^|[?&])code=/.test(trimmed)) {
    const m = trimmed.match(/(?:^|[?&])code=([^&]+)/)
    if (m) {
      try { return decodeURIComponent(m[1]) } catch { return m[1] }
    }
  }
  // Bare code (no `=` at all) — return as-is. URL-decode in case the
  // operator copied a URL-encoded code from somewhere.
  if (!trimmed.includes("=")) {
    try { return decodeURIComponent(trimmed) } catch { return trimmed }
  }
  return null
}

const HELP_TEXT = `
scripts/google-oauth-bootstrap.js · one-time refresh-token issuer

Usage:
  npm run google:bootstrap                           # interactive
  npm run google:bootstrap -- --code=4/0Ae...        # pass the code as a flag
  npm run google:bootstrap -- --redirect-url="..."   # pass the full redirect URL
  npm run google:bootstrap -- --code=4/0Ae... --yes  # also auto-write to .env

Flags:
  --code=<auth-code>       the one-time auth code from the redirect URL
  --redirect-url=<url>     the entire redirect URL Google sent you
  --yes, -y                skip the "Write to .env? [Y/n]" prompt and write
  --help, -h               this message

Required env (read from .env):
  GOOGLE_OAUTH_CLIENT_ID
  GOOGLE_OAUTH_CLIENT_SECRET
  GOOGLE_OAUTH_REDIRECT_URI   (default: http://localhost:5000/api/v1/admin/google/oauth-callback)
`

const ARGS = parseArgs(process.argv)
if (ARGS.help) {
  console.log(HELP_TEXT)
  process.exit(0)
}

const clientId     = process.env.GOOGLE_OAUTH_CLIENT_ID
const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
const redirectUri  = process.env.GOOGLE_OAUTH_REDIRECT_URI
  || "http://localhost:5000/api/v1/admin/google/oauth-callback"

if (!clientId)     fatal("GOOGLE_OAUTH_CLIENT_ID is not set. Add it to .env first.")
if (!clientSecret) fatal("GOOGLE_OAUTH_CLIENT_SECRET is not set. Add it to .env first.")

const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

// A code/redirect-url provided via CLI lets us skip the consent URL print
// and the interactive prompt entirely. We still validate the input shape
// before calling Google so a typo fails locally instead of round-tripping
// to the OAuth endpoint just to be told "malformed".
const codeFromCli = ARGS.code || (ARGS.redirectUrl && extractCode(ARGS.redirectUrl))
const nonInteractive = Boolean(codeFromCli)

if (!nonInteractive) {
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
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const ask = (q) => new Promise((resolve) => rl.question(q, (a) => resolve(a)))

;(async () => {
  try {
    let code = codeFromCli
    if (!code) {
      const input = await ask("Redirect URL: ")
      code = extractCode(input)
      if (!code) fatal("Couldn't find ?code= in the input. Paste the full redirect URL or just the 4/... code.")
    } else {
      console.log(`\n[bootstrap] Using auth code from --${ARGS.code ? "code" : "redirect-url"} flag (length ${code.length})`)
    }

    const { tokens } = await oauth2.getToken(code)
    if (!tokens.refresh_token) {
      fatal(
        "No refresh_token in the response. This usually means Google has\n" +
        "  already remembered your consent. Revoke the app at\n" +
        "  https://myaccount.google.com/permissions, then re-run this script."
      )
    }

    // Verify the token works before persisting it. Catches a revoked
    // client / wrong scope / disabled API right here instead of 24 hours
    // later when a customer tries to book.
    let liveCheckOk = true
    try {
      oauth2.setCredentials({ refresh_token: tokens.refresh_token })
      await oauth2.getAccessToken()
    } catch (verifyErr) {
      liveCheckOk = false
      console.log("\n[bootstrap] ⚠ Got a refresh token but Google rejects it on a live check:")
      console.log("            " + (verifyErr?.response?.data?.error_description || verifyErr?.message || verifyErr))
      console.log("            Saving it anyway — sometimes Google needs a few seconds.\n")
    }

    // Defense in depth — `oauth2.getToken` only returns refresh tokens
    // that start with `1//`. But the entire reason this script exists in
    // its current form is because someone hand-copied a `4/…` auth code
    // into .env and silently broke every booking for weeks. Make it
    // structurally impossible for that to happen again from here.
    const token = tokens.refresh_token
    if (!/^1\/\//.test(token)) {
      fatal(
        "Got a value back from Google that doesn't look like a refresh token " +
        `(starts with '${token.slice(0, 4)}', expected '1//'). Refusing to write it. ` +
        "Re-run this script."
      )
    }

    console.log("\n══════════════════════════════════════════════════════════════════════")
    console.log("  ✓  Got a valid refresh token (starts with '1//', " + token.length + " chars)")
    console.log("══════════════════════════════════════════════════════════════════════\n")

    // ─────────────────────────────────────────────────────────────
    // Auto-write the token into .env / .env.production.
    //
    // The previous workflow ("copy this line into .env yourself") is
    // exactly how the `4/…` auth code ended up in production — the
    // operator copy-pasted from the redirect URL instead of from the
    // line below. Writing the file ourselves removes the trap.
    // ─────────────────────────────────────────────────────────────
    const repoRoot = path.resolve(__dirname, "..")
    const candidates = [".env", ".env.production"]
      .map((f) => ({ name: f, abs: path.join(repoRoot, f) }))
      .filter(({ abs }) => fs.existsSync(abs))

    if (candidates.length === 0) {
      console.log("No .env or .env.production found in the repo root.")
      console.log("Copy this line into your environment configuration manually:\n")
      console.log(`  GOOGLE_OAUTH_REFRESH_TOKEN=${token}\n`)
      rl.close()
      process.exit(0)
    }

    console.log("Found env file(s) in the repo root:")
    candidates.forEach((c) => console.log(`  · ${c.name}`))

    let answer = "y"
    if (ARGS.yes) {
      console.log("\n--yes supplied · writing without confirmation.")
    } else {
      answer = (await ask("\nWrite the new refresh token into all of these now? [Y/n]: ")).trim().toLowerCase()
    }
    rl.close()

    if (answer === "n" || answer === "no") {
      console.log("\nSkipped writing. Copy this line into your env configuration manually:\n")
      console.log(`  GOOGLE_OAUTH_REFRESH_TOKEN=${token}\n`)
      process.exit(0)
    }

    for (const { name, abs } of candidates) {
      const original = fs.readFileSync(abs, "utf8")
      // Preserve the original line ending style if we can detect it.
      const eol = original.includes("\r\n") ? "\r\n" : "\n"
      const linePattern = /^GOOGLE_OAUTH_REFRESH_TOKEN=.*$/m
      let next
      if (linePattern.test(original)) {
        next = original.replace(linePattern, `GOOGLE_OAUTH_REFRESH_TOKEN=${token}`)
      } else {
        // Append with a leading EOL if the file doesn't already end in one.
        const sep = original.endsWith("\n") ? "" : eol
        next = `${original}${sep}GOOGLE_OAUTH_REFRESH_TOKEN=${token}${eol}`
      }
      // Safety: write to a sibling temp file then rename, so a crash mid-write
      // never leaves a half-truncated .env.
      const tmp = abs + ".tmp"
      fs.writeFileSync(tmp, next, { encoding: "utf8" })
      fs.renameSync(tmp, abs)
      console.log(`  ✓  ${name} updated`)
    }

    console.log("\n══════════════════════════════════════════════════════════════════════")
    console.log("  Done. Next steps:")
    console.log("══════════════════════════════════════════════════════════════════════\n")
    console.log("  1. Verify the integration end-to-end:")
    console.log("       npm run google:verify")
    console.log("     Expected: every step prints ✓ and ends with 'All checks passed'.\n")
    console.log("  2. Restart your backend (PM2 / docker / nodemon) so the new value loads.\n")
    console.log("  3. Heal any consultations booked while the token was broken:")
    console.log("       npm run consultations:heal-links\n")
    if (!liveCheckOk) {
      console.log("  ⚠  Heads-up: the live verification call inside this script failed.")
      console.log("     If `npm run google:verify` also fails after the restart, re-run this bootstrap.\n")
    }
    process.exit(0)
  } catch (err) {
    fatal(`Token exchange failed: ${err?.message || err}`)
  }
})()
