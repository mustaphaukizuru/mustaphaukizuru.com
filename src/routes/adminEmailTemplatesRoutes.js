const express = require("express")
const { protect, adminOnly } = require("../middleware/authMiddleware")
const c = require("../controllers/adminEmailTemplatesController")

const router = express.Router()
router.use(protect, adminOnly)

/**
 * Admin email templates routes (B07 rewrite).
 *
 * Accepts either the cuid `:id` OR the string `:key`. The controller resolves
 * either transparently, so `/:id` can be used for both.
 */

router.get("/",           c.listTemplates)
router.get("/:id",        c.getTemplate)
router.patch("/:id",      c.updateTemplate)
router.put("/:id",        c.upsertTemplate)      // legacy compatibility
router.post("/:id/test",  c.sendTestEmail)

module.exports = router
