const express = require("express")
const {
  createOrder,
  captureOrder,
  handlePaypalWebhook,
} = require("../controllers/paypalController")

const router = express.Router()

router.post("/create-order", createOrder)
router.post("/capture-order", captureOrder)
router.post("/webhook", handlePaypalWebhook)

module.exports = router