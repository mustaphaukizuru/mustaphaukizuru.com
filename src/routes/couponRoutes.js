const express = require("express")
const { validate } = require("../controllers/couponController")

/**
 * Public coupon endpoints.
 *
 * NOTE on auth: /validate is public by design so the Cart page can show
 * instant feedback before the customer commits to applying the coupon. User
 * context (for per-user usage checks) is still honored if a valid JWT is
 * sent — it's just not required.
 */

const router = express.Router()

router.post("/validate", validate)

module.exports = router
