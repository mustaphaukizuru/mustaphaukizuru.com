const asyncHandler = require("../utils/asyncHandler")
const prisma = require("../lib/prisma")
const fsp = require("fs/promises")
const fs = require("fs")
const projectInvoices = require("../services/projectInvoiceService")
const readReceipts = require("../services/readReceiptService")
const projectEvents = require("../services/projectEventService")
const secretHandoff = require("../services/secretHandoffService")
const fileRequests = require("../services/projectFileRequestService")
const { invoicePathFor } = require("../services/invoiceService")
const {
  requestPin, verifyPin, loadPortalProject, loadProjectByToken,
  requestPinByCode, verifyPinByCode,
} = require("../services/portalAccessService")
const { setPortalCookie, clearPortalCookie } = require("../utils/portalCookie")
const { sendProjectFile } = require("./clientProjectController")
const { ndaStatus, attachClientFiles } = require("../services/projectPortalService")
const { resolveUserLocale } = require("../utils/resolveUserLocale")
const { createMercadoPagoPreference } = require("../services/mercadoPagoService")

function portalError(res, e) {
  if (e?.statusCode && e?.code) {
    return res.status(e.statusCode).json({ success: false, error: { code: e.code, message: e.message, ...(e.details ? { details: e.details } : {}) } })
  }
  throw e
}

/** GET /portal/:token — is this link alive? (name only, no PIN yet) */
const probe = asyncHandler(async (req, res) => {
  try {
    const project = await loadProjectByToken(req.params.token)
    res.status(200).json({ success: true, data: { projectName: project.projectName, expiresAt: project.portalTokenExpiresAt } })
  } catch (e) { return portalError(res, e) }
})

/** POST /portal/:token/pin — email a 6-digit PIN to the project owner. */
const sendPin = asyncHandler(async (req, res) => {
  try {
    const data = await requestPin(req.params.token, { locale: resolveUserLocale({ req }) })
    res.status(200).json({ success: true, data })
  } catch (e) { return portalError(res, e) }
})

/** POST /portal/:token/verify { pin } — sets the httpOnly mu_portal cookie. */
const verify = asyncHandler(async (req, res) => {
  try {
    const { token, projectId, projectName } = await verifyPin(req.params.token, req.body?.pin)
    setPortalCookie(res, token)
    res.status(200).json({ success: true, data: { projectId, projectName } })
  } catch (e) { return portalError(res, e) }
})

/** POST /portal/logout — drop the portal cookie. */
const logout = asyncHandler(async (_req, res) => {
  clearPortalCookie(res)
  res.status(200).json({ success: true })
})

/* ── T5-8 · the second door: a tracking code instead of a link ──────────
 *
 * Identical to the two handlers above in everything that matters. The code
 * resolves the project; the PIN still goes to the address on file; the
 * cookie issued is the same mu_portal with the same TTL. Only the way the
 * project was found differs, which is the point — a second door, not a
 * second lock.
 */

/** POST /portal/by-code/:code/pin */
const sendPinByCode = asyncHandler(async (req, res) => {
  try {
    const data = await requestPinByCode(req.params.code, { locale: resolveUserLocale({ req }) })
    res.status(200).json({ success: true, data })
  } catch (e) { return portalError(res, e) }
})

/** POST /portal/by-code/:code/verify { pin } */
const verifyByCode = asyncHandler(async (req, res) => {
  try {
    const { token, projectId, projectName } = await verifyPinByCode(req.params.code, req.body?.pin)
    setPortalCookie(res, token)
    res.status(200).json({ success: true, data: { projectId, projectName } })
  } catch (e) { return portalError(res, e) }
})

/** GET /portal/me/project — read-only project view (portalAuth). */
const getProject = asyncHandler(async (req, res) => {
  try {
    const data = await loadPortalProject(req.portal)
    res.status(200).json({ success: true, data })
  } catch (e) { return portalError(res, e) }
})

