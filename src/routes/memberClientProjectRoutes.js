const express = require("express")
const {
  listMine, getMine, streamFile,
  uploadFiles, addComment, approve, requestChanges,
} = require("../controllers/clientProjectController")
const { protect } = require("../middleware/authMiddleware")
const { uploadRateLimiter } = require("../middleware/rateLimiter")
const uploadProjectFile = require("../middleware/uploadProjectFile")

const router = express.Router()
router.use(protect)

router.get("/",                          listMine)
router.get("/:id",                       getMine)

// Authenticated, ownership-scoped file download. Replaces the previous
// direct-static path which exposed every project file to anyone with a URL.
router.get("/:id/files/:fileId/download", streamFile)

// ── Tier 2 · client collaboration (ownership + lifecycle checked in service) ──
router.post("/:id/files",                                  uploadRateLimiter, uploadProjectFile.many, uploadFiles)
router.post("/:id/comments",                               addComment)
router.post("/:id/milestones/:milestoneId/approve",         approve)
router.post("/:id/milestones/:milestoneId/request-changes", requestChanges)

module.exports = router
