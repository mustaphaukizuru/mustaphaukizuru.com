// ─────────────────────────────────────────────────────────────────────────────
// adminAvailabilityRoutes.js  (mounted at /api/v1/admin — admin-only)
// ─────────────────────────────────────────────────────────────────────────────

const express = require("express")
const { protect, adminOnly } = require("../middleware/authMiddleware")
const {
  getRules, postRule, patchRule, removeRule,
  getExceptions, postException, removeException,
  listConsultations, updateConsultation,
} = require("../controllers/adminAvailabilityController")

const router = express.Router()

// All admin booking routes require admin auth
router.use(protect, adminOnly)

// Availability rules
router.get   ("/availability/rules",         getRules)
router.post  ("/availability/rules",         postRule)
router.patch ("/availability/rules/:id",     patchRule)
router.delete("/availability/rules/:id",     removeRule)

// Availability exceptions
router.get   ("/availability/exceptions",    getExceptions)
router.post  ("/availability/exceptions",    postException)
router.delete("/availability/exceptions/:id", removeException)

// Consultation management
router.get  ("/consultations",      listConsultations)
router.patch("/consultations/:id",  updateConsultation)

module.exports = router
