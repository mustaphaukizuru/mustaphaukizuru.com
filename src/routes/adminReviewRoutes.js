// @ts-check
/* ════════════════════════════════════════════════════════════════════════
   adminReviewRoutes.js · /api/v1/admin/reviews
   ────────────────────────────────────────────────────────────────────────
   Mounted in src/routes/index.js. All routes behind protect + adminOnly,
   plus fine-grained `requirePermission` gates (Brand v3 § 19 governance).

   Until AdminPermission is seeded (`node prisma/seed-permissions.js`) and
   roles are assigned, the legacy super-admin shortcut inside
   requirePermission keeps existing flows working — `req.user.role ===
   "admin"` short-circuits the gate. Once permissions are seeded, only
   roles holding the matching key satisfy the gate.

   Specific paths (/stats, /bulk) declared BEFORE /:id wildcards.
   ════════════════════════════════════════════════════════════════════════ */

const express = require("express")
const c = require("../controllers/adminReviewController")
const { protect, adminOnly } = require("../middleware/authMiddleware")
const { requirePermission } = require("../middleware/requirePermission")
const { PERMISSIONS } = require("../config/permissions")

const router = express.Router()
router.use(protect, adminOnly)

// Read-only review queue — moderate or delete both grant view.
router.get("/stats",
  requirePermission([PERMISSIONS.REVIEW_MODERATE.key, PERMISSIONS.REVIEW_DELETE.key]),
  c.stats,
)
router.get("/",
  requirePermission([PERMISSIONS.REVIEW_MODERATE.key, PERMISSIONS.REVIEW_DELETE.key]),
  c.list,
)
router.get("/:id",
  requirePermission([PERMISSIONS.REVIEW_MODERATE.key, PERMISSIONS.REVIEW_DELETE.key]),
  c.getOne,
)

// Mutating actions
router.post("/bulk",   requirePermission(PERMISSIONS.REVIEW_MODERATE.key), c.bulk)
router.patch("/:id",   requirePermission(PERMISSIONS.REVIEW_MODERATE.key), c.update)
router.delete("/:id",  requirePermission(PERMISSIONS.REVIEW_DELETE.key),   c.remove)

module.exports = router
