const express = require("express")
const { submitDiagnostic, listSubmissions } = require("../controllers/diagnosticController")
const { protect, adminOnly } = require("../middleware/authMiddleware")

const router = express.Router()

// POST /api/v1/diagnostic-submission  — public, no auth
router.post("/diagnostic-submission", submitDiagnostic)

// GET  /api/v1/admin/diagnostic        — admin only
router.get("/admin/diagnostic", protect, adminOnly, listSubmissions)

module.exports = router
