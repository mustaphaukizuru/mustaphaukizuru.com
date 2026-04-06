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
      message: "Name, email, and message are required.",
    });
  }

  const trimmedName = String(name).trim();
  const trimmedEmail = String(email).trim().toLowerCase();
  const trimmedMessage = String(message).trim();

  if (trimmedName.length < 2 || trimmedName.length > 100) {
    return res.status(400).json({ success: false, message: "Name must be 2–100 characters." });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return res.status(400).json({ success: false, message: "Please enter a valid email address." });
  }

  if (trimmedMessage.length < 10 || trimmedMessage.length > 5000) {
    return res.status(400).json({ success: false, message: "Message must be 10–5000 characters." });
  }

  const result = await createContactMessage({
    name: trimmedName,
    email: trimmedEmail,
    subject: subject ? String(subject).trim().slice(0, 200) : null,
    message: trimmedMessage,
  });

  // Send emails (admin + auto-reply) — non-blocking
  sendContactFormEmail({ name: trimmedName, email: trimmedEmail, subject, message: trimmedMessage }).catch((e) =>
    console.error("[contact] email:", e.message)
  );
  notifyContactReceived(trimmedEmail).catch(() => {});

  res.status(201).json({
    success: true,
    message: "Your message has been sent. We'll respond within 24 hours.",
    data: { id: result.id },
  });
});

const addNewsletterSubscriber = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email is required.",
    });
  }

  // Basic email format check
  const trimmedEmail = String(email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return res.status(400).json({
      success: false,
      message: "Please enter a valid email address.",
    });
  }

  const result = await subscribeNewsletter(trimmedEmail);
  const isNew = result.status === "subscribed" && (!result.unsubscribedAt);

  // Newsletter confirmation email — non-blocking
  if (isNew) {
    sendNewsletterConfirmationEmail(trimmedEmail).catch((e) =>
      console.error("[newsletter] email:", e.message)
    );
  }

  res.status(201).json({
    success: true,
    message: isNew
      ? "You're subscribed! Check your inbox for a confirmation."
      : "You're already subscribed. Welcome back!",
    data: { email: result.email, status: result.status },
  });
});

module.exports = {
  sendContactMessage,
  addNewsletterSubscriber,
};