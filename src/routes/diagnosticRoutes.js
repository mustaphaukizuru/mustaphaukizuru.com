const express = require("express")
const { submitDiagnostic, listSubmissions } = require("../controllers/diagnosticController")
const { protect, adminOnly } = require("../middleware/authMiddleware")
const { diagnosticRateLimiter } = require("../middleware/rateLimiter")

const router = express.Router()

// POST /api/v1/diagnostic-submission  — public, no auth.
// Rate-limited per IP (PDF render + 2 emails per call) and honeypot-checked
// in the controller, mirroring /api/contact.
router.post("/diagnostic-submission", diagnosticRateLimiter, submitDiagnostic)

// GET  /api/v1/admin/diagnostic        — admin only
router.get("/admin/diagnostic", protect, adminOnly, listSubmissions)

module.exports = router
