// Tier 4 · manual invoices. Mounted at /api/v1/admin/invoices.
const express = require("express")
const { list, create, voidOne } = require("../controllers/adminInvoiceController")
const { protect, adminOnly } = require("../middleware/authMiddleware")

const router = express.Router()
router.use(protect, adminOnly)

router.get ("/",         list)
router.post("/",         create)
router.post("/:id/void", voidOne)

module.exports = router
