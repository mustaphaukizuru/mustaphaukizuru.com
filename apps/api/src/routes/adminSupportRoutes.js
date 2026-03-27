const express = require("express")
const { protect, adminOnly } = require("../middleware/authMiddleware")
const {
  adminGetAllTickets, adminGetTicket,
  adminReplyToTicket, adminUpdateTicket,
} = require("../controllers/supportController")

const router = express.Router()
router.get("/tickets",              protect, adminOnly, adminGetAllTickets)
router.get("/tickets/:id",          protect, adminOnly, adminGetTicket)
router.post("/tickets/:id/messages",protect, adminOnly, adminReplyToTicket)
router.patch("/tickets/:id",        protect, adminOnly, adminUpdateTicket)
module.exports = router
