#!/usr/bin/env node
/**
 * scripts/db-push.js
 *
 * `npm run db:push [-- <prisma db push flags>]`
 *
 * Runs `prisma db push` with any extra flags the caller passed (for example
 * `--accept-data-loss`), then `prisma generate` WITHOUT those flags. npm
 * appends `--` arguments to the *last* command of a `&&` chain, which used
 * to hand `--accept-data-loss` to `prisma generate` and print its usage
 * text after an otherwise successful push. The guard (scripts/guard-prod-db.js)
 * still runs first from package.json.
 */
const { spawnSync } = require("child_process")

const extra = process.argv.slice(2)
const npx = process.platform === "win32" ? "npx.cmd" : "npx"

function run(args) {
  const r = spawnSync(npx, args, { stdio: "inherit", shell: process.platform === "win32" })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

run(["prisma", "db", "push", ...extra])
run(["prisma", "generate"])
