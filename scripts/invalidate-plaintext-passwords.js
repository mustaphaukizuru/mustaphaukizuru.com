#!/usr/bin/env node
/**
 * invalidate-plaintext-passwords.js
 *
 * One-off security migration. authService.loginUser used to accept a
 * plaintext `passwordHash` as a legacy fallback. That branch is gone; any
 * row whose passwordHash is not a bcrypt hash can no longer log in with a
 * password, so we clear it (forcing "forgot password") and revoke sessions.
 *
 * Usage:
 *   node scripts/invalidate-plaintext-passwords.js          # dry run
 *   node scripts/invalidate-plaintext-passwords.js --apply  # write
 */
require("dotenv").config()
const prisma = require("../src/lib/prisma")

const APPLY = process.argv.includes("--apply")
const BCRYPT_RE = /^\$2[aby]\$\d{2}\$/

async function main() {
  const users = await prisma.user.findMany({
    where: { passwordHash: { not: null } },
    select: { id: true, email: true, passwordHash: true },
  })
  const bad = users.filter((u) => !BCRYPT_RE.test(u.passwordHash || ""))
  console.log(`checked ${users.length} users with a password · ${bad.length} non-bcrypt`)
  for (const u of bad) console.log(`  ${u.email}`)

  if (!APPLY || bad.length === 0) {
    if (!APPLY && bad.length) console.log("\ndry run — re-run with --apply to clear these hashes")
    return
  }
  const now = new Date()
  const res = await prisma.user.updateMany({
    where: { id: { in: bad.map((u) => u.id) } },
    data:  { passwordHash: null, tokensValidFrom: now },
  })
  console.log(`cleared ${res.count} password(s); those users must use "forgot password"`)
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
