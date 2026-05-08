const express = require("express")
const { protect, adminOnly } = require("../middleware/authMiddleware")
const c = require("../controllers/adminContactController")

const router = express.Router()
router.use(protect, adminOnly)

/**
 * Admin contact-message routes.
 *
 *   GET    /stats    → counts per status (for dashboard tile · MUST precede /:id)
 *   GET    /         → paginated list
 *   GET    /:id      → single message
 *   PATCH  /:id      → update status
 *   DELETE /:id      → hard delete
 */

router.get("/stats",  c.stats)
router.get("/",       c.list)
router.get("/:id",    c.getOne)
router.patch("/:id",  c.updateStatus)
router.delete("/:id", c.remove)

module.exports = router
