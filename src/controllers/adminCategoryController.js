const asyncHandler = require("../utils/asyncHandler")
const { getAdminCategories } = require("../services/adminCategoryService")

const listAdminCategories = asyncHandler(async (_req, res) => {
  const categories = await getAdminCategories()

  res.status(200).json({
    success: true,
    data: categories,
  })
})

module.exports = {
  listAdminCategories,
}