const jwt = require("jsonwebtoken")

/**
 * jwt.js · the one place a token is signed or verified (T3-5).
 *
 * WHY THIS FILE EXISTS
 *
 * `jwt.verify(token, secret)` with no `algorithms` option accepts whatever
 * algorithm the token's own header names. That is the shape of the classic
 * JWT confusion attacks: a token that says `alg: none`, or one signed with a
 * public key the server treats as an HMAC secret. jsonwebtoken has defended
 * against the worst of those for years, but the defence is "the library
 * currently refuses" rather than "this application only accepts HS256" — and
 * the second is the sentence worth being able to say.
 *
 * There were five verify call sites, each with its own options object. This
 * is one, pinned, and web/eslint.config.js — no, `eslint.config.mjs` at the
 * repo root — forbids importing `jsonwebtoken` anywhere else, so a sixth
 * cannot appear quietly.
 *
 * The secret is read PER CALL rather than at module load: tests set
 * JWT_SECRET in a beforeAll, and reading it at import time would freeze
 * whatever happened to be in the environment when the first require ran.
 */

/** The only algorithm this application signs or accepts. */
const ALGORITHM = "HS256"

function secret() {
  const value = process.env.JWT_SECRET
  if (!value) throw new Error("JWT_SECRET is not set")
  return value
}

/**
 * Verify a token, accepting HS256 and nothing else.
 *
 * Throws exactly what jsonwebtoken throws (TokenExpiredError,
 * JsonWebTokenError), because every caller already branches on those.
 *
 * @param {string} token
 * @param {object} [options] extra verify options; `algorithms` cannot be overridden
 * @returns {object} the decoded payload
 */
function verifyJwt(token, options = {}) {
  return jwt.verify(String(token), secret(), { ...options, algorithms: [ALGORITHM] })
}

/**
 * Sign a payload with the pinned algorithm.
 *
 * @param {object} payload
 * @param {object} [options] jsonwebtoken sign options (expiresIn, etc.)
 */
function signJwt(payload, options = {}) {
  return jwt.sign(payload, secret(), { ...options, algorithm: ALGORITHM })
}

/**
 * Decode WITHOUT verifying. For reading a claim off a token whose signature
 * has already been checked, or off one that is expired on purpose. Never for
 * an authorisation decision.
 */
function decodeJwt(token) {
  return jwt.decode(String(token))
}

module.exports = { verifyJwt, signJwt, decodeJwt, ALGORITHM }
