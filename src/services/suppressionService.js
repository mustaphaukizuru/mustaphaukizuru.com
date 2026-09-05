const prisma = require("../lib/prisma")
const logger = require("../utils/logger")

/**
 * suppressionService.js · addresses that must never be mailed again (T3-5).
 *
 * A subscriber's `status` says whether they want the newsletter. This says
 * whether we may send to the address at all — a different question with
 * different sources: a one-click unsubscribe, a hard bounce, a spam
 * complaint, an operator adding one by hand. None of those should depend on
 * a row existing in a list the address may never have been on.
 *
 * It is checked in the AUDIENCE queries rather than at send time, so a
 * suppressed address does not appear in the count the operator approves
 * either. "Send to 1,200 people" should be the number who will receive it.
 */

const REASONS = ["unsubscribe", "bounce", "complaint", "manual"]

const normalise = (email) => String(email || "").trim().toLowerCase()

/**
 * Suppress an address. Idempotent — a second complaint about the same
 * address is not an error, and the FIRST reason is kept because it is the
 * one that explains how they left.
 */
async function suppress(email, { reason = "manual", detail = null } = {}) {
  const value = normalise(email)
  if (!value) return null
  const safeReason = REASONS.includes(reason) ? reason : "manual"
  try {
    return await prisma.suppressionList.upsert({
      where:  { email: value },
      create: { email: value, reason: safeReason, detail: detail ? String(detail).slice(0, 500) : null },
      update: {},
    })
  } catch (err) {
    logger.error(`[suppression] could not suppress ${value}: ${err.message}`)
    return null
  }
}

/** Is this one address suppressed? */
async function isSuppressed(email) {
  const value = normalise(email)
  if (!value) return false
  try {
    return Boolean(await prisma.suppressionList.findUnique({ where: { email: value }, select: { id: true } }))
  } catch {
    // A failed lookup must not become "send it anyway". On an error the safe
    // answer is that we do not know, and skipping one campaign email is
    // cheaper than mailing somebody who asked us not to.
    return true
  }
}

/**
 * Which of these addresses are suppressed, as a Set — so a page of an
 * audience is filtered in one query rather than one per recipient.
 */
async function suppressedSet(emails = []) {
  const values = [...new Set(emails.map(normalise).filter(Boolean))]
  if (!values.length) return new Set()
  try {
    const rows = await prisma.suppressionList.findMany({
      where:  { email: { in: values } },
      select: { email: true },
    })
    return new Set(rows.map((r) => r.email))
  } catch (err) {
    logger.error(`[suppression] lookup failed: ${err.message}`)
    // Same reasoning as isSuppressed, at page scale.
    return new Set(values)
  }
}

/** Total suppressed, for the audience preview. */
async function suppressedCount() {
  try {
    return await prisma.suppressionList.count()
  } catch {
    return 0
  }
}

module.exports = { REASONS, suppress, isSuppressed, suppressedSet, suppressedCount, normalise }
