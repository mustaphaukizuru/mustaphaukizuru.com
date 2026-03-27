const asyncHandler = require("../utils/asyncHandler")
const { getAdminDashboardStats } = require("../services/adminDashboardService")

const getDashboardStats = asyncHandler(async (_req, res) => {
  const data = await getAdminDashboardStats()

  res.status(200).json({
    success: true,
    data,
  })
})

module.exports = {
  getDashboardStats,
}