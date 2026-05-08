const express = require("express")
const { protect } = require("../middleware/authMiddleware")
const c = require("../controllers/memberServiceOrderController")

const router = express.Router()
router.use(protect)

router.get("/",    c.listMine)
router.get("/:id", c.getMine)

module.exports = router
