const express = require("express")
const { listAdminPayments } = require("../controllers/adminPaymentController")
const { protect, adminOnly } = require("../middleware/authMiddleware")

const router = express.Router()

router.get("/", protect, adminOnly, listAdminPayments)

module.exports = router