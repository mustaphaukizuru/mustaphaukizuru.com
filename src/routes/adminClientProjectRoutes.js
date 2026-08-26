const express = require("express")
const {
  listProjects, getProject, createProject, updateProject, removeProject,
  addMilestone, patchMilestone, removeMilestone,
  uploadFile, removeFile, downloadFile,
  addAdminComment, toggleResolveComment, replyProjectTicket,
} = require("../controllers/adminClientProjectController")
const { protect, adminOnly } = require("../middleware/authMiddleware")
const uploadProjectFile = require("../middleware/uploadProjectFile")

const router = express.Router()
router.use(protect, adminOnly)

router.get   ("/",                          listProjects)
router.post  ("/",                          createProject)
router.get   ("/:id",                       getProject)
router.patch ("/:id",                       updateProject)
router.delete("/:id",                       removeProject)

router.post  ("/:id/milestones",            addMilestone)
router.patch ("/:id/milestones/:milestoneId", patchMilestone)
router.delete("/:id/milestones/:milestoneId", removeMilestone)

router.post  ("/:id/files",                 uploadProjectFile, uploadFile)
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

module.exports = router
