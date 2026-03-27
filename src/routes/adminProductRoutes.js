const express = require("express")
const {
  listAdminProducts,
  getSingleAdminProduct,
  createProduct,
  updateProduct,
  removeProduct,
  uploadProductFile,
  deleteProductFile,
  markPrimaryProductFile,
  uploadProductImage: uploadProductImageController,
  deleteProductImage,
} = require("../controllers/adminProductController")
const { protect, adminOnly } = require("../middleware/authMiddleware")
const { upload } = require("../middleware/uploadProductFile")
const { uploadProductImage } = require("../middleware/uploadProductImage")

const router = express.Router()

router.use(protect, adminOnly)

router.get("/", listAdminProducts)
router.get("/:id", getSingleAdminProduct)
router.post("/", createProduct)
router.put("/:id", updateProduct)
router.delete("/:id", removeProduct)

router.post("/:id/files", upload.single("file"), uploadProductFile)
router.delete("/:id/files/:fileId", deleteProductFile)
router.patch("/:id/files/:fileId/primary", markPrimaryProductFile)

router.post("/:id/images", uploadProductImage.single("image"), uploadProductImageController)
router.delete("/:id/images/:imageId", deleteProductImage)

module.exports = router