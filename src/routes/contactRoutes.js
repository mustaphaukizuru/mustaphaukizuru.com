const express = require("express");
const {
  sendContactMessage,
  addNewsletterSubscriber,
} = require("../controllers/contactController");

const router = express.Router();
const { authRateLimiter } = require("../middleware/rateLimiter")
// Basic rate limit for public contact/newsletter forms

router.post("/contact",    authRateLimiter, sendContactMessage);
router.post("/newsletter", authRateLimiter, addNewsletterSubscriber);

module.exports = router;