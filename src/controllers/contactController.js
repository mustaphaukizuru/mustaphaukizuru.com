const asyncHandler = require("../utils/asyncHandler");
const logger = require("../utils/logger")
const { notifyContactReceived } = require("../services/notificationService");
const emailService = require("../services/emailService")
const { resolveUserLocale } = require("../utils/resolveUserLocale");
const newsletterService = require("../services/newsletterService");
const {
  createContactMessage,
  subscribeNewsletter,
} = require("../services/contactService");

/**
 * POST /api/contact
 *
 * Accepts:
 *   { name, email, subject?, message, website? }
 *
 * `website` is a honeypot field (B07). Browsers with real users never see or
 * fill it; bots scrape the form and autofill every input, so any non-empty
 * value is a near-certain bot submission. We return a silent 200 so bots
 * don't learn the check exists — logging it server-side is enough.
 */
const sendContactMessage = asyncHandler(async (req, res) => {
  const { name, email, subject, message, website } = req.body || {};

  // Honeypot — silent success
  if (website && String(website).trim().length > 0) {
    const ip = req.ip || req.connection?.remoteAddress || "unknown";
    logger.warn(`[contact] honeypot triggered from ${ip}`);
    return res.status(200).json({
      success: true,
      message: "Your message has been sent. We'll respond within 24 hours.",
    });
  }

  // Validate
  if (!name || !email || !message) {
    return res.status(400).json({
      success: false,
      message: "Name, email, and message are required.",
    });
  }

  const trimmedName    = String(name).trim();
  const trimmedEmail   = String(email).trim().toLowerCase();
  const trimmedSubject = subject ? String(subject).trim().slice(0, 200) : null;
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

  // Persist
  const result = await createContactMessage({
    name:    trimmedName,
    email:   trimmedEmail,
    subject: trimmedSubject,
    message: trimmedMessage,
  });

  // Fire-and-forget template emails — failures are logged but don't 500 the request.
  const adminRecipient =
    process.env.CONTACT_ADMIN_EMAIL ||
    process.env.SUPPORT_EMAIL ||
    process.env.SMTP_USER;

  if (adminRecipient) {
    emailService.sendTemplateEmail({
      locale: resolveUserLocale({ req }),
      to:          adminRecipient,
      templateKey: "contact.admin",
      variables: {
        name:    trimmedName,
        email:   trimmedEmail,
        subject: trimmedSubject || "(no subject)",
        message: trimmedMessage,
      },
    }).catch((err) => logger.error("[contact] admin email:", err.message));
  }

  emailService.sendTemplateEmail({
      locale: resolveUserLocale({ req }),
    to:          trimmedEmail,
    templateKey: "contact.confirm",
    variables:   { name: trimmedName },
  }).catch((err) => logger.error("[contact] confirm email:", err.message));

  notifyContactReceived(trimmedEmail).catch(() => {});

  return res.status(201).json({
    success: true,
    message: "Your message has been sent. We'll respond within 24 hours.",
    data: { id: result.id },
  });
});

/**
 * POST /api/newsletter   (kept for backward compatibility with existing Footer.jsx)
 * Prefer POST /api/newsletter/subscribe going forward.
 */
const addNewsletterSubscriber = asyncHandler(async (req, res) => {
  const { email, name, source } = req.body || {};

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email is required.",
    });
  }

  try {
    // Legacy alias for POST /newsletter/subscribe. It MUST use the same
    // double-opt-in contract: newsletterService.subscribe now returns
    // { subscriber, sendConfirmation, confirmUrl }. Reading the old
    // { isNew, unsubscribeUrl } shape left every subscriber stuck in
    // `pending` with no confirmation email ever sent.
    const { subscriber, sendConfirmation, confirmUrl } = await newsletterService.subscribe({
      email,
      name:   name || null,
      source: source || "footer",
    });

    if (sendConfirmation) {
      emailService.sendTemplateEmail({
        locale:      resolveUserLocale({ req }),
        to:          subscriber.email,
        templateKey: "newsletter.confirm",
        variables: {
          email:      subscriber.email,
          name:       subscriber.name || "",
          confirmUrl,
        },
      }).catch((err) => logger.error("[newsletter] confirmation email:", err.message));
    }

    return res.status(200).json({
      success: true,
      message: subscriber.status === "subscribed"
        ? "You're already subscribed."
        : "Almost there — check your inbox to confirm your subscription.",
    });
  } catch (err) {
    if (err.code === "VALIDATION_ERROR") {
      return res.status(400).json({ success: false, message: err.message });
    }
    logger.error("[newsletter] subscribe:", err.message);
    return res.status(200).json({ success: true, message: "Subscribed." });
  }
});

module.exports = {
  sendContactMessage,
  addNewsletterSubscriber,
};
