const express = require("express")
const { submitDiagnostic, listSubmissions } = require("../controllers/diagnosticController")
const { protect } = require("../middleware/authMiddleware")
const { requirePermission } = require("../middleware/requirePermission")

const router = express.Router()

// POST /api/v1/diagnostic-submission  — public, no auth
router.post("/diagnostic-submission", submitDiagnostic)

// GET  /api/v1/admin/diagnostic        — admin only
router.get("/admin/diagnostic", protect, requirePermission("admin.diagnostic.read"), listSubmissions)

module.exports = router
