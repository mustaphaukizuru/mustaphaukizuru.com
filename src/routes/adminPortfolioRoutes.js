const express = require("express")
const { protect, adminOnly } = require("../middleware/authMiddleware")
const { uploadPortfolioImage } = require("../middleware/uploadPortfolioImage")
const c = require("../controllers/adminPortfolioController")

const router = express.Router()
router.use(protect, adminOnly)

/**
 * Route order matters — specific literal paths BEFORE /:id wildcards.
 *
 *   PATCH /order                 bulk-reorder
 *   GET   /                      list
 *   POST  /                      create
 *   GET   /:id                   detail
 *   PATCH /:id                   update
 *   DELETE /:id                  soft-delete
 *   POST  /:id/cover             upload cover
 *   POST  /:id/gallery           append gallery image
 */

// Bulk reorder — must be first to avoid being matched as /:id
router.patch("/order", c.reorder)

// Collection
router.get("/",   c.list)
router.post("/",  c.create)

// Item
router.get("/:id",      c.getOne)
router.patch("/:id",    c.update)
router.delete("/:id",   c.softDelete)

// Image uploads (single-file fields: "cover" and "image")
router.post(
  "/:id/cover",
  uploadPortfolioImage.single("cover"),
  c.uploadCover
)
router.post(
  "/:id/gallery",
  uploadPortfolioImage.single("image"),
  c.uploadGallery
)

module.exports = router
