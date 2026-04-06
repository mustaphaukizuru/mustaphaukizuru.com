const asyncHandler = require("../utils/asyncHandler");
const { sendContactFormEmail, sendNewsletterConfirmationEmail } = require("../utils/mailer");
const { notifyContactReceived } = require("../services/notificationService");
const {
  createContactMessage,
  subscribeNewsletter,
} = require("../services/contactService");

const sendContactMessage = asyncHandler(async (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({
      success: false,
      message: "name, email, and message are required",
    });
  }

  const result = await createContactMessage({ name, email, subject, message });

  // Send emails (admin notification + auto-reply) — non-blocking
  sendContactFormEmail({ name, email, subject, message }).catch((e) =>
    console.error("[contact] email:", e.message)
  )
  notifyContactReceived(email).catch(() => {})

  res.status(201).json({
    success: true,
    message: "Contact message saved successfully",
    data: result,
  });
});

const addNewsletterSubscriber = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "email is required",
    });
  }

  const result = await subscribeNewsletter(email);

  // Newsletter confirmation email — non-blocking
  sendNewsletterConfirmationEmail(email).catch((e) =>
    console.error("[newsletter] email:", e.message)
  )

  res.status(201).json({
    success: true,
    message: "Subscribed successfully",
    data: result,
  });
});

module.exports = {
  sendContactMessage,
  addNewsletterSubscriber,
};