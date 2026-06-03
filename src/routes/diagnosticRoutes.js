const express = require("express")
const { submitDiagnostic } = require("../controllers/diagnosticController")

const router = express.Router()

// POST /api/v1/diagnostic-submission
// Public — no auth required. Rate-limited by the global /api limiter.
router.post("/diagnostic-submission", submitDiagnostic)

module.exports = router
