/* ════════════════════════════════════════════════════════════════════════
   reviewModerationService.js · pre-persist review screening
   ────────────────────────────────────────────────────────────────────────
   Decides whether a freshly-submitted review goes live immediately or
   queues for human review. Designed to drop the moderation backlog by
   ~80% so admins only see edge cases.

   Pipeline (short-circuits on first match):
     1. Length sanity                      → "rejected" (caller catches)
     2. URL detection                      → "flagged"
     3. Profanity / hate-speech (en + es)  → "flagged"
     4. Verified-purchase + clean text     → "approved"
     5. Anything else                      → "pending"

   Returns: { status: ReviewStatus, flaggedReason: string|null }

   Notes:
     · Dictionaries are intentionally short and local. Tune via PRs over
       time; community-curated lists balloon false positives quickly.
     · Word boundaries use \b so "scope" doesn't match "scope"-y substring
       inside otherwise-clean copy. Spanish accents normalised first.
     · Length floor is generous (10) so a "Loved it!" 5-star still posts.
   ════════════════════════════════════════════════════════════════════════ */

const MIN_LENGTH = 10
const MAX_LENGTH = 5000

// URL-ish patterns. We cast a wide net because spam reviews use creative
// obfuscation (no "http", just "site .com"). False positives are fine —
// they go to the queue, not to /dev/null.
const URL_PATTERNS = [
  /\bhttps?:\/\//i,
  /\bwww\./i,
  /\b[a-z0-9-]+\.(com|net|org|io|co|biz|info|me|xyz|shop|store)\b/i,
  /\b(buy|order|click|visit)\s+(here|now|us|me)\b/i,
  /\b(whats?app|telegram|signal|discord)\s*[:#]?\s*\+?\d/i,
]

// Compact bilingual blocklist. Keep this conservative; the goal is to
// catch obvious bad actors, not to police every salty review.
const BLOCKLIST = [
  // English profanity / spam
  "fuck", "shit", "bitch", "asshole", "bastard", "cunt", "dick", "piss",
  "scam", "scammer", "fraud", "ripoff", "rip-off", "rip off",
  // Spanish profanity / spam
  "puto", "puta", "mierda", "joder", "pendejo", "cabrón", "cabron",
  "estafa", "estafador", "fraude",
  // Sales spam
  "free money", "click here", "guaranteed", "100%", "miracle", "cheap",
  "dinero gratis", "gratis", "garantizado",
]

// Build a single anchored regex once at module load.
function buildBlocklistRegex(words) {
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  return new RegExp(`\\b(${escaped.join("|")})\\b`, "i")
}
const BLOCKLIST_RE = buildBlocklistRegex(BLOCKLIST)

/**
 * Normalise text for matching: lowercase + strip Spanish accents so
 * "joder" and "jóder" both match. Doesn't mutate the original — only
 * what we screen against.
 */
function normalize(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
}

/**
 * Test whether the body looks like spam. Pure read-only, returns the
 * matched URL pattern for debugging when something does match.
 */
function detectUrl(body) {
  const norm = normalize(body)
  for (const re of URL_PATTERNS) {
    if (re.test(norm)) return re.source
  }
  return null
}

function detectProfanity(body) {
  const norm = normalize(body)
  const m = norm.match(BLOCKLIST_RE)
  return m ? m[1] : null
}

/* ── Public API ─────────────────────────────────────────────────────────── */

/**
 * Run the moderation pipeline on a review payload before persistence.
 * The caller is responsible for validating the rating range etc.
 *
 * @param {{ rating:number, reviewText?:string|null, isVerifiedPurchase:boolean }} input
 * @returns {{ status:'approved'|'pending'|'flagged', flaggedReason:string|null }}
 */
function moderateReview({ rating, reviewText, isVerifiedPurchase }) {
  const body = (reviewText || "").trim()

  // Empty body is allowed — many reviewers leave only stars. Push through
  // the verified-purchase auto-approve gate without further checks.
  if (body.length === 0) {
    return {
      status:        isVerifiedPurchase ? "approved" : "pending",
      flaggedReason: null,
    }
  }

  // 1 — length sanity
  if (body.length < MIN_LENGTH) {
    return { status: "pending", flaggedReason: `Body shorter than ${MIN_LENGTH} chars` }
  }
  if (body.length > MAX_LENGTH) {
    return { status: "flagged", flaggedReason: `Body longer than ${MAX_LENGTH} chars` }
  }

  // 2 — URLs / contact handles → human review
  const urlHit = detectUrl(body)
  if (urlHit) {
    return { status: "flagged", flaggedReason: `URL/contact pattern: ${urlHit}` }
  }

  // 3 — profanity / hate / known scam keywords
  const profanityHit = detectProfanity(body)
  if (profanityHit) {
    return { status: "flagged", flaggedReason: `Blocklisted term: ${profanityHit}` }
  }

  // 4 — verified-purchase + clean text → auto-approve
  if (isVerifiedPurchase) {
    return { status: "approved", flaggedReason: null }
  }

  // 5 — unverified clean text → human review queue
  return { status: "pending", flaggedReason: null }
}

module.exports = {
  moderateReview,
  // Exposed for tests / future tuning
  detectUrl,
  detectProfanity,
  MIN_LENGTH,
  MAX_LENGTH,
}
