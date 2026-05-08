const express = require("express")
const { protect } = require("../middleware/authMiddleware")
const c = require("../controllers/addressController")

const router = express.Router()
router.use(protect)

/**
 * Address routes — B08
 *
 *   GET    /            → list user's addresses (default first)
 *   POST   /            → create
 *   GET    /:id         → fetch one
 *   PATCH  /:id         → partial update
 *   DELETE /:id         → delete
 *   POST   /:id/default → set as default (atomic — unsets the others)
 */

router.get("/",             c.list)
router.post("/",            c.create)
router.post("/:id/default", c.setDefault)
router.get("/:id",          c.getOne)
router.patch("/:id",        c.update)
router.delete("/:id",       c.remove)

module.exports = router
