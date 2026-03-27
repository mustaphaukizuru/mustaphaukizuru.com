const asyncHandler = require("../utils/asyncHandler")
const {
  getAdminProducts,
  createAdminProduct,
  updateAdminProduct,
  deleteAdminProduct,
  getAdminProductById,
  addProductFile,
  removeProductFile,
  setPrimaryProductFile,
  addProductImage,
  removeProductImage,
} = require("../services/adminProductService")

const listAdminProducts = asyncHandler(async (_req, res) => {
  const products = await getAdminProducts()

  res.status(200).json({
    success: true,
    data: products,
  })
})

const getSingleAdminProduct = asyncHandler(async (req, res) => {
  const product = await getAdminProductById(req.params.id)

  if (!product) {
    return res.status(404).json({
      success: false,
      message: "Product not found",
    })
  }

  res.status(200).json({
    success: true,
    data: product,
  })
})

const createProduct = asyncHandler(async (req, res) => {
  const product = await createAdminProduct(req.body)

  res.status(201).json({
    success: true,
    message: "Product created successfully",
    data: product,
  })
})

const updateProduct = asyncHandler(async (req, res) => {
  const product = await updateAdminProduct(req.params.id, req.body)

  res.status(200).json({
    success: true,
    message: "Product updated successfully",
    data: product,
  })
})

const removeProduct = asyncHandler(async (req, res) => {
  await deleteAdminProduct(req.params.id)

  res.status(200).json({
    success: true,
    message: "Product deleted successfully",
  })
})

const uploadProductFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "No file uploaded",
    })
  }

  const file = await addProductFile(req.params.id, req.file, {
    fileName: req.body.fileName,
    version: req.body.version,
    isPrimary: req.body.isPrimary === "true" || req.body.isPrimary === true,
  })

  res.status(201).json({
    success: true,
    message: "Product file uploaded successfully",
    data: file,
  })
})

const deleteProductFile = asyncHandler(async (req, res) => {
  await removeProductFile(req.params.id, req.params.fileId)

  res.status(200).json({
    success: true,
    message: "Product file removed successfully",
  })
})

const markPrimaryProductFile = asyncHandler(async (req, res) => {
  const file = await setPrimaryProductFile(req.params.id, req.params.fileId)

  res.status(200).json({
    success: true,
    message: "Primary file updated successfully",
    data: file,
  })
})

const uploadProductImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "No image uploaded",
    })
  }

  const image = await addProductImage(req.params.id, req.file, {
    altText: req.body.altText,
  })

  res.status(201).json({
    success: true,
    message: "Product image uploaded successfully",
    data: image,
  })
})

const deleteProductImage = asyncHandler(async (req, res) => {
  await removeProductImage(req.params.id, req.params.imageId)

  res.status(200).json({
    success: true,
    message: "Product image removed successfully",
  })
})

module.exports = {
  listAdminProducts,
  getSingleAdminProduct,
  createProduct,
  updateProduct,
  removeProduct,
  uploadProductFile,
  deleteProductFile,
  markPrimaryProductFile,
  uploadProductImage,
  deleteProductImage,
}