const express = require("express")
const { protect, adminOnly } = require("../middleware/authMiddleware")
const { listTemplates, getTemplate, upsertTemplate, sendTestEmail } = require("../controllers/adminEmailTemplatesController")
const router = express.Router()
router.get("/",            protect, adminOnly, listTemplates)
router.get("/:key",        protect, adminOnly, getTemplate)
router.put("/:key",        protect, adminOnly, upsertTemplate)
router.post("/:key/test",  protect, adminOnly, sendTestEmail)
module.exports = router
