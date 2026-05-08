const express = require("express")
const { protect, adminOnly } = require("../middleware/authMiddleware")
const c = require("../controllers/adminNewsletterController")

const router = express.Router()
router.use(protect, adminOnly)

/**
 * Route order: specific before /:id.
 *   POST   /subscribers/export   → CSV download (must precede /:id)
 *   GET    /subscribers          → list
 *   DELETE /subscribers/:id      → hard delete (GDPR)
 */

router.post("/subscribers/export", c.exportCsv)
router.get("/subscribers",         c.list)
router.delete("/subscribers/:id",  c.remove)

module.exports = router
