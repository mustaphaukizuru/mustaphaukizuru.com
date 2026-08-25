/**
 * utils/mailer.js — thin compatibility facade over services/emailService.
 *
 * Every function keeps its historical name/signature so existing callers and
 * test mocks (`jest.mock("../src/utils/mailer")`) keep working, but all copy
 * now lives in DB EmailTemplate rows (prisma/seed-email-templates.js) and
 * every send goes through emailService's single pooled transport, EmailLog
 * bookkeeping and retry policy. Functions never throw (fire-and-forget safe).
 */
const emailService = require("../services/emailService")
const { buildConsultationIcs } = require("./icsGenerator")

const base  = () => (process.env.FRONTEND_URL || "https://mustaphaukizuru.com").replace(/\/$/, "")
const first = (name) => String(name || "there").trim().split(" ")[0] || "there"
const fmtMoney = (v, currency) => {
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD", maximumFractionDigits: 2 }).format(Number(v || 0)) }
  catch { return `${Number(v || 0).toFixed(2)} ${currency || "USD"}` }
}
const fmtWhen = (at, tz) => {
  if (!at) return "N/A"
  const d = at instanceof Date ? at : new Date(at)
  try {
    return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short", timeZone: tz || "UTC" }).format(d)
  } catch { return d.toUTCString() }
}

/** Send a DB template; resolves to emailService's result, never rejects. */
function send(templateKey, to, variables, extra = {}) {
  if (!to) return Promise.resolve({ ok: false, error: "No recipient" })
  return emailService.sendTemplateEmail({ to, templateKey, variables, ...extra })
    .catch((err) => ({ ok: false, error: err?.message || "send failed" }))
}

/* ─── variable builders ─────────────────────────────────────────────────── */

function orderVars(order = {}) {
  return {
    customerName: first(order.customerName),
    orderNumber:  order.orderNumber || order.id || "N/A",
    orderTotal:   fmtMoney(order.totalAmount, order.currency),
    orderStatus:  order.status || "pending",
    orderUrl:     `${base()}/dashboard/orders/${order.id || ""}`,
    gateway:      order.paymentMethod || order.gateway || "",
  }
}

function consultationVars(c = {}) {
  const tz = c.timezone || "UTC"
  return {
    customerName:    first(c.user?.fullName),
    serviceTitle:    c.service?.title || "Consultation",
    hostName:        c.assignedAdmin?.fullName || "Mustapha Ukizuru",
    scheduledAt:     fmtWhen(c.scheduledAt, tz),
    previousScheduledAt: c.previousScheduledAt ? fmtWhen(c.previousScheduledAt, tz) : "",
    durationMin:     c.durationMin || 30,
    timezone:        tz,
    meetingLink:     c.meetingLink || `${base()}/dashboard/consultations`,
    clientNotes:     c.clientNotes || "",
    cancellationReason: c.cancellationReason || "",
    consultationUrl: c.confirmationToken
      ? `${base()}/booking/manage?token=${encodeURIComponent(c.confirmationToken)}`
      : `${base()}/dashboard/consultations`,
  }
}

/** ICS calendar parts (alternative + attachment + icalEvent) for a booking. */
function icsParts(consultation, method = "REQUEST") {
  if (!consultation?.scheduledAt) return {}
  try {
    const content = buildConsultationIcs(consultation, {
      method,
      fromEmail: process.env.SMTP_USER || "hello@mustaphaukizuru.com",
      fromName:  consultation.assignedAdmin?.fullName || "Mustapha Ukizuru",
      baseUrl:   base(),
    })
    const contentType = `text/calendar; charset="utf-8"; method=${method}`
    const filename = method === "CANCEL" ? "cancelled.ics" : "invite.ics"
    return {
      alternatives: [{ contentType, content }],
      attachments:  [{ filename, content, contentType }],
      icalEvent:    { method, content, filename },
    }
  } catch { return {} }
}

const consult = (key, c, method, opts = {}) =>
  send(key, c?.user?.email, consultationVars(c), { userId: c?.userId, locale: opts.locale, ...icsParts(c, method) })

/* ─── auth ──────────────────────────────────────────────────────────────── */
const sendWelcomeEmail = (user) =>
  send("auth.welcome", user?.email, { customerName: first(user?.fullName || user?.name), dashboardUrl: `${base()}/dashboard` }, { userId: user?.id })
const sendResetEmail = (email, resetLink) =>
  send("auth.password-reset", email, { resetUrl: resetLink })
