const prisma = require("../lib/prisma")
const asyncHandler = require("../utils/asyncHandler")
const emailService = require("../services/emailService")

/**
 * Admin · Email templates (B07 rewrite)
 *
 * Before B07 this controller maintained its own in-memory DEFAULT_TEMPLATES
 * array with different keys than the ones other services were wired to emit.
 * B07 unifies on the DB table as the single source of truth and aligns keys
 * with the seed in `prisma/seed-email-templates.js` (run via `npm run seed:email`).
 *
 * Existing frontend (AdminEmailTemplatesPage.jsx) expects:
 *   GET  /api/admin/email-templates          → { success, data: [{ id, key, type, name, subject, htmlBody, textBody, isActive, updatedAt }] }
 *   GET  /api/admin/email-templates/:id      → single row (by id OR key)
 *   PATCH /api/admin/email-templates/:id     → update by id (or key)
 *   POST /api/admin/email-templates/:id/test → { to } → send a test to `to`
 *
 * We accept either `:id` (cuid) or `:key` for flexibility.
 */

// Mapping for the legacy "type" label used by the frontend. Keys match the
// B07 seed. If a key isn't listed here, the frontend falls back to the raw
// key as the display label.
const TYPE_LABELS = {
  "welcome":                  "Welcome / Account Created",
  "email-verification":       "Email Verification",
  "password-reset":           "Password Reset",
  "order-confirmation":       "Order Confirmation",
  "payment-received":         "Payment Received",
  "download-ready":           "Download Ready",
  "refund-processed":         "Refund Processed",
  "review-request":           "Review Request",
  "service-order-received":   "Service Order — Customer",
  "service-order-admin":      "Service Order — Admin Alert",
  "newsletter-welcome":       "Newsletter Welcome",
  "contact-form-admin":       "Contact Form — Admin Alert",
  "contact-form-confirm":     "Contact Form — Auto-reply",
}

function shape(row) {
  if (!row) return null
  return {
    id:        row.id,
    key:       row.key,
    type:      row.key,
    name:      TYPE_LABELS[row.key] || row.key,
    locale:    row.locale || "en",          // I18N05 · expose locale in payload
    subject:   row.subject,
    htmlBody:  row.htmlBody,
    textBody:  row.textBody || "",
    isActive:  row.isActive !== false,
    updatedAt: row.updatedAt,
  }
}

async function findByIdOrKey(identifier, locale = "en") {
  // I18N05 · Composite (key, locale) lookup with English fallback.
  // Resolution order:
  //   1. Direct id lookup (cuid)
  //   2. (key, locale) composite — when admin picks an ES tab, this returns
  //      the Spanish row if it exists.
  //   3. (key, "en") fallback — guarantees a row whenever English exists,
  //      so the editor never crashes when an ES row hasn't been seeded yet.
  const byId = await prisma.emailTemplate.findUnique({ where: { id: identifier } }).catch(() => null)
  if (byId) return byId

  const wantedLocale = locale === "es" ? "es" : "en"
  const composite = await prisma.emailTemplate
    .findUnique({ where: { key_locale: { key: identifier, locale: wantedLocale } } })
    .catch(() => null)
  if (composite) return composite

  if (wantedLocale !== "en") {
    return prisma.emailTemplate
      .findUnique({ where: { key_locale: { key: identifier, locale: "en" } } })
      .catch(() => null)
  }
  return null
}

/* ── Handlers ──────────────────────────────────────────────────────── */

const listTemplates = asyncHandler(async (req, res) => {
  const localeFilter = req.query.locale === "es" ? "es" : (req.query.locale === "en" ? "en" : null)

  // When admin filters by locale, return only those rows.
  if (localeFilter) {
    const rows = await prisma.emailTemplate.findMany({
      where: { locale: localeFilter },
      orderBy: { key: "asc" },
    })
    return res.json({ success: true, data: rows.map(shape) })
  }

  // Default: return EN rows + a summary of which locales each key has populated
  // so the admin UI can show "EN/ES" availability per template at a glance.
  const allRows = await prisma.emailTemplate.findMany({ orderBy: [{ key: "asc" }, { locale: "asc" }] })
  const grouped = new Map()
  for (const row of allRows) {
    const existing = grouped.get(row.key)
    if (!existing) {
      grouped.set(row.key, { ...shape(row), localesAvailable: [row.locale || "en"] })
    } else {
      existing.localesAvailable.push(row.locale || "en")
      // Prefer the EN row as the row-level shape so existing admin UI keeps working.
      if ((row.locale || "en") === "en") {
        Object.assign(existing, shape(row), { localesAvailable: existing.localesAvailable })
      }
    }
  }
  res.json({ success: true, data: Array.from(grouped.values()) })
})

const getTemplate = asyncHandler(async (req, res) => {
  const locale = req.query.locale === "es" ? "es" : "en"
  const row = await findByIdOrKey(req.params.id || req.params.key, locale)
  if (!row) return res.status(404).json({ success: false, message: "Template not found" })
  res.json({ success: true, data: shape(row) })
})

