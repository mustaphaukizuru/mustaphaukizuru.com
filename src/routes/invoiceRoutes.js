const express = require("express")
const { protect } = require("../middleware/authMiddleware")
const { getInvoicePdf } = require("../controllers/invoiceController")

const router = express.Router()

/**
 * Mounted at /api/orders in src/routes/index.js, so the full path exposed
 * to clients is:
 *
 *   GET /api/orders/:id/invoice.pdf
 */
router.get("/:id/invoice.pdf", protect, getInvoicePdf)

module.exports = router
