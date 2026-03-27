const express = require("express")
const { protect } = require("../middleware/authMiddleware")
const {
  getDownloadMeta,
  downloadProduct,
} = require("../controllers/downloadController")

const router = express.Router()

router.get("/:productId", protect, getDownloadMeta)
router.get("/:productId/file/:fileId", protect, downloadProduct)

module.exports = router