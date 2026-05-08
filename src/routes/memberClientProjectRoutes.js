const express = require("express")
const { listMine, getMine, streamFile } = require("../controllers/clientProjectController")
const { protect } = require("../middleware/authMiddleware")

const router = express.Router()
router.use(protect)

router.get("/",                          listMine)
router.get("/:id",                       getMine)

// Authenticated, ownership-scoped file download. Replaces the previous
// direct-static path which exposed every project file to anyone with a URL.
router.get("/:id/files/:fileId/download", streamFile)

module.exports = router
