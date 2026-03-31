const asyncHandler = require("../utils/asyncHandler")
const { getAdminPayments } = require("../services/adminPaymentService")

const listAdminPayments = asyncHandler(async (_req, res) => {
  const data = await getAdminPayments()

  res.status(200).json({
    success: true,
    data,
  })
})

module.exports = {
  listAdminPayments,
}