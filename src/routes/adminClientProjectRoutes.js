const express = require("express")
const {
  listProjects, getProject, createProject, updateProject, removeProject,
  addMilestone, patchMilestone, removeMilestone,
  uploadFile, removeFile, downloadFile,
  addAdminComment, toggleResolveComment, replyProjectTicket,
  createPortalLink, createCaseStudy,
  quoteChangeRequest, completeChangeRequest,
  listFileRequests, addFileRequest, reviewFileRequest, listEvents, getQueue,
  listFileRequestPresets, listSecrets, createSecret, revealSecret,
  listMembers, addMember, removeMember,
  rebuildHandoverPack,
  listProjectTime, logProjectTime, deleteProjectTime, projectTimeStatement,
} = require("../controllers/adminClientProjectController")
const { protect, adminOnly } = require("../middleware/authMiddleware")
const uploadProjectFile = require("../middleware/uploadProjectFile")

const router = express.Router()
router.use(protect, adminOnly)

router.get   ("/",                          listProjects)
router.post  ("/",                          createProject)
// T5-16 · BEFORE /:id, or Express reads "queue" as a project id and this
// route is never reached.
router.get   ("/queue",                     getQueue)
// T5-13 · a static list, and BEFORE /:id for the same reason as /queue.
router.get   ("/file-request-presets",      listFileRequestPresets)
router.get   ("/:id",                       getProject)
router.patch ("/:id",                       updateProject)
router.delete("/:id",                       removeProject)
// Tier 4 · magic-link portal (no-login, PIN-verified) — mint / rotate
router.post  ("/:id/portal-link",           createPortalLink)
// Tier 4 · draft Portfolio case study from this project
router.post  ("/:id/case-study-draft",      createCaseStudy)

router.post  ("/:id/milestones",            addMilestone)
router.patch ("/:id/milestones/:milestoneId", patchMilestone)
router.delete("/:id/milestones/:milestoneId", removeMilestone)

router.post  ("/:id/files",                 uploadProjectFile, uploadFile)

// T5-3 · document requests. Same protect + adminOnly as everything else
// in this router (applied by the router.use above).
// T5-5 · the full timeline, admin visibility.
router.get   ("/:id/events",                     listEvents)
router.get   ("/:id/file-requests",              listFileRequests)
router.post  ("/:id/file-requests",              addFileRequest)
router.patch ("/:id/file-requests/:reqId",       reviewFileRequest)
// T5-13 · credentials never travel as files, in either direction. Reveal is
// a POST because it destroys what it returns.
router.get   ("/:id/secrets",                    listSecrets)
router.post  ("/:id/secrets",                    createSecret)
router.post  ("/:id/secrets/:secretId/reveal",   revealSecret)

// T5-17 · a school has a director who approves and an IT person who
// uploads. Adding the same address twice is an edit, not an error.
router.get   ("/:id/members",                    listMembers)
router.post  ("/:id/members",                    addMember)
router.delete("/:id/members/:memberId",          removeMember)

// T5-19 · the pack is built automatically at handover; this rebuilds it.
router.post  ("/:id/handover-pack",              rebuildHandoverPack)

// T5-18 · hours against a monthly allowance. `:month` is YYYY-MM and the
// statement route is declared before the bare /time so it cannot be read
// as an entry id.
router.get   ("/:id/time",                       listProjectTime)
router.post  ("/:id/time",                       logProjectTime)
router.get   ("/:id/time/:month/statement.pdf",  projectTimeStatement)
router.delete("/:id/time/:entryId",              deleteProjectTime)
router.delete("/:id/files/:fileId",         removeFile)
router.get   ("/:id/files/:fileId/download", downloadFile)

// Tier 2 · comment thread (admin side)
router.post  ("/:id/comments",                       addAdminComment)
router.patch ("/:id/comments/:commentId/resolve",    toggleResolveComment)

// Tier 2 · admin reply with attachments on a project ticket. Lives here (not
// under /admin/support) because uploadProjectFile stores under
// <storage>/projects/<req.params.id>/ — `:id` must be the project id.
// Plain-text admin replies keep using POST /admin/support/tickets/:id/messages.
router.post  ("/:id/tickets/:ticketId/messages",     uploadProjectFile.many, replyProjectTicket)

// Tier 4 · quote / close a client change request
router.post  ("/:id/change-requests/:crId/quote",    quoteChangeRequest)
router.post  ("/:id/change-requests/:crId/done",     completeChangeRequest)

module.exports = router