/** GET /portal/me/files/:fileId/download — scoped to the token's project. */
const downloadFile = asyncHandler(async (req, res) => {
  const { projectId, userId } = req.portal
  const file = await prisma.projectFile.findFirst({
    where:   { id: String(req.params.fileId), projectId, supportMessageId: null },
    include: { project: { select: { id: true, userId: true, projectName: true, requiresNda: true, ndaVersion: true } } },
  })
  if (!file || file.project?.userId !== userId) {
    return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "File not found" } })
  }
  const nda = await ndaStatus(file.project, userId)
  if (nda.required && !nda.accepted) {
    return res.status(403).json({ success: false, error: { code: "NDA_REQUIRED", message: "Sign in to accept the project NDA before downloading files." } })
  }
  return sendProjectFile({ file, req, res, userId, action: "project.file.downloaded.portal" })
})

/**
 * POST /portal/me/file-requests/:reqId/files  (T5-3)
 *
 * The portal's FIRST write. Everything else behind `mu_portal` is a GET,
 * which is why that cookie had no CSRF pair until now — it has one as of this
 * change, and csrf.js engages on it, because an httpOnly sameSite=lax cookie
 * plus a state-changing route is precisely what CSRF is.
 *
 * Delegates to the same attachClientFiles the logged-in dashboard uses, with
 * the identity taken from the verified portal token rather than a session.
 */
const uploadRequestFiles = asyncHandler(async (req, res) => {
  const files = req.files || (req.file ? [req.file] : [])
  try {
    const rows = await attachClientFiles({
      userId: req.portal.userId,
      projectId: req.portal.projectId,
      files,
      fileRequestId: req.params.reqId,
    })
    res.status(201).json({ success: true, data: rows })
  } catch (e) {
    // Never leave orphaned bytes when the write was refused.
    await Promise.all(files.map((f) => fsp.unlink(f.path).catch(() => null)))
    return portalError(res, e)
  }
})

/**
 * GET /portal/me/events  (T5-5)
 *
 * Same ceiling as the member timeline: a portal holder proved control of the
 * project owner's inbox with a PIN, so they see what the owner sees.
 */
const listEvents = asyncHandler(async (req, res) => {
  const locale = resolveUserLocale({ req })
  const rows = await projectEvents.listForProject(req.portal.projectId, { audience: "client" })
  res.json({ success: true, data: rows.map((r) => projectEvents.serializeEvent(r, locale)) })
})

/** GET /portal/me/file-requests  (T5-5) — what the studio is waiting on. */
const listFileRequests = asyncHandler(async (req, res) => {
  const locale = resolveUserLocale({ req })
  const rows = await fileRequests.listForProject(req.portal.projectId)
  res.json({ success: true, data: rows.map((r) => fileRequests.serialize(r, locale)) })
})

/** GET /portal/me/invoices  (T5-4) */
const listInvoices = asyncHandler(async (req, res) => {
  const data = await projectInvoices.listForProject(req.portal.projectId, { portal: true })
  res.json({ success: true, data })
})

/**
 * GET /portal/me/invoices/:invoiceId/pdf  (T5-4)
 *
 * The order-scoped route cannot serve a portal visitor: its gate is an
 * owner-or-admin check against a SESSION, and a portal holder has none.
 * findForProject is the replacement check — the invoice must sit on one of
 * the orders this portal's project is billed through — and it returns null
 * rather than throwing so "no such invoice" and "not yours" answer alike.
 */
const downloadInvoice = asyncHandler(async (req, res) => {
  const invoice = await projectInvoices.findForProject(req.params.invoiceId, req.portal.projectId)
  if (!invoice) {
    return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Invoice not found" })
  }

  const diskPath = invoicePathFor(invoice.invoiceNumber)
  if (!fs.existsSync(diskPath)) {
    return res.status(404).json({ success: false, code: "INVOICE_FILE_MISSING", message: "Invoice file not found" })
  }

  // T5-14 · a portal viewer is always the client — that is what the PIN
  // proved. Stamped after the gate and before the bytes.
  readReceipts.recordInvoiceView(invoice, { projectId: req.portal.projectId }).catch(() => null)

  res.setHeader("Content-Type", "application/pdf")
  // attachment, not inline: a portal visitor is usually on the link someone
  // forwarded them, and a download is the thing they came for.
  res.setHeader("Content-Disposition", `attachment; filename="${invoice.invoiceNumber}.pdf"`)
  res.setHeader("Cache-Control", "private, no-store")

  const stream = fs.createReadStream(diskPath)
  stream.on("error", () => {
    if (!res.headersSent) {
      res.status(500).json({ success: false, code: "STREAM_ERROR", message: "Could not stream invoice" })
    } else {
      res.end()
    }
  })
  stream.pipe(res)
})

