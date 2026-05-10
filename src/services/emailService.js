const prisma = require("../lib/prisma")
const logger = require("../utils/logger")
const layout = require("./emailLayoutService")

/**
 * Template-based email service (B07)
 *
 * This sits on top of the existing `src/utils/mailer.js` nodemailer transport
 * — we reuse its pooled SMTP connection and its logEmail helper. What this
 * service adds is:
 *
 *   1. Load an EmailTemplate row by `templateKey` from the DB
 *   2. Substitute {{variables}} in subject + htmlBody + textBody
 *   3. Send via the shared transport
 *   4. Write an EmailLog entry (status: sent | failed, provider message id, error)
 *
 * NOTE on locale: the current EmailTemplate schema does not have a `locale`
 * column, so `locale` is accepted but currently ignored. When i18n lands
 * (I18N prompt later), add a `locale` column to EmailTemplate and update the
 * `findTemplate` query to prefer the requested locale and fall back to "en".
 */

// ─────────────────────────────────────────────────────────────────────────────
// Transport — reuses SMTP config from mailer.js via its internal nodemailer
// pool if exposed, otherwise creates its own (same config) so the service is
// independent and mailer.js does not have to be modified.
// ─────────────────────────────────────────────────────────────────────────────

let _transport = null

function getTransport() {
  if (_transport) return _transport

  // Prefer the shared pool if mailer.js exports it (either today or later)
  try {
    const mailer = require("../utils/mailer")
    if (typeof mailer.getTransporter === "function") {
      _transport = mailer.getTransporter()
      return _transport
    }
    if (mailer.transporter) {
      _transport = mailer.transporter
      return _transport
    }
  } catch {
    // mailer.js may not be available — fall through to self-hosted transport
  }

  // Self-hosted nodemailer pool using the same env vars as mailer.js.
  // Safe duplicate — both pools can coexist.
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null

  const nodemailer = require("nodemailer")
  _transport = nodemailer.createTransport({
    host:   process.env.SMTP_HOST || "smtp.hostinger.com",
    port:   Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE !== "false",
    auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    pool:   true,
    maxConnections: 3,
    rateLimit:      10,
  })
  return _transport
}

function fromAddress() {
  return (
    `"Mustapha Ukizuru" <${
      process.env.SMTP_USER || "hello@mustaphaukizuru.com"
    }>`
  )
}

function supportEmail() {
  return process.env.SUPPORT_EMAIL || process.env.SMTP_USER || "hello@mustaphaukizuru.com"
}

function esc(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/**
 * Substitute {{key}} tokens in a string with values from `variables`.
 * Missing keys are left as empty strings so the email doesn't ship with
 * literal `{{orderNumber}}` in the body.
 */
function renderTemplate(template, variables = {}) {
  if (!template) return ""
  return String(template).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const v = variables[key]
    return v == null ? "" : String(v)
  })
}

/**
 * Strip HTML to a best-effort plain-text version. Used only when an
 * EmailTemplate has no textBody set.
 */
