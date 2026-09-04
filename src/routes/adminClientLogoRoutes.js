const express = require("express")
const { protect, adminOnly } = require("../middleware/authMiddleware")
const c = require("../controllers/clientLogoController")

const router = express.Router()

// Every route here is admin-only (the route-guard test asserts this list).
router.use(protect, adminOnly)

router.get   ("/",         c.listAdmin)
router.post  ("/",         c.create)
router.post  ("/reorder",  c.reorder)   // before /:id so "reorder" is not an id
router.patch ("/:id",      c.update)
router.delete("/:id",      c.remove)

module.exports = router
