const { resolveUserLocale } = require("../utils/resolveUserLocale")
const asyncHandler = require("../utils/asyncHandler")
const newsletterService = require("../services/newsletterService")
const emailService = require("../services/emailService")

/**
 * POST /api/newsletter/subscribe
 * Body: { email, name?, source? }
 *
 * Returns success regardless of new/existing to prevent email enumeration.
 * Fires the `newsletter-welcome` template only on true new signups.
 */
const subscribe = asyncHandler(async (req, res) => {
  const { email, name, source } = req.body || {}

  try {
    const { subscriber, isNew, unsubscribeUrl } = await newsletterService.subscribe({
      email,
      name:   name || null,
      source: source || "website",
    })

    // Fire-and-forget welcome on true new signups. Don't block the response
    // on SMTP latency.
    if (isNew) {
      emailService.sendTemplateEmail({
      locale: resolveUserLocale({ req }),
        to:            subscriber.email,
        templateKey:   "newsletter.confirm",
        variables: {
          email:          subscriber.email,
          name:           subscriber.name || "",
          unsubscribeUrl,
        },
        headers: { "List-Unsubscribe": `<${unsubscribeUrl}>` },
      }).catch((err) => console.error("[newsletter] welcome email:", err.message))
    }

    return res.status(200).json({
      success: true,
      message: "Subscribed — please check your inbox for a welcome email.",
    })
  } catch (err) {
    // Validation errors → 400. Anything else → silent success to avoid
    // leaking whether the address is registered.
    if (err.code === "VALIDATION_ERROR") {
      return res.status(400).json({ success: false, code: err.code, message: err.message })
    }
    console.error("[newsletter] subscribe:", err.message)
    return res.status(200).json({ success: true, message: "Subscribed." })
  }
})

/**
 * GET /api/newsletter/unsubscribe/:token
 * Redirects to /unsubscribed on the frontend.
 */
const unsubscribe = asyncHandler(async (req, res) => {
  const { token } = req.params
  await newsletterService.unsubscribeByToken(token)
  return res.redirect(302, newsletterService.unsubscribeConfirmedUrl())
})

module.exports = { subscribe, unsubscribe }
