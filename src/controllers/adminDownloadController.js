const asyncHandler = require("../utils/asyncHandler")
const { getAdminDownloads } = require("../services/adminDownloadService")

const listAdminDownloads = asyncHandler(async (_req, res) => {
  const data = await getAdminDownloads()

  res.status(200).json({
    success: true,
    data,
  })
})

module.exports = {
  listAdminDownloads,
}