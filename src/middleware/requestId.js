/**
 * requestId.js — one id per request, visible everywhere, echoed to the client.
 *
 * - Honours an inbound X-Request-Id so a caller (or a proxy in front of
 *   Passenger) can correlate their own trace with ours. It is treated as
 *   UNTRUSTED input: bounded to 8–128 chars of a safe charset, otherwise
 *   replaced. A hostile value must never reach a log line or a header as-is.
 * - Otherwise mints a UUID. crypto.randomUUID is built in on Node >= 18;
 *   package.json pins >= 20.
 * - Sets req.id and X-Request-Id on the response, so a customer reporting
 *   "something went wrong" can quote an id that lands in the logs.
 * - Runs the rest of the middleware chain inside the request context so
 *   every logger call downstream carries the id automatically.
 */

const crypto = require("crypto")
const { runWithContext } = require("../lib/requestContext")

const SAFE_ID = /^[A-Za-z0-9._:-]{8,128}$/

function requestId(req, res, next) {
  const inbound = req.get("X-Request-Id")
  const id = typeof inbound === "string" && SAFE_ID.test(inbound) ? inbound : crypto.randomUUID()

  const startedAt = Date.now()
  req.id = id
  // Read by the access-log `slow` token in app.js — morgan computes its own
  // :response-time internally and does not expose it to other tokens.
  req.startedAt = startedAt
  res.setHeader("X-Request-Id", id)

  runWithContext({ requestId: id, startedAt }, () => next())
}

module.exports = { requestId, SAFE_ID }
