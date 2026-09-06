const express = require("express")
const { newsletterRateLimiter } = require("../middleware/rateLimiter")
const c = require("../controllers/newsletterController")

const router = express.Router()

/**
 * Public newsletter endpoints (B07).
 *
 *   POST /api/newsletter/subscribe       → email + optional name + source
 *   GET  /api/newsletter/confirm/:token      → double opt-in, redirects to /unsubscribed?state=confirmed
 *   GET  /api/newsletter/unsubscribe/:token  → redirects to /unsubscribed
 */

router.post("/subscribe",          newsletterRateLimiter, c.subscribe)
router.get("/confirm/:token",      c.confirm)
router.get("/unsubscribe/:token",  c.unsubscribe)
// T3-5 · RFC 8058 one-click. A mail client POSTs here with no cookie, no
// referer and no user present, so it answers 200 with an empty body rather
// than redirecting — there is no browser to redirect. CSRF-exempt by
// construction: the request carries no ambient credential (see
// middleware/csrf.js, which only challenges a request that arrives WITH a
// session or portal cookie).
router.post("/unsubscribe/:token", c.unsubscribeOneClick)

module.exports = router
