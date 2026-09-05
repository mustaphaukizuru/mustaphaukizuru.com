const { resolveUserLocale } = require("../utils/resolveUserLocale")
const asyncHandler = require("../utils/asyncHandler")
const newsletterService = require("../services/newsletterService")
const suppression = require("../services/suppressionService")
const emailService = require("../services/emailService")

/**
 * POST /api/newsletter/subscribe
 * Body: { email, name?, source? }
 *
 * Returns success regardless of new/existing to prevent email enumeration.
 * Double opt-in: sends the `newsletter.confirm` template; the address only
 * becomes "subscribed" after GET /confirm/:token.
 */
const subscribe = asyncHandler(async (req, res) => {
  const { email, name, source } = req.body || {}

  try {
    const { subscriber, sendConfirmation, confirmUrl } = await newsletterService.subscribe({
      email,
      name:   name || null,
      source: source || "website",
    })

    // Fire-and-forget the double-opt-in confirmation. Don't block the
    // response on SMTP latency.
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
      }).catch((err) => console.error("[newsletter] confirmation email:", err.message))
    }

    return res.status(200).json({
      success: true,
      message: "Almost there — check your inbox to confirm your subscription.",
    })
  } catch (err) {
    // Validation errors → 400. Anything else → silent success to avoid
    // leaking whether the address is registered.
    if (err.code === "VALIDATION_ERROR") {
      return res.status(400).json({ success: false, code: err.code, message: err.message })
    }
    console.error("[newsletter] subscribe:", err.message)
    return res.status(200).json({ success: true, message: "Check your inbox to confirm your subscription." })
  }
})

/**
 * GET /api/v1/newsletter/confirm/:token
 * Double opt-in: flips "pending" → "subscribed", redirects to
 * /unsubscribed?state=confirmed on the frontend.
 */
const confirm = asyncHandler(async (req, res) => {
  const { token } = req.params
  const row = await newsletterService.confirmByToken(token)
  if (!row) return res.redirect(302, `${newsletterService.unsubscribeConfirmedUrl().split("?")[0]}?state=invalid`)
  return res.redirect(302, newsletterService.subscribeConfirmedUrl())
})

/**
 * GET /api/newsletter/unsubscribe/:token
 * Redirects to /unsubscribed on the frontend.
 */
const unsubscribe = asyncHandler(async (req, res) => {
  const { token } = req.params
  const row = await newsletterService.unsubscribeByToken(token)
  if (!row) return res.redirect(302, `${newsletterService.unsubscribeConfirmedUrl().split("?")[0]}?state=invalid`)
  return res.redirect(302, newsletterService.unsubscribeConfirmedUrl())
})

/**
 * POST /api/v1/newsletter/unsubscribe/:token  (T3-5)
 *
 * The RFC 8058 one-click endpoint. A mail provider POSTs here on the
 * reader's behalf; nobody is watching a browser, so the answer is a bare
 * 200. It ALWAYS answers 200, including for a token that means nothing:
 * a 404 tells a provider the unsubscribe failed and it may then mark the
 * message as not honouring unsubscribes, which is the deliverability
 * penalty this endpoint exists to avoid. An unknown token is a no-op that
 * costs nothing.
 *
 * It also suppresses the address outright. A one-click unsubscribe is the
 * strongest possible signal — it is what a reader clicks INSTEAD of pressing
 * "spam" — so it means "never again", not "off this one list".
 */
const unsubscribeOneClick = asyncHandler(async (req, res) => {
  const row = await newsletterService.unsubscribeByToken(req.params.token).catch(() => null)
  if (row?.email) {
    await suppression.suppress(row.email, { reason: "unsubscribe", detail: "RFC 8058 one-click" })
  }
  return res.status(200).end()
})

module.exports = { subscribe, confirm, unsubscribe, unsubscribeOneClick }
