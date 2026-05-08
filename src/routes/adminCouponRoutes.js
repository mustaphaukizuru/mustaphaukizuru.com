const express = require("express")
const { protect, adminOnly } = require("../middleware/authMiddleware")
const adminCouponController = require("../controllers/adminCouponController")

const router = express.Router()

// Every route on this router requires admin privilege.
router.use(protect, adminOnly)

router.get("/",              adminCouponController.list)
router.post("/",             adminCouponController.create)
router.get("/:id",           adminCouponController.getOne)
router.patch("/:id",         adminCouponController.update)
router.delete("/:id",        adminCouponController.softDelete)
router.get("/:id/usage",     adminCouponController.usage)

module.exports = router
