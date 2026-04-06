const express = require("express");
const {
  sendContactMessage,
  addNewsletterSubscriber,
} = require("../controllers/contactController");

const router = express.Router();
const { authRateLimiter } = require("../middleware/rateLimiter")

router.post("/contact",    authRateLimiter, sendContactMessage);
router.post("/newsletter", authRateLimiter, addNewsletterSubscriber);

// Newsletter unsubscribe — GET for email link clicks
router.get("/newsletter/unsubscribe", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).send(unsubscribePage("Missing email address.", false));
    }

    const prisma = require("../lib/prisma");
    const subscriber = await prisma.newsletterSubscriber.findUnique({ where: { email } });

    if (!subscriber) {
      return res.send(unsubscribePage("This email is not in our subscriber list.", false));
    }

    if (subscriber.status === "unsubscribed") {
      return res.send(unsubscribePage("You've already been unsubscribed.", true));
    }

    await prisma.newsletterSubscriber.update({
      where: { email },
      data: { status: "unsubscribed", unsubscribedAt: new Date() },
    });

    return res.send(unsubscribePage("You've been successfully unsubscribed. You won't receive any more emails from us.", true));
  } catch (err) {
    console.error("[unsubscribe]", err.message);
    return res.status(500).send(unsubscribePage("Something went wrong. Please try again or contact support.", false));
  }
});

function unsubscribePage(message, success) {
  const base = process.env.FRONTEND_URL || "http://localhost:5173";
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>Newsletter — Mustapha Ukizuru</title></head>
<body style="margin:0;padding:0;background:#f4f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
<div style="max-width:440px;margin:40px auto;padding:40px 32px;background:#fff;border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06);text-align:center;">
  <div style="width:48px;height:48px;margin:0 auto 20px;border-radius:12px;background:${success ? "#e8f5e9" : "#ffeaea"};display:flex;align-items:center;justify-content:center;">
    <span style="font-size:24px;">${success ? "✓" : "!"}</span>
  </div>
  <h1 style="margin:0 0 12px;font-size:20px;color:#1a1a2e;">${success ? "Unsubscribed" : "Oops"}</h1>
  <p style="margin:0 0 24px;font-size:15px;color:#5f6470;line-height:1.6;">${message}</p>
  <a href="${base}" style="display:inline-block;padding:12px 24px;background:#420060;color:#fff;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;">Back to Website</a>
</div>
</body>
</html>`;
}

module.exports = router;