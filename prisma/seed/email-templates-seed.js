/**
 * DEPRECATED — DO NOT RUN.
 *
 * This file used kebab-case template keys ("order-confirmation",
 * "download-ready", etc.) that DO NOT match the live system. The
 * canonical seed is `prisma/seed-email-templates.js` (dot.case keys
 * like "order.confirmed"), wired in package.json as `npm run seed:email`.
 *
 * Running this script would overwrite the production templates with
 * stale content keyed under names no controller looks up — silently
 * breaking the post-payment confirmation email and others.
 *
 * Safe to delete this file from disk. Kept here only so a stray
 * `node prisma/seed/email-templates-seed.js` invocation exits without
 * touching the database.
 */
console.error(
  "[email-templates-seed] DEPRECATED — use 'npm run seed:email' instead.\n" +
  "This script no longer modifies the database."
)
process.exit(1)

