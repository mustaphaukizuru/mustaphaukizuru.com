/**
 * /api/v1/portal · Tier 4 magic-link + PIN client portal (no login).
 *
 * Public:  GET  /:token             link probe (project name only)
 *          POST /:token/pin         email a PIN      (5 / 15 min / IP)
 *          POST /:token/verify      PIN → mu_portal  (10 / 15 min / IP)
 *          POST /logout             clear the cookie
 * Cookie:  GET  /me/project         read-only project (portalAuth)
 *          GET  /me/files/:fileId/download
 *
 * `/me` is declared before `/:token` so it can never be read as a token.
 */
const express = require("express")
const c = require("../controllers/portalController")
const { portalAuth } = require("../middleware/portalAuth")
const { portalPinRateLimiter, portalVerifyRateLimiter, uploadRateLimiter } = require("../middleware/rateLimiter")
const uploadProjectFile = require("../middleware/uploadProjectFile")

/**
 * multer's disk destination is shared with the admin and member upload
 * routes, and it reads `req.params.id`. This route is keyed by a request id
 * instead, so without this the bytes land under "_orphan" and
 * resolveSafePath never finds them again.
 */
function projectIdForUpload(req, _res, next) {
  req.params.id = req.portal?.projectId
  next()
}

const router = express.Router()

router.get ("/me/project",                 portalAuth, c.getProject)
router.get ("/me/files/:fileId/download",  portalAuth, c.downloadFile)
// T5-4 · invoices beside the work, not on a bare order page.
router.get ("/me/invoices",                portalAuth, c.listInvoices)
router.get ("/me/invoices/:invoiceId/pdf", portalAuth, c.downloadInvoice)
// T5-3 · the portal's first write. Order matters:
//   portalAuth        → verifies mu_portal, populates req.portal
//   projectIdForUpload → multer's destination reads req.params.id, which this
//                        route does not have. Without it every portal upload
//                        lands in the shared "_orphan" directory instead of
//                        the project's own.
//   uploadRateLimiter → same limiter as every other upload path
//   many              → multer, up to 10 files
// CSRF is applied globally by middleware/csrf.js, which now triggers on
// mu_portal as well as mu_session.
router.post(
  "/me/file-requests/:reqId/files",
  portalAuth,
  projectIdForUpload,
  uploadRateLimiter,
  uploadProjectFile.many,
  c.uploadRequestFiles,
)

router.post("/logout",                     c.logout)

router.get ("/:token",                     c.probe)
router.post("/:token/pin",                 portalPinRateLimiter, c.sendPin)
router.post("/:token/verify",              portalVerifyRateLimiter, c.verify)

module.exports = router
