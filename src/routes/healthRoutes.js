const express = require("express")
const { getHealth, getDeepHealth } = require("../controllers/healthController")

const router = express.Router()

// Liveness — fast, single DB check. Used by load balancers + uptime monitors.
router.get("/",     getHealth)

// Deep health — probes DB + SMTP + MercadoPago + PayPal in parallel. Used by
// pre-deploy smoke tests and on-call health dashboards.
router.get("/deep", getDeepHealth)

module.exports = router
