const express = require("express")
const { submitDiagnostic, listSubmissions } = require("../controllers/diagnosticController")
const { getOps } = require("../controllers/opsRunbookController")
const { protect, adminOnly } = require("../middleware/authMiddleware")

const router = express.Router()

// POST /api/v1/diagnostic-submission  — public, no auth
router.post("/diagnostic-submission", submitDiagnostic)

// GET  /api/v1/admin/diagnostic        — admin only
router.get("/admin/diagnostic", protect, adminOnly, listSubmissions)

// GET  /api/v1/admin/diagnostic/ops    — admin only · Tier 4 ops runbook (storage, backup, prisma, db, env steps)
router.get("/admin/diagnostic/ops", protect, adminOnly, getOps)

module.exports = router
