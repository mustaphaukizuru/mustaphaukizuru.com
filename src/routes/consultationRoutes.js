// ─────────────────────────────────────────────────────────────────────────────
// consultationRoutes.js  (mounted at /api/v1/consultations — POST / is soft-auth, rest member-protected)
// ─────────────────────────────────────────────────────────────────────────────

const express = require("express")
const { protect, attachUserIfPresent } = require("../middleware/authMiddleware")
const { paymentRateLimiter } = require("../middleware/rateLimiter")
const {
  create,
  listMine,
  getById,
  reschedule,
  cancel,
  lookupByToken,
} = require("../controllers/consultationController")

const router = express.Router()

// Public guest-link lookup (no auth — token-scoped)
router.get("/by-token/:token", lookupByToken)

// Guest booking (Tier 3) · POST / is soft-auth, exactly like POST /orders:
// a signed-in member books as themselves, an anonymous visitor supplies
// customerName + customerEmail and gets a claimable passwordless account.
// attachUserIfPresent (not protect) so a missing/stale session never blocks
// the hero CTA. CSRF: the guard only fires when a mu_session cookie is
// present, so cookie-less guest POSTs pass and signed-in POSTs keep the
// double-submit check (see src/middleware/csrf.js).
//
// Rate limit · the consultation create endpoint reuses paymentRateLimiter
// (10/hour/user) since both flows can trigger an email per call and write
// to a row that's expensive to undo. Reschedule/cancel are intentionally
// NOT rate-limited — they're corrective actions a customer might perform
// back-to-back if a slot they thought was free is taken.
router.post("/",                  attachUserIfPresent, paymentRateLimiter, create)

// All other endpoints require authentication
router.use(protect)
router.get("/",                   listMine)
router.get("/:id",                getById)
router.patch("/:id/reschedule",   reschedule)
router.delete("/:id",             cancel)

module.exports = router
