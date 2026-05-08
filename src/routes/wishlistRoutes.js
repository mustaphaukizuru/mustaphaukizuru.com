const express = require("express")
const { protect } = require("../middleware/authMiddleware")
const c = require("../controllers/wishlistController")

const router = express.Router()
router.use(protect)

/**
 * Wishlist routes — B08
 *
 *   GET    /                                   → list items (w/ product snapshots)
 *   POST   /items                              → add item ({ productId })
 *   DELETE /items/:id                          → remove item by item-id
 *   POST   /items/:id/move-to-cart             → remove + return product for client cart
 */

router.get("/",                         c.list)
router.post("/items",                   c.add)
router.delete("/items/:id",             c.remove)
router.post("/items/:id/move-to-cart",  c.moveToCart)

module.exports = router
