#!/usr/bin/env node
/**
 * scripts/prisma-generate.js — `prisma generate`, with the engine type chosen
 * per environment. Runs from `postinstall`.
 *
 * WHY THIS EXISTS
 *
 * Production (Hostinger, CloudLinux) repeatedly panics with
 * "PANIC: timer has gone away" on the first query of a fresh process. That is
 * the Rust query engine's tokio runtime dying inside the node process, and it
 * is unrecoverable in-process: the native library is loaded once per process,
 * so no amount of reconnecting brings it back. The only cure is a new process.
 *
 * Prisma's "binary" engine runs the query engine as a SEPARATE process, so
 * that crash can no longer take the API down with it. It is a real fix — but
 * baking `engineType = "binary"` into schema.prisma made the Jest suite go
 * from ~90s to over seven minutes (an engine process per client, in every
 * worker) with two tests timing out. Too high a price on every developer and
 * every CI run for a symptom that only appears on one host.
 *
 * So the choice is made here instead: production gets the crash-immune binary
 * engine, development and CI keep the fast library engine.
 *
 * Overrides, in order of precedence:
 *   1. PRISMA_CLIENT_ENGINE_TYPE already set → respected untouched, so the
 *      operator can force either engine from the host env without a deploy.
 *   2. NODE_ENV=production → binary.
 *   3. otherwise → library (Prisma's default).
 */
const { spawnSync } = require("child_process")

/**
 * @param {NodeJS.ProcessEnv} env
 * @returns {{ engineType: "binary"|"library", reason: string }}
 */
function chooseEngineType(env = process.env) {
  const explicit = env.PRISMA_CLIENT_ENGINE_TYPE
  if (explicit) return { engineType: explicit, reason: "explicit PRISMA_CLIENT_ENGINE_TYPE" }
  if (env.NODE_ENV === "production") {
    return { engineType: "binary", reason: "production — survives an engine panic in a separate process" }
  }
  return { engineType: "library", reason: "development/CI — keeps the test suite fast" }
}

module.exports = { chooseEngineType }

// Only run the generate when invoked as a script; requiring this file (the
// test does) must have no side effects.
if (require.main === module) {
  const { engineType, reason } = chooseEngineType()

  console.log(`[prisma-generate] engine: ${engineType} (${reason})`)

  const npx = process.platform === "win32" ? "npx.cmd" : "npx"
  const result = spawnSync(npx, ["prisma", "generate"], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, PRISMA_CLIENT_ENGINE_TYPE: engineType },
  })

  if (result.status !== 0) {
    // Deliberately non-fatal: a host that cannot reach Prisma's binary CDN must
    // still finish `npm install` and start with the client it already has,
    // rather than failing the deploy outright.
    console.error(
      "[prisma-generate] generate failed — the previously generated client is still in place. " +
        "Run it manually once the host can reach binaries.prisma.sh."
    )
  }
}
