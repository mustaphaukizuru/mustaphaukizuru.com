const prisma = require("../lib/prisma")

const DEFAULT_TEMPLATES = [
  { key:"welcome",               subject:"Welcome to Mustapha Ukizuru Platform 🎉",       htmlBody:"<p>Welcome {{userName}}! Your account is ready.</p>" },
  { key:"order_confirmation",    subject:"Order Confirmed – #{{orderNumber}}",              htmlBody:"<p>Hi {{userName}}, your order #{{orderNumber}} is confirmed.</p>" },
  { key:"payment_confirmation",  subject:"Payment Received – ${{amount}}",                 htmlBody:"<p>Hi {{userName}}, payment of ${{amount}} received for order #{{orderNumber}}.</p>" },
  { key:"download_ready",        subject:"Your Download is Ready 📦",                       htmlBody:"<p>Hi {{userName}}, your product {{productTitle}} is ready to download.</p>" },
  { key:"password_reset",        subject:"Reset Your Password",                             htmlBody:"<p>Hi {{userName}}, click here to reset your password: {{resetUrl}}</p>" },
  { key:"refund_notification",   subject:"Refund Processed – #{{orderNumber}}",             htmlBody:"<p>Hi {{userName}}, your refund of ${{refundAmount}} has been processed.</p>" },
  { key:"support_reply",         subject:"Support Reply – Ticket #{{ticketNumber}}",        htmlBody:"<p>Hi {{userName}}, our team replied to your ticket.</p>" },
  { key:"newsletter_welcome",    subject:"You're Subscribed! Stay Up to Date",              htmlBody:"<p>Thanks for subscribing to updates from Mustapha Ukizuru.</p>" },
  { key:"service_confirmation",  subject:"Service Request Confirmed – {{serviceName}}",     htmlBody:"<p>Hi {{userName}}, your service request for {{serviceName}} is confirmed.</p>" },
  { key:"consultation_scheduled",subject:"Consultation Scheduled – {{dateTime}}",           htmlBody:"<p>Hi {{userName}}, your consultation is scheduled for {{dateTime}}.</p>" },
  { key:"marketing_new_products",subject:"🆕 New Digital Products Available in the Store", htmlBody:"<p>Hi {{userName}}, we have new products available! Check them out.</p>" },
  { key:"marketing_promotion",   subject:"🎁 Special Offer – {{discountPercent}}% Off",    htmlBody:"<p>Hi {{userName}}, enjoy {{discountPercent}}% off your next purchase. Code: {{code}}</p>" },
]

const listTemplates = async (req, res) => {
  try {
    const dbTemplates = await prisma.emailTemplate.findMany({ orderBy: { key: "asc" } }).catch(() => [])
    const dbMap = new Map(dbTemplates.map(t => [t.key, t]))
    const merged = DEFAULT_TEMPLATES.map(d => dbMap.get(d.key) || { ...d, id: null, isActive: true, updatedAt: new Date() })
    return res.status(200).json({ success: true, data: merged })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

const getTemplate = async (req, res) => {
  try {
    const t = await prisma.emailTemplate.findUnique({ where: { key: req.params.key } })
    const def = DEFAULT_TEMPLATES.find(d => d.key === req.params.key)
    if (!t && !def) return res.status(404).json({ success: false, message: "Template not found" })
    return res.status(200).json({ success: true, data: t || { ...def, id: null, isActive: true } })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

const upsertTemplate = async (req, res) => {
  try {
    const { key } = req.params
    const { subject, htmlBody, textBody, isActive } = req.body
    const t = await prisma.emailTemplate.upsert({
      where: { key },
      update: { subject, htmlBody, textBody, isActive: isActive !== false },
      create: { key, subject, htmlBody, textBody: textBody || "", isActive: isActive !== false },
    })
    return res.status(200).json({ success: true, data: t })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

const sendTestEmail = async (req, res) => {
  try {
    const { to } = req.body
    const { key } = req.params
    if (!to) return res.status(400).json({ success: false, message: "Recipient 'to' is required" })
    // Log test send
    console.log(`[TEST EMAIL] Template: ${key} → ${to}`)
    return res.status(200).json({ success: true, message: `Test email for '${key}' logged (configure SMTP to send)` })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

module.exports = { listTemplates, getTemplate, upsertTemplate, sendTestEmail }
