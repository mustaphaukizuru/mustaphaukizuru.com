const asyncHandler = require("../utils/asyncHandler")
const { getAdminUsers } = require("../services/adminUserService")

const listAdminUsers = asyncHandler(async (_req, res) => {
  const data = await getAdminUsers()

  res.status(200).json({
    success: true,
    data,
  })
})

module.exports = {
  listAdminUsers,
}