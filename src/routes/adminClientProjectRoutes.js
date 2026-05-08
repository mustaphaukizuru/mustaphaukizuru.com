const express = require("express")
const {
  listProjects, getProject, createProject, updateProject, removeProject,
  addMilestone, patchMilestone, removeMilestone,
  uploadFile, removeFile,
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

module.exports = router