const updateTemplate = asyncHandler(async (req, res) => {
  const identifier = req.params.id || req.params.key
  // I18N05 · admin can edit either locale by passing ?locale=es. When the
  // (key, locale) row doesn't exist yet (Spanish often won't until seeded),
  // we upsert: create a new row using the English row's defaults.
  const locale = req.query.locale === "es" ? "es" : (req.body?.locale === "es" ? "es" : "en")

  const { subject, htmlBody, textBody, isActive } = req.body || {}

  // Find the English baseline so a brand-new ES row inherits sensible defaults.
  const englishRow = await prisma.emailTemplate
    .findUnique({ where: { key_locale: { key: identifier, locale: "en" } } })
    .catch(() => null)
  // Fallback: maybe `identifier` is an id rather than a key.
  let baseline = englishRow
  let key = identifier
  if (!baseline) {
    const byId = await prisma.emailTemplate
      .findUnique({ where: { id: identifier } })
      .catch(() => null)
    if (byId) { baseline = byId; key = byId.key }
  }
  if (!baseline) {
    return res.status(404).json({ success: false, message: "Template not found" })
  }

  const updated = await prisma.emailTemplate.upsert({
    where: { key_locale: { key, locale } },
    update: {
      ...(subject  !== undefined ? { subject }  : {}),
      ...(htmlBody !== undefined ? { htmlBody } : {}),
      ...(textBody !== undefined ? { textBody } : {}),
      ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
    },
    create: {
      key,
      locale,
      subject:  subject  ?? baseline.subject,
      htmlBody: htmlBody ?? baseline.htmlBody,
      textBody: textBody ?? baseline.textBody,
      isActive: isActive ?? baseline.isActive,
      variables: baseline.variables ?? [],
    },
  })
  res.json({ success: true, data: shape(updated) })
})

/**
 * POST /api/admin/email-templates/:id/test
 * Body: { to, variables? }
 *
 * Sends the live DB template through the same pipeline any production email
 * would use. Logs a row in EmailLog with the admin's userId so we can tell
 * test sends apart from real traffic.
 */
const sendTestEmail = asyncHandler(async (req, res) => {
  const identifier = req.params.id || req.params.key
  const { to, variables } = req.body || {}

  if (!to) {
    return res.status(400).json({ success: false, message: "Recipient 'to' is required" })
  }

  const row = await findByIdOrKey(identifier)
  if (!row) return res.status(404).json({ success: false, message: "Template not found" })

  // Sensible defaults so the preview isn't littered with empty tokens
  const defaults = {
    name:            "Test Recipient",
    userName:        "Test Recipient",
    customerName:    "Test Recipient",
    email:           to,
    userEmail:       to,
    customerEmail:   to,
    orderNumber:     "TEST-12345",
    orderId:         "TEST-12345",
    amount:          "49.99",
    total:           "$49.99",
    orderTotal:      "$49.99",
    method:          "Test Gateway",
    paymentMethod:   "Test Gateway",
    productTitle:    "Test Product",
    downloadUrl:     `${process.env.FRONTEND_URL || "https://mustaphaukizuru.com"}/dashboard/downloads`,
    orderUrl:        `${process.env.FRONTEND_URL || "https://mustaphaukizuru.com"}/dashboard/orders`,
    reviewUrl:       `${process.env.FRONTEND_URL || "https://mustaphaukizuru.com"}/dashboard/orders`,
    resetUrl:        `${process.env.FRONTEND_URL || "https://mustaphaukizuru.com"}/reset-password/TEST_TOKEN`,
    verifyUrl:       `${process.env.FRONTEND_URL || "https://mustaphaukizuru.com"}/verify/TEST_TOKEN`,
    unsubscribeUrl:  `${process.env.BACKEND_URL  || "https://mustaphaukizuru.com"}/api/newsletter/unsubscribe/TEST_TOKEN`,
    expiresAt:       "in 1 hour",
    expiresIn:       "1 hour",
    serviceTitle:    "Test Consulting Service",
    serviceName:     "Test Consulting Service",
    packageName:     "Professional",
    items:           "1 × Test Product",
    subject:         "Test subject",
    message:         "This is a test message sent from the admin panel.",
  }

  const result = await emailService.sendTemplateEmail({
    to,
    templateKey: row.key,
    variables:   { ...defaults, ...(variables || {}) },
    userId:      req.user?.id || null,
  })

  if (!result.ok) {
    return res.status(500).json({
      success: false,
      code:    "SEND_FAILED",
      message: result.error || "Failed to send test email",
      data:    { logId: result.logId },
    })
  }

  res.json({
    success: true,
    message: `Test email sent to ${to}`,
    data:    { messageId: result.messageId, logId: result.logId },
  })
})

module.exports = {
  listTemplates,
  getTemplate,
  upsertTemplate: updateTemplate, // preserve old export name used by adminEmailTemplatesRoutes
  updateTemplate,
  sendTestEmail,
}
