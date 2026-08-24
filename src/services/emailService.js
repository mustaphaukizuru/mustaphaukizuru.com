const prisma = require("../lib/prisma")
const logger = require("../utils/logger")
const layout = require("./emailLayoutService")

/**
 * Email service — THE single email layer (roadmap step 41).
 *
 * Owns the one nodemailer transport for the whole backend. Everything that
 * sends mail goes through here:
 *
 *   sendTemplateEmail  → DB EmailTemplate (key + locale) + {{variables}}
 *   sendRawEmail       → explicit subject/html (campaigns, admin one-offs,
 *                        diagnostic reports)
 *   retryEmailLog      → re-send a failed EmailLog row from its stored payload
 *   verifyTransport    → SMTP handshake for /health deep checks
 *
 * Every send writes an EmailLog row (sent | failed | skipped) with attempts,
 * providerMessageId and errorMessage. Transient SMTP failures are scheduled
 * for retry (see classifyError / RETRY policy) and picked up by
 * src/jobs/emailRetryJob.js. Nothing here throws into request handlers —
 * callers get `{ ok, error, logId }` and may fire-and-forget.
 */

/* ─────────────────────────── retry policy ─────────────────────────────── */

const MAX_ATTEMPTS      = 3
const BASE_BACKOFF_MS   = 5 * 60 * 1000 // 5 min × 2^attempts
const TRANSIENT_CODES   = new Set(["ECONNECTION", "ETIMEDOUT", "EAI_AGAIN", "ECONNRESET", "ESOCKET", "ECONNREFUSED"])
const TRANSIENT_SMTP    = new Set([421, 450, 451, 452])

/**
 * Decide whether an SMTP error is worth retrying.
 * Transient: connection/timeouts/DNS and 4xx "try again later" replies.
 * Permanent: 5xx (bad mailbox, policy rejection), auth errors, bad input.
 */
function isTransientError(err) {
  if (!err) return false
  if (err.code && TRANSIENT_CODES.has(String(err.code))) return true
  const code = Number(err.responseCode)
  if (code && TRANSIENT_SMTP.has(code)) return true
  if (code && code >= 500) return false
  const msg = String(err.message || "")
  return /\b(421|450|451)\b/.test(msg) || /timed? ?out|ECONN|EAI_AGAIN|greylist/i.test(msg)
}

/** Backoff for the retry after `attempts` failed attempts: 5 min × 2^(attempts-1). */
function backoffFor(attempts) {
  return new Date(Date.now() + BASE_BACKOFF_MS * Math.pow(2, Math.max(0, attempts - 1)))
}

/* ─────────────────────────── transport ────────────────────────────────── */

let _transport = null

function smtpConfigured() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS)
}

/** The ONE pooled nodemailer transport. Null when SMTP is not configured. */
function getTransport() {
  if (_transport) return _transport
  if (!smtpConfigured()) return null
  const nodemailer = require("nodemailer")
  _transport = nodemailer.createTransport({
    host:   process.env.SMTP_HOST || "smtp.hostinger.com",
    port:   Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE !== "false",
    auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    pool:   true,
    maxConnections: 3,
    rateLimit:      10,
    connectionTimeout: 15000,
    greetingTimeout:   10000,
    socketTimeout:     30000,
  })
  return _transport
}

/** SMTP handshake check. Returns { ok } or { skipped, reason }; throws on failure. */
async function verifyTransport() {
  const transport = getTransport()
  if (!transport) return { skipped: true, reason: "SMTP not configured" }
  await transport.verify()
  return { ok: true }
}

/** Used by tests / graceful shutdown. */
function resetTransport() {
  try { _transport?.close?.() } catch { /* ignore */ }
  _transport = null
}

/* ─────────────────────────── helpers ──────────────────────────────────── */

function fromAddress() {
  return `"Mustapha Ukizuru" <${process.env.SMTP_USER || "hello@mustaphaukizuru.com"}>`
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

/** Substitute {{key}} tokens; missing keys render as empty strings. */
function renderTemplate(template, variables = {}) {
  if (!template) return ""
  return String(template).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const v = variables[key]
    return v == null ? "" : String(v)
  })
}

/** Best-effort plain-text version of an HTML body. */
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

function toAddressString(to) {
  return Array.isArray(to) ? to.join(", ") : String(to || "")
}

/**
 * Resolve a template by (key, locale) with fallback to English.
 */
async function findTemplate(templateKey, locale = "en") {
  const wantedLocale = locale === "es" ? "es" : "en"
  if (wantedLocale !== "en") {
    const localized = await prisma.emailTemplate.findFirst({
      where: { key: templateKey, locale: wantedLocale, isActive: true },
    })
    if (localized) return localized
  }
  return prisma.emailTemplate.findFirst({
    where: { key: templateKey, locale: "en", isActive: true },
  })
}

