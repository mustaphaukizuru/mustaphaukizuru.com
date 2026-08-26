/**
 * requestContext.js — per-request context without threading it by hand.
 *
 * WHY
 * ---
 * Today morgan writes an access line to stdout and, separately, services
 * call logger.info/warn/error with no way to tie the two together. During
 * the 2026-08-25 outage the diagnosis needed SSH and a status script because
 * there was no trail to read: three hypotheses were formed and discarded
 * that a single "requestId=… failed at step X" line would have answered.
 *
 * HOW
 * ---
 * AsyncLocalStorage keeps a store alive across every await inside one
 * request. The requestId middleware calls run() once at the top of the
 * chain; from then on, ANY logger call anywhere in the request — controller,
 * service, a Prisma error three layers down — can read the id with
 * getRequestId() and no function signature has to change. 53 services keep
 * their current code.
 *
 * Outside a request (cron jobs, CLI scripts) the store is empty and
 * getRequestId() returns undefined; the logger simply omits the field.
 */

const { AsyncLocalStorage } = require("async_hooks")

const storage = new AsyncLocalStorage()

/** Run `fn` with `ctx` visible to everything it awaits. */
function runWithContext(ctx, fn) {
  return storage.run(ctx, fn)
}

/** The current request's context object, or undefined outside a request. */
function getContext() {
  return storage.getStore()
}

function getRequestId() {
  return storage.getStore()?.requestId
}

module.exports = { runWithContext, getContext, getRequestId }
