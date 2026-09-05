const express = require("express")
const {
  listMine, getMine, streamFile,
  uploadFiles, addComment, approve, requestChanges, acceptProjectAgreement,
  listTickets, getTicket, createTicket, replyTicket,
  listChangeRequests, createChangeRequest, acceptChangeRequest, declineChangeRequest,
  listInvoices, listEvents, listFileRequests,
} = require("../controllers/clientProjectController")
const { protect } = require("../middleware/authMiddleware")
const { uploadRateLimiter, ticketRateLimiter } = require("../middleware/rateLimiter")
const uploadProjectFile = require("../middleware/uploadProjectFile")

const router = express.Router()
router.use(protect)

router.get("/",                          listMine)
router.get("/:id",                       getMine)

// Authenticated, ownership-scoped file download. Replaces the previous
// direct-static path which exposed every project file to anyone with a URL.
router.get("/:id/files/:fileId/download", streamFile)
// T5-4 · the project's invoices. Ownership is checked in the handler via
// loadOwnedProject, the same gate every other member read uses.
router.get("/:id/invoices",               listInvoices)
// T5-5 · the two panels the project page is built from. Both check
// ownership in the handler, like every other member read here.
router.get("/:id/events",                 listEvents)
router.get("/:id/file-requests",          listFileRequests)

// ── Tier 2 · client collaboration (ownership + lifecycle checked in service) ──
router.post("/:id/files",                                  uploadRateLimiter, uploadProjectFile.many, uploadFiles)
router.post("/:id/comments",                               addComment)
router.post("/:id/milestones/:milestoneId/approve",         approve)
router.post("/:id/milestones/:milestoneId/request-changes", requestChanges)
// Tier 4 · NDA click-wrap acceptance (records ip + user-agent)
router.post("/:id/agreements",                             acceptProjectAgreement)

// ── Tier 2 · project-scoped support tickets ──────────────────────────────
// `:id` is the PROJECT id on every ticket route: uploadProjectFile.many stores
// files under <storage>/projects/<req.params.id>/, and attachments download
// through the existing /:id/files/:fileId/download endpoint above.
// Multipart (`files[]`) and JSON bodies are both accepted — multer skips
// non-multipart requests, leaving the JSON body parsed by app-level express.json.
router.get ("/:id/tickets",                              listTickets)
router.post("/:id/tickets",                              ticketRateLimiter, uploadProjectFile.many, createTicket)
router.get ("/:id/tickets/:ticketId",                    getTicket)
router.post("/:id/tickets/:ticketId/messages",           uploadRateLimiter, uploadProjectFile.many, replyTicket)

// ── Tier 4 · extra work (change requests) ────────────────────────────────
router.get ("/:id/change-requests",                      listChangeRequests)
router.post("/:id/change-requests",                      ticketRateLimiter, createChangeRequest)
router.post("/:id/change-requests/:crId/accept",         acceptChangeRequest)
router.post("/:id/change-requests/:crId/decline",        declineChangeRequest)

module.exports = router