/* ─────────────────────────── EmailLog bookkeeping ─────────────────────── */

/**
 * Build the JSON payload stored on EmailLog so the retry job can re-send.
 * Buffer attachments (PDF receipts) are dropped — only string content (ICS)
 * survives; the row is flagged so the admin can see the attachment is gone.
 */
function serializePayload(mail) {
  const keepAttachment = (a) => a && typeof a.content === "string"
  const attachments = Array.isArray(mail.attachments) ? mail.attachments.filter(keepAttachment) : []
  const dropped = Array.isArray(mail.attachments) ? mail.attachments.length - attachments.length : 0
  const alternatives = Array.isArray(mail.alternatives) ? mail.alternatives.filter(keepAttachment) : []
  return {
    from:    mail.from,
    replyTo: mail.replyTo || null,
    to:      mail.to,
    subject: mail.subject,
    html:    mail.html || null,
    text:    mail.text || null,
    headers: mail.headers || null,
    attachments:  attachments.length ? attachments : null,
    alternatives: alternatives.length ? alternatives : null,
    icalEvent:    mail.icalEvent && typeof mail.icalEvent.content === "string" ? mail.icalEvent : null,
    attachmentsDropped: dropped || undefined,
  }
}

/** Create an EmailLog row. Never throws. */
async function writeLog(data) {
  try {
    return await prisma.emailLog.create({ data })
  } catch (err) {
    logger.error("[emailService] failed to write EmailLog:", err.message)
    return null
  }
}

/** Update an EmailLog row. Never throws. */
async function updateLog(id, data) {
  try {
    return await prisma.emailLog.update({ where: { id }, data })
  } catch (err) {
    logger.error("[emailService] failed to update EmailLog:", err.message)
    return null
  }
}

/* ─────────────────────────── core delivery ────────────────────────────── */

/**
 * deliver — send one nodemailer message and record the outcome.
 *
 * @param {object} mail   nodemailer options (from/to/subject/html/text/...)
 * @param {object} meta   { userId, templateKey, logId, attempts }
 *   logId/attempts are set when re-sending an existing EmailLog row.
 * @returns {Promise<{ ok, messageId?, error?, logId?, willRetry? }>}
 */
async function deliver(mail, meta = {}) {
  const { userId = null, templateKey = null, logId = null } = meta
  const attempts = (Number(meta.attempts) || 0) + 1
  const emailTo  = toAddressString(mail.to)
  const subject  = String(mail.subject || "(no subject)")
  const base     = { userId, emailTo, templateKey, subject }

  const record = (data) => (logId ? updateLog(logId, data) : writeLog({ ...base, ...data }))

  const transport = getTransport()
  if (!transport) {
    logger.warn(`[emailService] SMTP not configured — skipping "${subject}" → ${emailTo}`)
    const log = await record({ status: "skipped", errorMessage: "SMTP not configured", attempts, nextAttemptAt: null, payload: serializePayload(mail) })
    return { ok: false, skipped: true, error: "SMTP not configured", logId: log?.id }
  }

  try {
    const info = await transport.sendMail(mail)
    logger.info(`[emailService] sent "${subject}" → ${emailTo}${attempts > 1 ? ` (attempt ${attempts})` : ""}`)
    const log = await record({
      status: "sent",
      providerMessageId: info?.messageId || null,
      sentAt: new Date(),
      errorMessage: null,
      attempts,
      nextAttemptAt: null,
      payload: null,
    })
    return { ok: true, messageId: info?.messageId, logId: log?.id }
  } catch (err) {
    const error     = err?.message || "SMTP send failed"
    const transient = isTransientError(err)
    const willRetry = transient && attempts < MAX_ATTEMPTS
    logger.error(`[emailService] send failed "${subject}" → ${emailTo} (attempt ${attempts}/${MAX_ATTEMPTS}${willRetry ? ", will retry" : transient ? ", giving up" : ", permanent"}): ${error}`)
    const log = await record({
      status: "failed",
      errorMessage: error,
      attempts,
      nextAttemptAt: willRetry ? backoffFor(attempts) : null,
      payload: willRetry ? serializePayload(mail) : null,
    })
    return { ok: false, error, logId: log?.id, willRetry }
  }
}

/* ─────────────────────────── public API ───────────────────────────────── */

/**
 * sendTemplateEmail — render a DB EmailTemplate and deliver it.
 *
 * @param {object} opts
 * @param {string|string[]} opts.to
 * @param {string}          opts.templateKey    EmailTemplate.key
 * @param {object}          [opts.variables]    {{token}} substitution map.
 *   `preheader` / `eyebrow` / `unsubscribeUrl` also feed the layout wrapper.
 * @param {"en"|"es"}       [opts.locale]
 * @param {string}          [opts.userId]
 * @param {object}          [opts.headers]
 * @param {Array}           [opts.attachments]  nodemailer attachments
 * @param {Array}           [opts.alternatives] e.g. text/calendar parts
 * @param {object}          [opts.icalEvent]    nodemailer icalEvent
 * @param {string}          [opts.replyTo]
 */
