// =============================================================
// adminBioRoutes.js · Admin Bio CRUD (M12)
// Mount at: router.use("/admin/bio", authMiddleware, adminOnly, adminBioRoutes)
// =============================================================

const { Router } = require("express")
const ctrl = require("../controllers/adminBioController")

const router = Router()

// Experience
router.get("/experience",        ctrl.listExperience)
router.post("/experience",       ctrl.createExperience)
router.patch("/experience/:id",  ctrl.updateExperience)
router.delete("/experience/:id", ctrl.deleteExperience)

// Certificates
router.get("/certificates",        ctrl.listCertificates)
router.post("/certificates",       ctrl.createCertificate)
router.patch("/certificates/:id",  ctrl.updateCertificate)
router.delete("/certificates/:id", ctrl.deleteCertificate)

// Skills
router.get("/skills",        ctrl.listSkills)
router.post("/skills",       ctrl.createSkill)
router.patch("/skills/:id",  ctrl.updateSkill)
router.delete("/skills/:id", ctrl.deleteSkill)

// Education (M12.5)
router.get("/education",        ctrl.listEducation)
router.post("/education",       ctrl.createEducation)
router.patch("/education/:id",  ctrl.updateEducation)
router.delete("/education/:id", ctrl.deleteEducation)

module.exports = router
