#!/usr/bin/env node
/**
 * dev-demo — boot the API against the LOCAL demo database, on its own port.
 *
 *   npm run dev:demo          # API  on :5001, local MySQL :3307
 *   cd web && npm run dev:demo   # SPA on :5174, pointed at :5001
 *
 * WHY A SEPARATE STACK
 * --------------------
 * `.env` points at the production Hostinger database, so a normal `npm run dev`
 * on :5000 serves production data — which is almost empty, and is why the
 * storefront renders "0 products" locally. Rather than make you edit `.env` and
 * remember to change it back, this runs a second API alongside your usual one:
 * :5000 keeps doing whatever it was doing, :5001 serves the demo dataset.
 *
 * WHY A .js FILE AND NOT AN INLINE npm SCRIPT
 * -------------------------------------------
 * `VAR=value node src/server.js` is a POSIX-ism. npm on Windows runs scripts
 * through cmd.exe, where that prefix is a syntax error, and this is a
 * Windows-primary project. Setting process.env here works everywhere without
 * adding cross-env as a dependency.
 *
 * SAFETY
 * ------
 * Refuses a non-local DATABASE_URL, exactly like seed:demo and for the same
 * reason: this port is where you go to look at invented customers and invented
 * revenue, and pointing it at production would show them next to real ones. An
 * explicit DATABASE_URL in the environment wins over the default below, so the
 * check runs on whatever is actually about to be used.
 */

const path = require("path")

const DEFAULTS = {
  DATABASE_URL: "mysql://muk:muk@127.0.0.1:3307/muk_dev",
  PORT:         "5001",
  NODE_ENV:     "development",
  // CLIENT_URL — not FRONTEND_URL — is what feeds the CORS allow-list in
  // src/config/env.js. Setting the wrong one leaves the browser with no
  // Access-Control-Allow-Origin header while curl still looks perfectly fine.
  CLIENT_URL:   "http://localhost:5174",
  FRONTEND_URL: "http://localhost:5174",
  // The scheduler would try to mail 200 @demo.test subscribers and every
  // abandoned cart. `.test` is unroutable so nothing escapes, but each attempt
  // still burns an SMTP timeout.
  DISABLE_CRON: "1",
}

for (const [key, value] of Object.entries(DEFAULTS)) {
  if (!process.env[key]) process.env[key] = value
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "host.docker.internal"])

function hostFromUrl(raw) {
  if (!raw) return null
  try {
    return new URL(raw).hostname || null
  } catch {
    const m = /@([^/:]+)/.exec(raw)
    return m ? m[1] : null
  }
}

const host = hostFromUrl(process.env.DATABASE_URL)
if (!host || !(LOCAL_HOSTS.has(host) || host.endsWith(".local"))) {
  console.error("")
  console.error("  x dev:demo refuses a non-local database.")
  console.error(`    DATABASE_URL host: ${host || "(unset)"}`)
  console.error("")
  console.error("    This port exists to display demo data. Start the local MySQL with")
  console.error("      docker compose -f docker-compose.dev.yml up -d")
  console.error("    and see docs/LOCAL_DEV_DB.md. To run against production, use")
  console.error("    the normal `npm run dev` on :5000.")
  console.error("")
  process.exit(1)
}

console.log(`[dev:demo] API   http://localhost:${process.env.PORT}`)
console.log(`[dev:demo] DB    ${host} (local)`)
console.log(`[dev:demo] SPA   ${process.env.CLIENT_URL}  ->  cd web && npm run dev:demo`)
console.log(`[dev:demo] cron  disabled`)

require(path.join(__dirname, "..", "src", "server.js"))
