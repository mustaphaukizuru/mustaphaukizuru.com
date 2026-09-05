/**
 * trackingCode.js · the short code a client can actually use (T5-1).
 *
 * A cuid is the primary key and always will be, but nobody reads one over the
 * phone or writes one on an invoice. This is the human-facing handle:
 *
 *   MU-7K4C-9XQF
 *
 * ALPHABET — Crockford base32 with the ambiguous glyphs removed rather than
 * remapped: no 0 or O, no 1, I or L, and no U (which turns a random code into
 * an unfortunate word more often than you would expect). 30 symbols are left,
 * and every one of them survives being handwritten on a whiteboard, read
 * aloud on a call, and typed back by someone not looking at the screen.
 *
 * Removing both halves of each confusable pair is what lets the parser refuse
 * an unknown glyph instead of guessing which project was meant.
 *
 * ENTROPY — 8 characters over 30 symbols is 30^8, about 2^39.3. That is not a
 * secret and must never be treated as one: it is a lookup key for a
 * deliberately thin public surface, and the rate limit is what makes guessing
 * impractical rather than the length. See ADR 0006.
 *
 * The formatting hyphen is presentation, but it is stored, because a code
 * that is displayed one way and stored another is a code that gets pasted
 * back and not found.
 */

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ"

const PREFIX = "MU"
const GROUP = 4
const GROUPS = 2
const LENGTH = GROUP * GROUPS

/** Crypto-grade characters. Modulo bias matters here: reject and redraw. */
function randomChars(n) {
  const { randomBytes } = require("crypto")
  const out = []
  // 256 is not a multiple of 30, so bytes at or above the largest multiple
  // would over-represent the first few symbols. Drawing again is cheaper
  // than the alternative and keeps the distribution flat.
  const limit = Math.floor(256 / ALPHABET.length) * ALPHABET.length
  while (out.length < n) {
    for (const byte of randomBytes(n * 2)) {
      if (byte >= limit) continue
      out.push(ALPHABET[byte % ALPHABET.length])
      if (out.length === n) break
    }
  }
  return out.join("")
}

/** A fresh code, e.g. "MU-7K4C-9XQF". */
function generateTrackingCode() {
  const chars = randomChars(LENGTH)
  const groups = []
  for (let i = 0; i < GROUPS; i += 1) groups.push(chars.slice(i * GROUP, (i + 1) * GROUP))
  return `${PREFIX}-${groups.join("-")}`
}

/**
 * What someone typed, as the code we stored — or null.
 *
 * Forgiving about SHAPE, strict about SYMBOLS. Case, spacing, hyphens and a
 * missing prefix are all typing noise and are absorbed. An excluded glyph is
 * not: `0 1 I L O U` never appear in a generated code, so an input carrying
 * one is rejected rather than corrected.
 *
 * That is deliberate and it is the point of the alphabet. A "helpful"
 * mapping — O to Q, I to J — would be inventing a correction, and the thing
 * it resolves to is another valid code, which is to say a different client's
 * project. Ambiguity is designed out at generation so that nothing has to be
 * guessed at lookup.
 */
function normalizeTrackingCode(input) {
  if (typeof input !== "string") return null
  let s = input.trim().toUpperCase().replace(/[\s-]+/g, "")
  if (s.startsWith(PREFIX)) s = s.slice(PREFIX.length)
  if (s.length !== LENGTH) return null
  for (const ch of s) if (!ALPHABET.includes(ch)) return null
  return `${PREFIX}-${s.slice(0, GROUP)}-${s.slice(GROUP)}`
}

/** Does this look like one of ours? Cheap enough to run before a query. */
function isValidTrackingCode(value) {
  return typeof value === "string" && /^MU-[2-9A-HJ-NP-TV-Z]{4}-[2-9A-HJ-NP-TV-Z]{4}$/.test(value)
}

/**
 * Generate and persist, retrying on the unique collision.
 *
 * At 2^39.3 a collision is vanishingly unlikely, which is exactly why the
 * retry has to exist: the one time it happens must not be a 500 on project
 * creation. Same shape as the slug generators elsewhere in this codebase —
 * catch P2002, draw again.
 *
 * @param {(code: string) => Promise<any>} attempt  writes the code, may throw P2002
 */
async function withUniqueTrackingCode(attempt, { retries = 5 } = {}) {
  let lastError = null
  for (let i = 0; i < retries; i += 1) {
    const code = generateTrackingCode()
    try {
      return await attempt(code)
    } catch (err) {
      const isUniqueViolation = err?.code === "P2002"
        && String(err?.meta?.target || "").includes("trackingCode")
      if (!isUniqueViolation) throw err
      lastError = err
    }
  }
  throw lastError || new Error("trackingCode: exhausted retries")
}

module.exports = {
  ALPHABET,
  PREFIX,
  LENGTH,
  generateTrackingCode,
  normalizeTrackingCode,
  isValidTrackingCode,
  withUniqueTrackingCode,
}
