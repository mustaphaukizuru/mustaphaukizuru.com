const express = require("express")
const { protect, adminOnly } = require("../middleware/authMiddleware")
const c = require("../controllers/adminServiceController")

const router = express.Router()

router.use(protect, adminOnly)

/* ── Services collection ───────────────────────────────────────────── */
router.get("/",              c.list)
router.post("/",             c.create)
router.get("/:id",           c.getOne)
router.patch("/:id",         c.update)
router.delete("/:id",        c.softDelete)

/* ── Packages ──────────────────────────────────────────────────────── */
router.post("/:id/packages",        c.addPackage)
router.patch("/:id/packages/:pid",  c.updatePackage)
router.delete("/:id/packages/:pid", c.removePackage)

/* ── Features ──────────────────────────────────────────────────────── */
router.post("/:id/features",        c.addFeature)
router.delete("/:id/features/:fid", c.removeFeature)

module.exports = router
