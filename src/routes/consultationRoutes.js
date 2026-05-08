// ─────────────────────────────────────────────────────────────────────────────
// consultationRoutes.js  (mounted at /api/v1/consultations — member-protected)
// ─────────────────────────────────────────────────────────────────────────────

const express = require("express")
const { protect } = require("../middleware/authMiddleware")
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

// All other endpoints require authentication
router.use(protect)

// Rate limit · the consultation create endpoint reuses paymentRateLimiter
// (10/hour/user) since both flows are member-initiated, can trigger an email
// per call, and write to a row that's expensive to undo. Reschedule/cancel
// are intentionally NOT rate-limited — they're corrective actions a customer
// might perform back-to-back if a slot they thought was free is taken.
router.post("/",                  paymentRateLimiter, create)
router.get("/",                   listMine)
router.get("/:id",                getById)
router.patch("/:id/reschedule",   reschedule)
router.delete("/:id",             cancel)

module.exports = router
