/**
 * src/jobs/emailRetryJob.js
 *
 * Re-sends EmailLog rows that failed with a transient SMTP error.
 * emailService marks such rows `failed` with `nextAttemptAt` and a stored
 * `payload`; this pass (every 5 min via scheduler) picks up rows whose
 * retry time has come and hands them back to emailService.retryEmailLog,
 * which updates the same row (attempts++, sent / failed / next backoff).
 *
 * Policy (see emailService): 5 min × 2^(attempts-1) backoff, max 3 attempts.
 * Permanent failures never carry a nextAttemptAt, so they are never seen here.
 */

const prisma = require("../lib/prisma")
const logger = require("../utils/logger")
const emailService = require("../services/emailService")

const BATCH_SIZE = 50

async function runEmailRetryPass({ now = new Date(), batchSize = BATCH_SIZE } = {}) {
  const summary = { picked: 0, sent: 0, failed: 0, rescheduled: 0 }

  let due = []
  try {
    due = await prisma.emailLog.findMany({
      where: {
        status:        "failed",
        nextAttemptAt: { lte: now },
        attempts:      { lt: emailService.MAX_ATTEMPTS },
        payload:       { not: null },
      },
      orderBy: { nextAttemptAt: "asc" },
      take:    batchSize,
    })
  } catch (err) {
    logger.error("[emailRetry] findMany failed", err)
    return summary
  }

  summary.picked = due.length
  if (!due.length) return summary

  for (const log of due) {
    try {
       
      const result = await emailService.retryEmailLog(log)
      if (result?.ok) summary.sent += 1
      else if (result?.willRetry) summary.rescheduled += 1
      else summary.failed += 1
    } catch (err) {
      // retryEmailLog never throws by contract; belt and braces.
      summary.failed += 1
      logger.error(`[emailRetry] unexpected error retrying ${log.id}`, err)
    }
  }

  logger.info(`[emailRetry] picked=${summary.picked} sent=${summary.sent} rescheduled=${summary.rescheduled} failed=${summary.failed}`)
  return summary
}

module.exports = { runEmailRetryPass, BATCH_SIZE }