async function sendTemplateEmail({ to, templateKey, variables = {}, locale, userId, headers, attachments, alternatives, icalEvent, replyTo } = {}) {
  if (!to || !templateKey) return { ok: false, error: "Missing `to` or `templateKey`" }

  let template = null
  try {
    template = await findTemplate(templateKey, locale)
  } catch (err) {
    const error = `Template lookup failed: ${err.message}`
    const log = await writeLog({ userId, emailTo: toAddressString(to), templateKey, subject: "", status: "failed", errorMessage: error, attempts: 0 })
    return { ok: false, error, logId: log?.id }
  }
  if (!template) {
    const error = `Template not found or inactive: ${templateKey}`
    logger.warn(`[emailService] ${error}`)
    const log = await writeLog({ userId, emailTo: toAddressString(to), templateKey, subject: "", status: "failed", errorMessage: error, attempts: 0 })
    return { ok: false, error, logId: log?.id }
  }

  const vars        = { year: new Date().getFullYear(), ...variables }
  const subject     = renderTemplate(template.subject, vars)
  const rawHtmlBody = renderTemplate(template.htmlBody, vars)

  // Content-only templates (no <!doctype>/<html>) get the brand chrome from
  // emailLayoutService; already-wrapped legacy rows are sent verbatim.
  const looksWrapped = /^<(!doctype|html\b)/i.test(rawHtmlBody.trimStart())
  const htmlBody = looksWrapped
    ? rawHtmlBody
    : layout.wrap({
        preheader:      vars.preheader || "",
        eyebrow:        vars.eyebrow   || "",
        bodyHtml:       rawHtmlBody,
        unsubscribeUrl: vars.unsubscribeUrl || null,
      })

  const textBody = template.textBody ? renderTemplate(template.textBody, vars) : htmlToText(htmlBody)

  return deliver(
    {
      from:    fromAddress(),
      replyTo: replyTo || undefined,
      to,
      subject,
      html:    htmlBody,
      text:    textBody,
      headers: headers || undefined,
      attachments:  Array.isArray(attachments)  && attachments.length  ? attachments  : undefined,
      alternatives: Array.isArray(alternatives) && alternatives.length ? alternatives : undefined,
      icalEvent:    icalEvent || undefined,
    },
    { userId, templateKey }
  )
}

/**
 * sendRawEmail — direct send with an explicit subject/html (no DB template).
 * `templateKey` is optional and only labels the EmailLog row.
 */
async function sendRawEmail({ to, subject, html, text, userId, headers, from, replyTo, attachments, alternatives, icalEvent, templateKey = null } = {}) {
  if (!to || !subject) return { ok: false, error: "Missing `to` or `subject`" }
  return deliver(
    {
      from:    from    || fromAddress(),
      replyTo: replyTo || undefined,
      to,
      subject,
      html:    html || undefined,
      text:    text || (html ? htmlToText(html) : undefined),
      headers: headers || undefined,
      attachments:  Array.isArray(attachments)  && attachments.length  ? attachments  : undefined,
      alternatives: Array.isArray(alternatives) && alternatives.length ? alternatives : undefined,
      icalEvent:    icalEvent || undefined,
    },
    { userId, templateKey }
  )
}

/**
 * retryEmailLog — re-send a failed EmailLog row from its stored payload.
 * Updates the same row (attempts++, status, nextAttemptAt).
 */
async function retryEmailLog(log) {
  if (!log?.id) return { ok: false, error: "Missing log row" }
  const p = log.payload
  if (!p || !p.to || !p.subject) {
    await updateLog(log.id, { nextAttemptAt: null, errorMessage: `${log.errorMessage || "failed"} (no stored payload — not retryable)` })
    return { ok: false, error: "No stored payload", logId: log.id }
  }
  const mail = {
    from:    p.from || fromAddress(),
    replyTo: p.replyTo || undefined,
    to:      p.to,
    subject: p.subject,
    html:    p.html || undefined,
    text:    p.text || undefined,
    headers: p.headers || undefined,
    attachments:  p.attachments  || undefined,
    alternatives: p.alternatives || undefined,
    icalEvent:    p.icalEvent    || undefined,
  }
  return deliver(mail, { userId: log.userId, templateKey: log.templateKey, logId: log.id, attempts: log.attempts || 0 })
}

module.exports = {
  sendTemplateEmail,
  sendRawEmail,
  retryEmailLog,
  verifyTransport,
  getTransport,
  resetTransport,
  isTransientError,
  backoffFor,
  MAX_ATTEMPTS,
  // Exposed for admin "Send test" preview and unit tests
  renderTemplate,
  htmlToText,
  esc,
  fromAddress,
  supportEmail,
}
