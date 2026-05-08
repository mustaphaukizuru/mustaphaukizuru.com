const asyncHandler = require("../utils/asyncHandler")
const {
  getAdminCategories,
  createAdminCategory,
  updateAdminCategory,
  deleteAdminCategory,
} = require("../services/adminCategoryService")

function badRequest(res, message, details) {
  return res.status(400).json({
    success: false,
    error: { code: "VALIDATION_ERROR", message, ...(details ? { details } : {}) },
  })
}

const listAdminCategories = asyncHandler(async (_req, res) => {
  const categories = await getAdminCategories()
  res.status(200).json({ success: true, data: categories })
})

const createCategory = asyncHandler(async (req, res) => {
  if (!req.body?.name || !String(req.body.name).trim()) {
    return badRequest(res, "Category name is required")
  }
  try {
    const created = await createAdminCategory(req.body)
    res.status(201).json({ success: true, data: created })
  } catch (e) {
    // Prisma P2002 = unique constraint failure (duplicate slug or name)
    if (e?.code === "P2002") {
      return badRequest(res, "A category with that name or slug already exists")
    }
    throw e
  }
})

const updateCategory = asyncHandler(async (req, res) => {
  try {
    const updated = await updateAdminCategory(req.params.id, req.body)
    res.status(200).json({ success: true, data: updated })
  } catch (e) {
    if (e?.code === "P2002") {
      return badRequest(res, "A category with that name or slug already exists")
    }
    if (e?.code === "P2025") {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Category not found" } })
    }
    throw e
  }
})

const deleteCategory = asyncHandler(async (req, res) => {
  try {
    const result = await deleteAdminCategory(req.params.id)
    res.status(200).json({ success: true, data: result })
  } catch (e) {
    if (e?.code === "P2025") {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Category not found" } })
    }
    throw e
  }
})

module.exports = {
  listAdminCategories,
  createCategory,
  updateCategory,
  deleteCategory,
}
