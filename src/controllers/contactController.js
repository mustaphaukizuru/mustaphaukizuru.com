const asyncHandler = require("../utils/asyncHandler");
const logger = require("../utils/logger")
const { notifyContactReceived } = require("../services/notificationService");
const emailService = require("../services/emailService")
const { resolveUserLocale } = require("../utils/resolveUserLocale");
const newsletterController = require("./newsletterController");
const { createContactMessage } = require("../services/contactService");

const SILENT_OK = {
  success: true,
  message: "Your message has been sent. We'll respond within 24 hours.",
};

const INTENT_RE   = /^[a-z0-9_-]{1,64}$/i;
const AUDIENCE_RE = /^[a-z0-9_-]{1,32}$/i;
const TIER_RE     = /^[a-z0-9_-]{1,32}$/i;
const SOURCE_RE   = /^[a-z0-9_\-./?=&]{1,64}$/i;

function pick(value, re, max) {
  if (value === undefined || value === null) return null;
  const v = String(value).trim();
  return v && v.length <= max && re.test(v) ? v : null;
}

function clientIp(req) {
  return String(req.ip || req.connection?.remoteAddress || "unknown").slice(0, 64);
}

/**
 * Submit-timing check (T3). The SPA stamps `formStartedAt` (epoch ms) when
 * the form mounts. Humans need at least a few seconds to fill six fields;
 * bots post instantly. Returns true when the submission looks automated.
 * A missing/garbage value is NOT rejected — old cached bundles and plain
 * HTML forms don't send it.
 */
function submittedTooFast(formStartedAt) {
  const minMs = Number(process.env.CONTACT_MIN_SUBMIT_MS) || 3000;
  const started = Number(formStartedAt);
  if (!Number.isFinite(started) || started <= 0) return false;
  const elapsed = Date.now() - started;
  return elapsed >= 0 && elapsed < minMs;
}

/**
 * Cloudflare Turnstile (T3). Only enforced when TURNSTILE_SECRET_KEY is set.
 * Returns true when the token is valid (or when verification is disabled).
 */
async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token || typeof token !== "string") return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip && ip !== "unknown") body.set("remoteip", ip);
    const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const json = await resp.json();
    if (!json?.success) {
      logger.warn(`[contact] turnstile rejected: ${(json?.["error-codes"] || []).join(",") || "unknown"}`);
    }
    return Boolean(json?.success);
  } catch (err) {
    logger.error(`[contact] turnstile verify failed: ${err.message}`);
    return false;
  }
}

/**
 * POST /api/contact
 *
 * Accepts:
 *   { name, email, subject?, message, website?,
 *     intent?, audience?, tier?, source?, formStartedAt?, turnstileToken? }
 *
 * `website` is a honeypot field (B07). Browsers with real users never see or
 * fill it; bots scrape the form and autofill every input, so any non-empty
 * value is a near-certain bot submission. We return a silent 200 so bots
 * don't learn the check exists — logging it server-side is enough.
 *
 * T3 adds two more layers: a submit-timing check (`formStartedAt`, same
 * silent-200 treatment) and optional Cloudflare Turnstile (hard 400
 * `CAPTCHA_FAILED`, since a real user with a broken widget needs feedback).
 */
const sendContactMessage = asyncHandler(async (req, res) => {
  const {
    name, email, subject, message, website,
    intent, audience, tier, source, formStartedAt, turnstileToken,
  } = req.body || {};
  const ip = clientIp(req);

  // Honeypot — silent success
  if (website && String(website).trim().length > 0) {
    logger.warn(`[contact] honeypot triggered from ${ip}`);
    return res.status(200).json(SILENT_OK);
  }

  // Submit timing — silent success
  if (submittedTooFast(formStartedAt)) {
    logger.warn(`[contact] submitted too fast (${Date.now() - Number(formStartedAt)}ms) from ${ip}`);
    return res.status(200).json(SILENT_OK);
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

  if (trimmedEmail.length > 190 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return res.status(400).json({ success: false, message: "Please enter a valid email address." });
  }

  if (trimmedMessage.length < 10 || trimmedMessage.length > 5000) {
    return res.status(400).json({ success: false, message: "Message must be 10–5000 characters." });
  }

  // Turnstile — only when configured. Runs after cheap validation so a
  // typo never burns a siteverify call.
  if (!(await verifyTurnstile(turnstileToken, ip))) {
    return res.status(400).json({
      success: false,
      code: "CAPTCHA_FAILED",
      message: "We couldn't verify you're human. Please retry the challenge and send again.",
    });
  }

  const locale = resolveUserLocale({ req });

  // Persist
  const result = await createContactMessage({
    name:    trimmedName,
    email:   trimmedEmail,
    subject: trimmedSubject,
    message: trimmedMessage,
    intent:    pick(intent, INTENT_RE, 64),
    audience:  pick(audience, AUDIENCE_RE, 32),
    tier:      pick(tier, TIER_RE, 32),
    source:    pick(source, SOURCE_RE, 64) || "contact-form",
    locale:    typeof locale === "string" ? locale.slice(0, 8) : null,
    ipAddress: ip,
    userAgent: req.get ? String(req.get("user-agent") || "").slice(0, 255) || null : null,
  });

  // Fire-and-forget template emails — failures are logged but don't 500 the request.
  const adminRecipient =
    process.env.CONTACT_ADMIN_EMAIL ||
    process.env.SUPPORT_EMAIL ||
    process.env.SMTP_USER;

  if (adminRecipient) {
    emailService.sendTemplateEmail({
      locale,
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
    locale,
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
 * POST /api/newsletter   ·  legacy alias, kept alive for external forms and
 * old cached SPA bundles that still post here.
 *
 * There is exactly ONE subscribe implementation:
 * `newsletterController.subscribe`. This is a thin delegate rather than a
 * 307/308 redirect because several HTTP clients (and every plain <form>)
 * drop or downgrade the body on a cross-route redirect.
 *
 * The only behavioural difference is the default `source` attribution —
 * historically everything hitting this path came from the footer form.
 */
const addNewsletterSubscriber = (req, res, next) => {
  if (req.body && typeof req.body === "object" && !req.body.source) {
    req.body.source = "footer";
  }
  return newsletterController.subscribe(req, res, next);
};

module.exports = {
  sendContactMessage,
  addNewsletterSubscriber,
};
