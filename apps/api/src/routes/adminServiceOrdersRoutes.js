const express = require("express")
const { protect, adminOnly } = require("../middleware/authMiddleware")
const {
  listServiceOrders, getServiceOrder, updateServiceOrder,
  scheduleConsultation, createProject, addMilestone, updateMilestone
} = require("../controllers/adminServiceOrdersController")
const router = express.Router()
router.get("/",                               protect, adminOnly, listServiceOrders)
router.get("/:id",                            protect, adminOnly, getServiceOrder)
router.patch("/:id",                          protect, adminOnly, updateServiceOrder)
router.post("/:id/consultations",             protect, adminOnly, scheduleConsultation)
router.post("/:id/project",                   protect, adminOnly, createProject)
router.post("/projects/:projectId/milestones",protect, adminOnly, addMilestone)
router.patch("/milestones/:milestoneId",       protect, adminOnly, updateMilestone)
module.exports = router
