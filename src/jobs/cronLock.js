const prisma = require("../lib/prisma")
const logger = require("../utils/logger")

/**
 * cronLock.js · one process runs a job, even when two are running (T3-5).
 *
 * THE PROBLEM
 *
 * `scheduler.js` guards overlap with an in-memory Set, which is exactly as
 * wide as one Node process. Passenger spawns more than one, and each spawns
 * its own scheduler — so at 00:15 every one of them starts the same nightly
 * pass, and the Set in each says "nothing is running here".
 *
 * For most jobs that is waste. For `emailRetryJob` it is a client receiving
 * the same email twice, which is the failure that made this worth fixing:
 * the retry job claims rows by reading them and then updating, and two
 * processes interleaved between the read and the update both send.
 *
 * THE LOCK
 *
 * MySQL's GET_LOCK is a named advisory lock held by a CONNECTION. That last
 * word is the whole difficulty: Prisma's pool hands out whichever connection
 * is free, so a bare `GET_LOCK` on one query and `RELEASE_LOCK` on another
 * can release a lock this process never held — or hold one forever.
 *
 * `$transaction` with a callback is what pins the work to a single
 * connection, so the acquire, the job and the release all happen on the same
 * one. The lock is released by RELEASE_LOCK in the same transaction, and by
 * MySQL itself if the connection dies — which is the property that makes an
 * advisory lock safe to use for this at all: a process killed mid-job does
 * not leave the job locked out forever.
 *
 * TIMEOUT ZERO
 *
 * `GET_LOCK(name, 0)` returns immediately: either this process got it or
 * another has it. Waiting would be wrong — a second process that queues for
 * the lock will run the job again the moment the first finishes, which is
 * the double-run this exists to prevent, just later.
 */

/** MySQL truncates lock names past 64 characters. */
const MAX_NAME = 64

/**
 * Run `fn` while holding a named lock, or skip.
 *
 * @param {string} name  the job's name
 * @param {() => Promise<void>} fn
 * @param {number} [timeoutMs] transaction ceiling; a job that runs past it
 *   releases the lock and is rolled back by MySQL, which is preferable to a
 *   stuck lock
 * @returns {Promise<boolean>} whether the job ran here
 */
async function withCronLock(name, fn, { timeoutMs = 10 * 60_000 } = {}) {
  const lockName = `cron:${name}`.slice(0, MAX_NAME)

  try {
    return await prisma.$transaction(async (tx) => {
      // $queryRaw, not $executeRaw: this reads a value back.
      const rows = await tx.$queryRaw`SELECT GET_LOCK(${lockName}, 0) AS acquired`
      // MySQL returns 1, 0 or NULL (NULL on error). Anything but 1 means
      // somebody else has it, so this process does nothing — including no
      // RELEASE_LOCK, which would be releasing a lock it never held.
      const acquired = Number(rows?.[0]?.acquired) === 1
      if (!acquired) {
        logger.info(`[cronLock] ${name} is running in another process — skipping this tick`)
        return false
      }

      try {
        await fn()
        return true
      } finally {
        // In a finally so a throwing job still gives the lock back. If the
        // release itself fails, the connection closing releases it anyway.
        await tx.$queryRaw`SELECT RELEASE_LOCK(${lockName}) AS released`
          .catch((e) => logger.warn(`[cronLock] ${name}: release failed (${e.message}) — the connection will free it`))
      }
    }, { timeout: timeoutMs, maxWait: 5_000 })
  } catch (err) {
    // A database that cannot even take the lock is not a reason to run the
    // job unguarded — that is precisely the case where two processes are
    // most likely to be flailing at once. Skip and let the next tick try.
    logger.error(`[cronLock] ${name}: could not acquire (${err.message}) — skipping this tick`)
    return false
  }
}

module.exports = { withCronLock }