const sendPasswordResetConfirmationEmail = (email) =>
  send("auth.password-changed", email, { loginUrl: `${base()}/login`, changedAt: new Date().toUTCString() })

/* ─── orders ────────────────────────────────────────────────────────────── */
const orderMail = (key) => (order) => send(key, order?.customerEmail, orderVars(order), { userId: order?.userId })
const sendOrderPlacedEmail    = orderMail("order.placed")
const sendOrderPaidEmail      = orderMail("order.confirmed")
const sendOrderPendingEmail   = orderMail("order.pending")
const sendOrderCancelledEmail = orderMail("order.cancelled")
const sendOrderFailedEmail    = orderMail("order.failed")
const sendOrderRefundedEmail  = orderMail("order.refunded")
const sendDownloadReadyEmail  = (order, product) =>
  send("download.ready", order?.customerEmail, { ...orderVars(order), productTitle: product?.title || "your product", downloadUrl: `${base()}/dashboard/downloads` }, { userId: order?.userId })

/* ─── contact / support / newsletter ────────────────────────────────────── */
async function sendContactFormEmail(data = {}) {
  const { name, email, subject, message } = data
  if (!name || !email || !message) return { ok: false, error: "Missing fields" }
  const vars = { name, email, subject: subject || "New message", message }
  await send("contact.admin", emailService.supportEmail(), vars, { replyTo: email })
  return send("contact.confirm", email, vars)
}
const ticketVars = (ticket, user) => ({
  customerName: first(user?.fullName), ticketNumber: ticket?.ticketNumber || ticket?.id?.slice(0, 8) || "N/A",
  orderNumber: ticket?.ticketNumber || "N/A", subject: ticket?.subject || "N/A", priority: ticket?.priority || "medium",
  supportTicketUrl: `${base()}/dashboard/support`,
})
const sendSupportTicketEmail = (ticket, user) =>
  send("support.created", user?.email || ticket?.email, ticketVars(ticket, user), { userId: user?.id })
const sendSupportReplyEmail = (ticket, user, replyMessage) =>
  send("support.reply", user?.email || ticket?.email, { ...ticketVars(ticket, user), message: String(replyMessage || "").replace(/\n/g, "<br/>") }, { userId: user?.id })
// The unsubscribe link must carry the subscriber's token — the old
// `?email=` form let anyone unsubscribe any address and its route is gone.
const sendNewsletterConfirmationEmail = async (email) => {
  const prisma = require("../lib/prisma")
  const newsletterService = require("../services/newsletterService")
  const row = await prisma.newsletterSubscriber.findUnique({ where: { email } }).catch(() => null)
  if (!row?.unsubscribeToken) return { ok: false, error: "No unsubscribe token for this subscriber" }
  const unsubscribeUrl = newsletterService.buildUnsubscribeUrl(row.unsubscribeToken)
  return send("newsletter.welcome", email, { unsubscribeUrl, storeUrl: `${base()}/store` }, { headers: { "List-Unsubscribe": `<${unsubscribeUrl}>` } })
}

/* ─── consultations (ICS attached) ──────────────────────────────────────── */
const sendConsultationConfirmationEmail = (c, opts) => consult("consultation.confirmed",   c, "REQUEST", opts)
const sendConsultationRescheduledEmail  = (c, opts) => consult("consultation.rescheduled", c, "REQUEST", opts)
const sendConsultationCancelledEmail    = (c, opts) => consult("consultation.cancelled",   c, "CANCEL",  opts)
const sendConsultationReminderEmail = (c, hoursAway) =>
  send("consultation.reminder", c?.user?.email,
    { ...consultationVars(c), whenLabel: hoursAway >= 24 ? "tomorrow" : "in about an hour", hoursAway },
    { userId: c?.userId, ...icsParts(c, "REQUEST") })

module.exports = {
  sendResetEmail, sendOrderPlacedEmail, sendOrderPaidEmail, sendOrderPendingEmail, sendOrderCancelledEmail,
  sendOrderFailedEmail, sendOrderRefundedEmail, sendWelcomeEmail, sendDownloadReadyEmail, sendContactFormEmail,
  sendSupportTicketEmail, sendSupportReplyEmail, sendNewsletterConfirmationEmail, sendPasswordResetConfirmationEmail,
  sendConsultationConfirmationEmail, sendConsultationRescheduledEmail, sendConsultationCancelledEmail, sendConsultationReminderEmail,
  // re-exported for convenience so callers can migrate without a second import
  sendTemplateEmail: emailService.sendTemplateEmail,
  sendRawEmail:      emailService.sendRawEmail,
}
