const express = require("express")
const { protect, adminOnly } = require("../middleware/authMiddleware")
const { listPages, getPage, createPage, updatePage, publishPage, deletePage } = require("../controllers/adminPagesController")

const router = express.Router()
router.get("/",              protect, adminOnly, listPages)
router.post("/",             protect, adminOnly, createPage)
router.get("/:id",           protect, adminOnly, getPage)
router.patch("/:id",         protect, adminOnly, updatePage)
router.patch("/:id/publish", protect, adminOnly, publishPage)
router.delete("/:id",        protect, adminOnly, deletePage)
module.exports = router
