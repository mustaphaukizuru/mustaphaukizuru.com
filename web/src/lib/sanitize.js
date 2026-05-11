/**
 * sanitize.js — frontend message hardening
 *
 * Centralised helpers that scrub low-level engine output (Prisma stack
 * traces, ANSI escape codes, file paths) before any error message reaches
 * the user. Anything user-facing should pass through `friendlyMessage()`.
 */

/* eslint-disable no-control-regex */
const ANSI_RE = /\[[0-?]*[ -/]*[@-~]/g
const STRAY_BRACKET_CODE_RE = /\[\d+m/g // [31m, [22m, etc. (no ESC)
const PRISMA_INVALID_RE = /Invalid `prisma\.[\w.]+\(\)`[\s\S]+?Unknown argument `[\w.]+`/i
const PATH_LEAK_RE = /[A-Z]:\\[^\s"']+|\/(?:home|root|var|sessions|Users)\/[^\s"']+/g
/* eslint-enable no-control-regex */

/**
 * Strip ANSI escape codes ([31m, etc.) and any orphaned colour codes
 * that survived a console.log. Common when backend logger output gets
 * forwarded into an error response in dev mode.
 */
export function stripAnsi(input = "") {
  if (typeof input !== "string") return input
  return input
    .replace(ANSI_RE, "")
    .replace(STRAY_BRACKET_CODE_RE, "")
    .replace(//g, "")
    .replace(/ⓢ|�/g, "") // mojibake leftovers from broken UTF-8 decoders
    .trim()
}

/**
 * Strip absolute paths so we never leak `C:\Users\mruki\…` or `/home/…`
 * to the user. Replaces them with a literal "<path>".
 */
export function stripPaths(input = "") {
  if (typeof input !== "string") return input
  return input.replace(PATH_LEAK_RE, "<path>")
}

/**
 * Best-effort detection of low-level engine spew that should never reach
 * the user.
 */
export function looksLikeEngineSpew(input = "") {
  if (typeof input !== "string") return false
  if (PRISMA_INVALID_RE.test(input)) return true
  if (input.includes("PrismaClient")) return true
  if (input.length > 600) return true // ridiculous error length
  if (/|\[3\dm|\[1m|\[22m/.test(input)) return true
  return false
}

/**
 * Convert any backend error message into something the user can read.
 * - Strips ANSI + paths first
 * - If the cleaned string still looks like engine spew, swap it for a
 *   friendly fallback the user can act on
 * - Otherwise return the cleaned message
 */
export function friendlyMessage(input, fallback = "Something went wrong. Please try again.") {
  if (!input) return fallback
  const cleaned = stripPaths(stripAnsi(String(input)))
  if (!cleaned) return fallback
  if (looksLikeEngineSpew(cleaned)) return fallback
  // Prisma sometimes wraps its message in `\n` — collapse whitespace.
  return cleaned.replace(/\s+/g, " ").trim().slice(0, 280)
}

/**
 * Map a status code to a human label when the API didn't supply one.
 *
 * Every common 4xx is mapped now — previously, an unmapped status
 * (notably 400 / 408 / 502 / 503 / 504) fell through to the bland
 * "Request error" string, which is what users were seeing on the
 * dashboard order detail page when the invoice endpoint returned a
 * 400 without a JSON body. Specific labels are friendlier and easier
 * to act on.
 */
export function statusLabel(status = 0) {
  if (status === 0)   return "Network error"
  if (status === 400) return "Bad request"
  if (status === 401) return "Sign-in required"
  if (status === 403) return "Not allowed"
  if (status === 404) return "Not found"
  if (status === 408) return "Request timed out"
  if (status === 409) return "Conflict"
  if (status === 413) return "Too large"
  if (status === 422) return "Validation error"
  if (status === 429) return "Too many requests"
  if (status === 502) return "Connection hiccup"
  if (status === 503) return "Service unavailable"
  if (status === 504) return "Server took too long"
  if (status >= 500)  return "Server error"
  return "Request error"
}
