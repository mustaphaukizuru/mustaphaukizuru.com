const express = require("express")
const { protect } = require("../middleware/authMiddleware")
const { getMyTickets, createTicket, getTicket, replyToTicket } = require("../controllers/supportController")

const router = express.Router()

router.get("/tickets",              protect, getMyTickets)
router.post("/tickets",             protect, createTicket)
router.get("/tickets/:id",          protect, getTicket)
router.post("/tickets/:id/messages",protect, replyToTicket)

module.exports = router
