#!/usr/bin/env node
/**
 * guard-prod-db.js — refuse destructive Prisma work against a remote database.
 *
 * WHY
 * ---
 * `.env` on developer machines points at the PRODUCTION Hostinger MySQL. There
 * is no dev database. That means a reflexive `npx prisma db push` or a seed
 * script rewrites live customer data, and `db push --accept-data-loss` will
 * drop columns without asking twice. The README already says never to do this;
 * a README does not stop a tired reflex at 1am.
 *
 * WHAT IT DOES
 * ------------
 * Exits 1 unless DATABASE_URL points at a local host. Deliberately allow-list
 * based (localhost / 127.0.0.1 / ::1 / *.local / host.docker.internal) rather
 * than trying to recognise Hostinger: an unknown host should be treated as
 * production, because the failure mode of guessing wrong is destroying real
 * data.
 *
 * Override for the genuinely intended case:
 *
 *   ALLOW_PROD_DB=1 npm run db:push
 *
 * Typing that is the point — it makes touching production a decision rather
 * than a default.
 *
 * TWO ENTRY POINTS
 * ----------------
 * As a CLI it front-runs an npm script (`node scripts/guard-prod-db.js "db
 * push" && …`). As a module it exports `assertLocalDatabase(action)` so a
 * script can guard ITSELF. Both matter: the npm wrapper is skipped entirely by
 * `node prisma/seed/portfolio-seed.js`, which is a normal thing to type and
 * which used to walk straight past the guard into the production database.
 */

require("dotenv").config()

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "host.docker.internal"])

function hostFromUrl(raw) {
  if (!raw) return null
  try {
    // mysql://user:pass@host:port/db — the URL parser handles this fine, but
    // passwords with unescaped characters can throw, hence the fallback.
    return new URL(raw).hostname || null
  } catch {
    const m = /@([^/:]+)/.exec(raw)
    return m ? m[1] : null
  }
}

function isLocal(host) {
  if (!host) return false
  return LOCAL_HOSTS.has(host) || host.endsWith(".local")
}

/**
 * Throw unless DATABASE_URL is local (or ALLOW_PROD_DB=1 was set deliberately).
 * For in-process use at the top of a script that writes to the database.
 */
function assertLocalDatabase(action = "this script") {
  const url = process.env.DATABASE_URL
  const host = hostFromUrl(url)

  if (!url) throw new Error(`guard-prod-db: DATABASE_URL is not set. Refusing to run ${action}.`)
  if (process.env.ALLOW_PROD_DB === "1") {
    console.warn(`⚠️  guard-prod-db: ALLOW_PROD_DB=1 — running ${action} against ${host}.`)
    return
  }
  if (isLocal(host)) return

  // Exit rather than throw: the reader needs the two recovery steps, not a
  // stack trace through a script they did not write.
  console.error("")
  console.error(`✖ guard-prod-db: DATABASE_URL points at "${host}", which is not a local host.`)
  console.error(`  Refusing to run ${action} — this would modify live data.`)
  console.error("")
  console.error("  If that is genuinely what you want:")
  console.error("    1. node scripts/backup-db-json.js")
  console.error("    2. ALLOW_PROD_DB=1 <your command>")
  console.error("")
  process.exit(1)
}

function main() {
  const url = process.env.DATABASE_URL
  const host = hostFromUrl(url)
  const action = process.argv.slice(2).join(" ") || "this command"

  if (!url) {
    console.error("✖ guard-prod-db: DATABASE_URL is not set. Refusing to run " + action + ".")
    process.exit(1)
  }

  if (process.env.ALLOW_PROD_DB === "1") {
    console.warn(`⚠️  guard-prod-db: ALLOW_PROD_DB=1 — running ${action} against ${host}.`)
    console.warn("   Back up first:  node scripts/backup-db-json.js")
    return
  }

  if (isLocal(host)) return

  console.error("")
  console.error(`✖ guard-prod-db: DATABASE_URL points at "${host}", which is not a local host.`)
  console.error(`  Refusing to run ${action} — this would modify live data.`)
  console.error("")
  console.error("  If that is genuinely what you want:")
  console.error("    1. node scripts/backup-db-json.js")
  console.error(`    2. ALLOW_PROD_DB=1 <your command>`)
  console.error("")
  process.exit(1)
}

if (require.main === module) main()

module.exports = { assertLocalDatabase, hostFromUrl, isLocal }
