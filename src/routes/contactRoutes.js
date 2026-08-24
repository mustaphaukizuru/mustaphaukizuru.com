const express = require("express");
const {
  sendContactMessage,
  addNewsletterSubscriber,
} = require("../controllers/contactController");

const {
  contactRateLimiter,
  newsletterRateLimiter,
} = require("../middleware/rateLimiter");

const router = express.Router();

// B07 · contact uses its own 3/15-min limiter, newsletter has its own
router.post("/contact",    contactRateLimiter,    sendContactMessage);
router.post("/newsletter", newsletterRateLimiter, addNewsletterSubscriber);

// ─────────────────────────────────────────────────────────────────────────────
// REMOVED · GET /newsletter/unsubscribe?email=
//
// The old email-param unsubscribe ran a raw `prisma.newsletterSubscriber
// .update({ where: { email } })` with no authentication and no token, so
// anyone could unsubscribe any address they could guess, and the distinct
// "not in our subscriber list" response made it a membership oracle for
// enumerating the list.
//
// The token flow already covers this properly:
//   GET /api/v1/newsletter/unsubscribe/:token   (see newsletterRoutes.js)
// and the token is what newsletterService.buildUnsubscribeUrl() has always
// emitted, so no live link depended on the ?email= form.
// ─────────────────────────────────────────────────────────────────────────────

module.exports = router;
