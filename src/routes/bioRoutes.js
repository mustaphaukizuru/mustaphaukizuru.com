// =============================================================
// bioRoutes.js · public Bio (M12)
// Mount at: router.use("/bio", bioRoutes)
// =============================================================

const { Router } = require("express")
const ctrl = require("../controllers/bioController")

const router = Router()
router.get("/experience",   ctrl.experience)
router.get("/education",    ctrl.education)
router.get("/certificates", ctrl.certificates)
router.get("/skills",       ctrl.skills)
module.exports = router
