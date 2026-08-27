const asyncHandler = require("../utils/asyncHandler")
const { createManualInvoice, listInvoices, voidInvoice } = require("../services/adminInvoiceService")

function fail(res, e) {
  if (e?.statusCode && e?.code) return res.status(e.statusCode).json({ success: false, error: { code: e.code, message: e.message } })
  throw e
}

/** GET /admin/invoices?status=&page=&limit= */
const list = asyncHandler(async (req, res) => {
  const data = await listInvoices({ status: req.query.status, page: req.query.page, limit: req.query.limit })
  res.status(200).json({ success: true, data: data.invoices, meta: data.meta })
})

/** POST /admin/invoices { serviceOrderId, amount, dueDate, description } */
const create = asyncHandler(async (req, res) => {
  try {
    const data = await createManualInvoice({
      serviceOrderId: req.body?.serviceOrderId,
      amount:         req.body?.amount,
      dueDate:        req.body?.dueDate,
      description:    req.body?.description,
      adminUserId:    req.user?.id,
      ipAddress:      req.ip || null,
      req,
    })
    res.status(201).json({ success: true, data })
  } catch (e) { return fail(res, e) }
})

/** POST /admin/invoices/:id/void */
const voidOne = asyncHandler(async (req, res) => {
  try {
    const data = await voidInvoice({ invoiceId: req.params.id, adminUserId: req.user?.id, ipAddress: req.ip || null })
    res.status(200).json({ success: true, data })
  } catch (e) { return fail(res, e) }
})

module.exports = { list, create, voidOne }