/**
 * POST /portal/me/invoices/:invoiceId/pay  (T5-9)
 *
 * A client holding a PIN session can settle their own bill without an
 * account. That sounds like a widening and it is the opposite: the only
 * thing this endpoint can do is send money TO us, for an amount this server
 * decided, on an order the portal's project is already billed through.
 *
 * NO NEW PAYMENT CODE. It calls the same createMercadoPagoPreference the
 * member pay card calls, with `userId` set to the project's owner — so the
 * ownership check, the amount, the idempotency key and the webhook path are
 * the ones already written and tested. What the portal cannot do is choose
 * the order, the amount or the recipient.
 *
 * Three refusals, and each closes a different hole:
 *   findForProject   an invoice from somebody else's project answers 404,
 *                    identically to one that does not exist.
 *   status           only issued/overdue. Paying a paid invoice twice is the
 *                    single worst outcome available here.
 *   order.status     the invoice may say issued while the order was already
 *                    cancelled by the stale-order janitor; a preference for
 *                    a cancelled order is a payment nobody will fulfil.
 */
const payInvoice = asyncHandler(async (req, res) => {
  const invoice = await projectInvoices.findForProject(req.params.invoiceId, req.portal.projectId)
  if (!invoice) {
    return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Invoice not found" } })
  }
  if (!projectInvoices.UNPAID_STATUSES.includes(invoice.status)) {
    return res.status(409).json({ success: false, error: { code: "INVOICE_NOT_PAYABLE", message: "This invoice is not awaiting payment" } })
  }
  const order = invoice.orderId
    ? await prisma.order.findUnique({ where: { id: invoice.orderId }, select: { id: true, status: true } })
    : null
  if (!order || order.status !== "pending") {
    return res.status(409).json({ success: false, error: { code: "INVOICE_NOT_PAYABLE", message: "This invoice is not awaiting payment" } })
  }

  const pref = await createMercadoPagoPreference({ orderId: order.id, userId: req.portal.userId })
  const redirectUrl = pref?.initPoint || pref?.sandboxPoint
  if (!redirectUrl) {
    return res.status(502).json({ success: false, error: { code: "PAYMENT_UNAVAILABLE", message: "Could not start the payment" } })
  }

  projectInvoices.recordPaymentInitiated(order.id, { gateway: "mercadopago" }).catch(() => null)
  res.status(200).json({ success: true, data: { redirectUrl } })
})

/* ── T5-13 · the credential handoff, from a PIN session ─────────────────── */

/** GET /portal/me/secrets — metadata only. */
const listSecrets = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await secretHandoff.listForProject(req.portal.projectId, "client") })
})

/**
 * POST /portal/me/secrets — the client sends us a credential.
 *
 * The portal is where this matters most: a client with no account, on a
 * forwarded link, who has been asked for the hosting password. Without this
 * they reply to the email with it in the body, and it lives in an inbox
 * forever.
 */
const createSecret = asyncHandler(async (req, res) => {
  try {
    const { secret } = await secretHandoff.createSecret(req.portal.projectId, {
      ...req.body,
      direction: "to_admin",
    }, { createdById: req.portal.userId })
    res.status(201).json({ success: true, data: secret })
  } catch (e) {
    return portalError(res, e)
  }
})

/** POST /portal/me/secrets/:secretId/reveal — once, then it is gone. */
const revealSecret = asyncHandler(async (req, res) => {
  try {
    const out = await secretHandoff.revealSecret(req.params.secretId, req.portal.projectId, "client")
    res.setHeader("Cache-Control", "no-store")
    res.json({ success: true, data: out })
  } catch (e) {
    return portalError(res, e)
  }
})

module.exports = { probe, sendPin, verify, logout, getProject, downloadFile, uploadRequestFiles, listInvoices, downloadInvoice, payInvoice, listSecrets, createSecret, revealSecret, listEvents, listFileRequests,
  sendPinByCode, verifyByCode }