function htmlToText(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/**
 * Fetch the template row for a given key. Always returns the active row if
 * one exists; otherwise returns null.
 */
/**
 * Resolve a template by (key, locale) with fallback to English.
 *
 * The EmailTemplate schema (post-Phase 3) carries a (key, locale)
 * composite unique. Many seed rows still only exist in `"en"`, so any
 * Spanish-locale request first tries `(key, "es")`, then falls back to
 * `(key, "en")` if the Spanish row hasn't been seeded yet. This keeps
 * Spanish users on the right surface when ES content exists, and never
 * blocks an email when only English exists.
 *
 * @param {string} templateKey  EmailTemplate.key
 * @param {"en"|"es"} [locale]  Defaults to "en"
 */
async function findTemplate(templateKey, locale = "en") {
  const wantedLocale = locale === "es" ? "es" : "en"

  // Try the requested locale first (if not English).
  if (wantedLocale !== "en") {
    const localized = await prisma.emailTemplate.findFirst({
      where: { key: templateKey, locale: wantedLocale, isActive: true },
    })
    if (localized) return localized
  }

  // Fall back to English — the seed always populates `(key, "en")`.
  return prisma.emailTemplate.findFirst({
    where: { key: templateKey, locale: "en", isActive: true },
  })
}

/**
 * Write an EmailLog row. Never throws — mail delivery bookkeeping should not
 * break a request.
 */
async function writeLog({ userId, to, templateKey, subject, status, providerMessageId, errorMessage }) {
  try {
    return await prisma.emailLog.create({
      data: {
        userId: userId || null,
        emailTo: String(to),
        templateKey: templateKey || null,
        subject: subject || "(no subject)",
        status,
        providerMessageId: providerMessageId || null,
        sentAt: status === "sent" ? new Date() : null,
        errorMessage: errorMessage || null,
      },
    })
  } catch (err) {
    logger.error("[emailService] failed to write EmailLog:", err.message)
    return null
  }
}

/**
 * sendTemplateEmail
 *
 * @param {object} opts
 * @param {string|string[]} opts.to            Recipient email(s)
 * @param {string}          opts.templateKey   EmailTemplate.key
 * @param {object}          [opts.variables]   Substitution map
 * @param {string}          [opts.locale]      Accepted but ignored until i18n lands
 * @param {string}          [opts.userId]      Associates the log row with a user
 * @param {object}          [opts.headers]     Extra mail headers (List-Unsubscribe, etc.)
 * @param {Array}           [opts.attachments] Nodemailer attachments — e.g.
 *   [{ filename: "receipt-XYZ.pdf", content: <Buffer>, contentType: "application/pdf" }]
 *   Forwarded verbatim to transport.sendMail; left undefined when empty so
 *   transports that don't support attachments still send the body cleanly.
 * @returns {Promise<{ ok: boolean, messageId?: string, error?: string, logId?: string }>}
 */
async function sendTemplateEmail({ to, templateKey, variables = {}, locale, userId, headers, attachments } = {}) {
  if (!to || !templateKey) {
    return { ok: false, error: "Missing `to` or `templateKey`" }
  }

  const template = await findTemplate(templateKey, locale)
  if (!template) {
    const error = `Template not found or inactive: ${templateKey}`
    const log = await writeLog({ userId, to, templateKey, subject: "", status: "failed", errorMessage: error })
    return { ok: false, error, logId: log?.id }
  }

  const subject     = renderTemplate(template.subject, variables)
  const rawHtmlBody = renderTemplate(template.htmlBody, variables)

  /* Auto-wrap content-only templates with the brand layout.
   *
   * Conventions:
   *   • Templates that begin with `<!doctype` or `<html` are treated as
   *     already-wrapped (legacy seed) — sent verbatim.
   *   • Templates that start with anything else are treated as content
   *     fragments and wrapped via emailLayoutService.wrap(...) so they
   *     pick up the header, social bar, address block, and unsubscribe
   *     row without the author having to author chrome by hand.
   *
   * The convention is opt-in by content shape, not by config flag, so
   * existing seeded templates render identically and new templates can
   * be authored as a single <p>…</p> + {{variables}}.
   */
  const trimmedBody = rawHtmlBody.trimStart()
  const looksWrapped = /^<(!doctype|html\b)/i.test(trimmedBody)
  const htmlBody = looksWrapped
    ? rawHtmlBody
    : layout.wrap({
        preheader:      variables.preheader || "",
        eyebrow:        variables.eyebrow   || "",
        bodyHtml:       rawHtmlBody,
        unsubscribeUrl: variables.unsubscribeUrl || null,
      })

  const textBody = template.textBody
    ? renderTemplate(template.textBody, variables)
    : htmlToText(htmlBody)

  const transport = getTransport()
  if (!transport) {
    // SMTP not configured — log-only so dev keeps working.
    logger.warn(`[emailService] SMTP not configured, logging only (${templateKey} → ${to})`)
    const log = await writeLog({
      userId, to, templateKey,
      subject, status: "failed",
      errorMessage: "SMTP not configured",
    })
    return { ok: false, error: "SMTP not configured", logId: log?.id }
  }

  try {
    const info = await transport.sendMail({
      from:    fromAddress(),
      to,
      subject,
      html:    htmlBody,
      text:    textBody,
      headers: headers || undefined,
      attachments: (Array.isArray(attachments) && attachments.length > 0) ? attachments : undefined,
    })
    const log = await writeLog({
      userId, to, templateKey,
      subject,
      status: "sent",
      providerMessageId: info?.messageId || null,
    })
    return { ok: true, messageId: info?.messageId, logId: log?.id }
  } catch (err) {
    const error = err?.message || "SMTP send failed"
    logger.error(`[emailService] send failed (${templateKey} → ${to}):`, error)
    const log = await writeLog({
      userId, to, templateKey,
      subject,
      status: "failed",
      errorMessage: error,
    })
    return { ok: false, error, logId: log?.id }
  }
}

/**
 * sendRawEmail — direct send without loading a DB template.
 * Used for one-off admin cases (custom announcements, test sends with an
 * explicit subject/body). Still logs to EmailLog with templateKey = null.
 */
async function sendRawEmail({ to, subject, html, text, userId, headers, from, replyTo } = {}) {
  if (!to || !subject) return { ok: false, error: "Missing `to` or `subject`" }

  const transport = getTransport()
  if (!transport) {
    const log = await writeLog({
      userId, to, templateKey: null, subject,
      status: "failed", errorMessage: "SMTP not configured",
    })
    return { ok: false, error: "SMTP not configured", logId: log?.id }
  }

  try {
    const info = await transport.sendMail({
      from:    from    || fromAddress(),
      replyTo: replyTo || undefined,
      to,
      subject,
      html:    html || undefined,
      text:    text || (html ? htmlToText(html) : undefined),
      headers: headers || undefined,
    })
    const log = await writeLog({
      userId, to, templateKey: null, subject,
      status: "sent", providerMessageId: info?.messageId || null,
    })
    return { ok: true, messageId: info?.messageId, logId: log?.id }
  } catch (err) {
    const error = err?.message || "SMTP send failed"
    const log = await writeLog({
      userId, to, templateKey: null, subject,
      status: "failed", errorMessage: error,
    })
    return { ok: false, error, logId: log?.id }
  }
}

module.exports = {
  sendTemplateEmail,
  sendRawEmail,
  // Exposed for admin "Send test" preview and unit tests
  renderTemplate,
  htmlToText,
  esc,
  fromAddress,
  supportEmail,
}
