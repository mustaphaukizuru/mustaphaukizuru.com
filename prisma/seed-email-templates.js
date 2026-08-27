/**
 * seed-email-templates.js
 *
 * Upserts the standard EmailTemplate rows (EN + ES) the platform needs to operate.
 * Idempotent — re-running this script overwrites the rows with the latest
 * brand-aligned HTML / text / subject. The admin can edit any row via the
 * admin panel afterwards; running this script again will REVERT those edits,
 * so once a template is in production you should edit it through the admin
 * UI (which writes to the same row via Prisma).
 *
 * Variables consumed by these templates (set via emailService.sendTemplateEmail):
 *   {{customerName}}     — first name only, e.g. "Mustapha"
 *   {{orderNumber}}      — short human-readable order ID (e.g. "MU-2026-0142")
 *   {{orderTotal}}       — pre-formatted currency string (e.g. "$120.00 USD")
 *   {{orderUrl}}         — direct link to /dashboard/orders/:id
 *   {{downloadUrl}}      — direct link to /dashboard/downloads
 *   {{productTitle}}     — single product title (download.ready)
 *   {{resetUrl}}         — password reset link
 *   {{supportTicketUrl}} — direct link to a support ticket
 *   {{message}}          — agent reply body (plain text, gets <br/>'d)
 *   {{confirmUrl}}       — newsletter double-opt-in confirm link
 *   {{unsubscribeUrl}}   — newsletter unsubscribe link
 *   {{gateway}}          — "Mercado Pago" or "PayPal"
 *   {{year}}             — current year (auto-populated below at send time)
 *
 * Run:
 *   node prisma/seed-email-templates.js
 */

const path = require("path")
require("dotenv").config({ path: path.join(__dirname, "..", ".env") })

const prisma = require("../src/lib/prisma")

/* ─────────────────────────── shared chrome ─────────────────────────────── */

const BRAND_VIOLET     = "#5D3FD3"
const BRAND_VIOLET_PALE = "#EDE9FB"
const BRAND_CHARCOAL   = "#1A1B23"
const BRAND_MIST       = "#F8FAFC"
const BRAND_MUTED      = "#3F4047"
const BRAND_FAINT      = "#8C8D92"

const SUPPORT_EMAIL = "hello@mustaphaukizuru.com"
const SITE_URL      = "https://mustaphaukizuru.com"

/**
 * Brand wrapper. The {{__BODY__}} sentinel is replaced with each template's
 * unique block before insertion. Email clients are stuck in 2002, so this
 * uses inlined styles + table layout — it's not pretty in the source but
 * renders correctly in Outlook, Gmail, Apple Mail, and Hostinger webmail.
 */
function chrome({ preheader, bodyHtml, eyebrow }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Mustapha Ukizuru</title>
  </head>
  <body style="margin:0;padding:0;background:${BRAND_MIST};font-family:'Helvetica Neue',Arial,sans-serif;color:${BRAND_CHARCOAL};">
    <span style="display:none;visibility:hidden;opacity:0;font-size:1px;line-height:1px;max-height:0;max-width:0;overflow:hidden;">
      ${escape(preheader || "")}
    </span>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND_MIST};">
      <tr>
        <td align="center" style="padding:40px 16px 24px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:18px;border:1px solid rgba(26,27,35,0.08);box-shadow:0 20px 60px -20px rgba(93,63,211,0.15);">

            <!-- Header band -->
            <tr>
              <td style="padding:28px 32px 0 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td>
                      <a href="${SITE_URL}" style="text-decoration:none;color:${BRAND_VIOLET};font-weight:700;font-size:15px;letter-spacing:-0.01em;">
                        mustaphaukizuru<span style="color:${BRAND_FAINT};">.com</span>
                      </a>
                    </td>
                    <td align="right">
                      <span style="display:inline-block;background:${BRAND_VIOLET_PALE};color:${BRAND_VIOLET};font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.18em;padding:4px 10px;border-radius:999px;">
                        ${escape(eyebrow || "Notification")}
                      </span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Body slot -->
            <tr>
              <td style="padding:32px;">
                ${bodyHtml}
              </td>
            </tr>

            <!-- Divider -->
            <tr>
              <td style="padding:0 32px;">
                <hr style="border:none;border-top:1px solid rgba(26,27,35,0.08);margin:0;" />
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:18px 32px 28px 32px;font-size:12px;color:${BRAND_FAINT};line-height:1.6;">
                <p style="margin:0 0 6px 0;">
                  Mustapha Ukizuru · Tlalnepantla de Baz, Estado de México · 🇲🇽
                </p>
                <p style="margin:0;">
                  Replies go to <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_VIOLET};text-decoration:none;font-weight:600;">${SUPPORT_EMAIL}</a>.
                </p>
              </td>
            </tr>
          </table>

          <p style="margin:18px 0 0 0;font-size:11px;color:${BRAND_FAINT};">
            © {{year}} Mustapha Ukizuru. Sent from <a href="${SITE_URL}" style="color:${BRAND_FAINT};text-decoration:underline;">${SITE_URL.replace(/^https?:\/\//, "")}</a>.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function button(href, label) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
      <tr>
        <td bgcolor="${BRAND_VIOLET}" style="border-radius:999px;">
          <a href="${href}" style="display:inline-block;padding:14px 26px;font-size:13.5px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;letter-spacing:0.01em;">
            ${escape(label)} →
          </a>
        </td>
      </tr>
    </table>`
}

function paragraph(html) {
  return `<p style="margin:0 0 14px 0;font-size:15px;line-height:1.65;color:${BRAND_MUTED};">${html}</p>`
}

function heading(text) {
  return `<h1 style="margin:0 0 16px 0;font-size:24px;line-height:1.25;font-weight:700;color:${BRAND_CHARCOAL};letter-spacing:-0.01em;">${escape(text)}</h1>`
}

function calloutCard(html) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 18px 0;">
      <tr>
        <td style="background:${BRAND_VIOLET_PALE};padding:16px 18px;border-radius:14px;font-size:13.5px;line-height:1.6;color:${BRAND_VIOLET};font-weight:600;">
          ${html}
        </td>
      </tr>
    </table>`
}

function escape(s = "") {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

/* ─────────────────────────── templates ─────────────────────────────────── */

const TEMPLATES = [
  // 0a · Welcome (sent on signup)
  {
    key: "auth.welcome",
    subject: "Welcome to mustaphaukizuru.com, {{customerName}}",
    html: chrome({
      preheader: "Your account is live. Here's what you can do next.",
      eyebrow:   "Welcome",
      bodyHtml:
        heading(`Welcome aboard, {{customerName}}.`) +
        paragraph(`Your account at <a href="${SITE_URL}" style="color:${BRAND_VIOLET};">mustaphaukizuru.com</a> is active. You can now save your address, track orders, download anything you've purchased, and book a consultation in one click.`) +
        button("{{dashboardUrl}}", "Open your dashboard") +
        paragraph(`Browse the <a href="${SITE_URL}/store" style="color:${BRAND_VIOLET};">store</a> for digital products and templates, or check the <a href="${SITE_URL}/services" style="color:${BRAND_VIOLET};">services page</a> for consulting + project work.`) +
        calloutCard(`Reply to this email anytime — it goes straight to me.`),
    }),
    text: [
      "Welcome to mustaphaukizuru.com, {{customerName}}.",
      "",
      "Your account is live. Open your dashboard:",
      "  {{dashboardUrl}}",
      "",
      "Browse the store: " + SITE_URL + "/store",
      "Check services:    " + SITE_URL + "/services",
      "",
      "Reply to this email anytime.",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // 0b · Order placed (sent immediately on checkout, before payment confirmed)
  {
    key: "order.placed",
    subject: "Order {{orderNumber}} received — payment pending",
    html: chrome({
      preheader: "We've received your order. Payment confirmation is next.",
      eyebrow:   "Order received",
      bodyHtml:
        heading(`Thanks {{customerName}} — order {{orderNumber}} is in.`) +
        paragraph(`We've received your order for <strong>{{orderTotal}}</strong> and it's waiting on payment confirmation. You'll get a second email the moment the payment clears with your downloads and receipt.`) +
        button("{{orderUrl}}", "View order status") +
        paragraph(`Payment usually clears within a few minutes. If your order stays pending for more than 15 minutes, check your payment method or reply to this email.`),
    }),
    text: [
      "Order {{orderNumber}} received — payment pending.",
      "",
      "Thanks {{customerName}}. We've received your order for {{orderTotal}}.",
      "You'll get a second email when payment clears.",
      "",
      "Track status:",
      "  {{orderUrl}}",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // 0c · Contact form — admin notification
  {
    key: "contact.admin",
    subject: "New contact form submission — {{name}}",
    html: chrome({
      preheader: "{{name}} just submitted the contact form.",
      eyebrow:   "Contact form",
      bodyHtml:
        heading(`New message from {{name}}`) +
        paragraph(`<strong>From:</strong> {{name}} &lt;{{email}}&gt;<br/><strong>Subject:</strong> {{subject}}`) +
        calloutCard(`{{message}}`) +
        paragraph(`Reply directly to this email to respond to {{name}}.`),
    }),
    text: [
      "New contact form submission",
      "",
      "From:    {{name}} <{{email}}>",
      "Subject: {{subject}}",
      "",
      "{{message}}",
      "",
      "Reply directly to this email to respond.",
    ].join("\n"),
  },

  // 0d · Contact form — customer auto-acknowledgement
  {
    key: "contact.confirm",
    subject: "Got your message, {{name}} — I'll be in touch shortly",
    html: chrome({
      preheader: "Thanks for reaching out. Reply within 24 hours.",
      eyebrow:   "Message received",
      bodyHtml:
        heading(`Thanks for reaching out, {{name}}.`) +
        paragraph(`I've got your message and will reply personally within 24 hours (Monday–Friday, Mexico City time). Most replies happen the same day.`) +
        paragraph(`If your question is urgent or it's been more than 24 hours, just reply to this email — it lands in my inbox, not a queue.`) +
        calloutCard(`While you wait: <a href="${SITE_URL}/store" style="color:${BRAND_VIOLET};">browse the store</a> or <a href="${SITE_URL}/services" style="color:${BRAND_VIOLET};">check what I can help with</a>.`),
    }),
    text: [
      "Thanks for reaching out, {{name}}.",
      "",
      "I've got your message and will reply within 24 hours (Mon-Fri, Mexico City time).",
      "Most replies happen the same day.",
      "",
      "Urgent? Just reply to this email — it lands in my inbox, not a queue.",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // 1 · Order confirmation (after payment)
  {
    key: "order.confirmed",
    subject: "Order {{orderNumber}} confirmed — thank you, {{customerName}}",
    html: chrome({
      preheader: "Your order is confirmed and ready to download.",
      eyebrow:   "Order confirmed",
      bodyHtml:
        heading(`Thanks {{customerName}} — your order is paid.`) +
        paragraph(`Order <strong>{{orderNumber}}</strong> for <strong>{{orderTotal}}</strong> went through cleanly via {{gateway}}. Your downloads and receipt are waiting in your dashboard.`) +
        calloutCard(`Need a hand? Reply to this email — it lands in my inbox, not a queue.`) +
        button("{{orderUrl}}", "View order") +
        paragraph(`If anything looks off, hit reply within 14 days and we'll sort it.`),
    }),
    text: [
      "Order {{orderNumber}} confirmed — thank you {{customerName}}.",
      "",
      "Your order for {{orderTotal}} went through cleanly via {{gateway}}.",
      "Downloads and receipt are in your dashboard:",
      "  {{orderUrl}}",
      "",
      "Need a hand? Reply to this email.",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // 2 · Download ready (entitlement created)
  {
    key: "download.ready",
    subject: "Your download is ready — {{productTitle}}",
    html: chrome({
      preheader: "Your purchase is unlocked.",
      eyebrow:   "Download ready",
      bodyHtml:
        heading(`Your download is ready, {{customerName}}.`) +
        paragraph(`<strong>{{productTitle}}</strong> is unlocked on your dashboard. The link is tied to your account — there's no expiry while your purchase remains active.`) +
        button("{{downloadUrl}}", "Open downloads") +
        paragraph(`Save the file locally — that way you'll have it even if you change devices.`),
    }),
    text: [
      "Your download is ready — {{productTitle}}.",
      "",
      "Open it from your dashboard:",
      "  {{downloadUrl}}",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // 3 · Password reset
  {
    key: "auth.password-reset",
    subject: "Reset your password — mustaphaukizuru.com",
    html: chrome({
      preheader: "Use the button below within 30 minutes to set a new password.",
      eyebrow:   "Password reset",
      bodyHtml:
        heading(`Reset your password.`) +
        paragraph(`We received a request to reset the password for your account. The link below expires in 30 minutes.`) +
        button("{{resetUrl}}", "Set a new password") +
        paragraph(`If you didn't request this, ignore the email — your password stays the same. For peace of mind, you can also enable two-factor authentication from your dashboard.`) +
        calloutCard(`Heads up: we'll never ask for your password by email or chat.`),
    }),
    text: [
      "Reset your password — mustaphaukizuru.com",
      "",
      "Use this link within 30 minutes to set a new password:",
      "  {{resetUrl}}",
      "",
      "If you didn't request this, ignore the email — nothing changes.",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // 3.5 · Account claim · sent when guest checkout auto-creates an account
  {
    key: "auth.account-claim",
    subject: "Order {{orderNumber}} confirmed — set your password to access your downloads",
    html: chrome({
      preheader: "Your purchase is in. One quick step to unlock your downloads.",
      eyebrow:   "Welcome",
      bodyHtml:
        heading(`Welcome, {{customerName}}.`) +
        paragraph(`Thanks for your order — <strong>{{orderNumber}}</strong> is confirmed and your downloads are waiting in your dashboard.`) +
        paragraph(`We created an account for you using this email so you can access your purchases anytime. Set a password using the button below — it stays valid for 14 days.`) +
        button("{{claimUrl}}", "Set your password") +
        paragraph(`Once your password is set, sign in at <a href="${SITE_URL}/login" style="color:${BRAND_VIOLET};">${SITE_URL.replace(/^https?:\/\//, "")}/login</a> any time to re-download, view past orders, or contact support.`) +
        calloutCard(`Didn't make a purchase? You can safely ignore this email — no account is active until you set a password.`),
    }),
    text: [
      "Order {{orderNumber}} confirmed — set your password",
      "",
      "Welcome, {{customerName}}.",
      "",
      "Your purchase is in. We created an account using this email so you can",
      "access your downloads anytime. Set your password (valid 14 days):",
      "  {{claimUrl}}",
      "",
      "Once set, sign in at " + SITE_URL + "/login.",
      "",
      "Didn't make a purchase? Ignore this email — no account is active until you set a password.",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // 4 · Newsletter double-opt-in
  {
    key: "newsletter.confirm",
    subject: "Confirm your subscription — mustaphaukizuru.com",
    html: chrome({
      preheader: "One click to confirm your subscription.",
      eyebrow:   "Confirm subscription",
      bodyHtml:
        heading(`Confirm you're in.`) +
        paragraph(`Thanks for subscribing. To start receiving the newsletter — quarterly notes on engineering, product, and what I'm shipping — click the button below.`) +
        button("{{confirmUrl}}", "Confirm subscription") +
        paragraph(`No confirmation, no emails — your address is dropped automatically after 7 days if we don't hear back.`),
    }),
    text: [
      "Confirm your subscription — mustaphaukizuru.com",
      "",
      "Click here to confirm:",
      "  {{confirmUrl}}",
      "",
      "No confirmation, no emails — your address is dropped after 7 days.",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // 4.5 · Project milestone completed (priority #8 client project mgmt)
  {
    key: "project.milestone-completed",
    subject: "Milestone done: {{milestoneTitle}} — {{projectName}}",
    html: chrome({
      preheader: "A milestone on your project has been marked complete.",
      eyebrow:   "Milestone update",
      bodyHtml:
        heading(`Milestone complete: {{milestoneTitle}}`) +
        paragraph(`Good news — the milestone <strong>{{milestoneTitle}}</strong> on your project <strong>{{projectName}}</strong> has been marked complete.`) +
        paragraph(`Open your project dashboard to see the latest deliverables, timeline, and what's coming next.`) +
        button("{{dashboardUrl}}", "View project") +
        calloutCard(`Questions or feedback on this milestone? Reply to this email — it threads back to the project owner.`),
    }),
    text: [
      "Milestone complete: {{milestoneTitle}}",
      "",
      "Good news — the milestone {{milestoneTitle}} on your project",
      "{{projectName}} has been marked complete.",
      "",
      "View project dashboard:",
      "  {{dashboardUrl}}",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // 4b · Milestone awaiting client approval (Tier 2 client portal)
  {
    key: "project.approval-requested",
    subject: "Your review is needed: {{milestoneTitle}} — {{projectName}}",
    html: chrome({
      preheader: "A milestone is ready for your approval.",
      eyebrow:   "Review requested",
      bodyHtml:
        heading(`Ready for your review: {{milestoneTitle}}`) +
        paragraph(`The milestone <strong>{{milestoneTitle}}</strong> on <strong>{{projectName}}</strong> has been delivered and is waiting for your sign-off.`) +
        paragraph(`Open the project, look at the deliverables, and either approve it with one click or tell us what should change. Approving moves the work to the next phase.`) +
        button("{{dashboardUrl}}", "Review and approve") +
        calloutCard(`Nothing to approve yet? Leave a comment on the milestone instead — it lands directly with the project owner.`),
    }),
    text: [
      "Ready for your review: {{milestoneTitle}}",
      "",
      "The milestone {{milestoneTitle}} on {{projectName}} has been delivered",
      "and is waiting for your sign-off. Approve it or request changes here:",
      "  {{dashboardUrl}}",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // 4c · Portal PIN (Tier 4 magic-link portal, no login)
  {
    key: "portal.pin",
    subject: "Your access PIN for {{projectName}}: {{pin}}",
    html: chrome({
      preheader: "Your one-time PIN to open the project portal.",
      eyebrow:   "Project portal",
      bodyHtml:
        heading(`Your PIN: {{pin}}`) +
        paragraph(`Someone opened the portal link for <strong>{{projectName}}</strong>. Enter this PIN on the page to see the project's milestones, files and preview:`) +
        calloutCard(`<span style="font-family:monospace;font-size:28px;letter-spacing:6px;font-weight:700">{{pin}}</span>`) +
        paragraph(`The PIN expires in {{expiresMinutes}} minutes and works once. If you did not open the link, you can ignore this email — nothing is shared without the PIN.`),
    }),
    text: [
      "Your PIN: {{pin}}",
      "",
      "Someone opened the portal link for {{projectName}}. Enter this PIN on the",
      "page to see the project's milestones, files and preview.",
      "",
      "The PIN expires in {{expiresMinutes}} minutes and works once. If you did",
      "not open the link, ignore this email.",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // 4d · Review request when a project is completed (Tier 4)
  {
    key: "project.review-request",
    subject: "{{projectName}} is complete — how did we do?",
    html: chrome({
      preheader: "Two minutes to share how the project went.",
      eyebrow:   "Project complete",
      bodyHtml:
        heading(`{{projectName}} is done`) +
        paragraph(`Thank you for working with me on <strong>{{projectName}}</strong>. The project is now marked complete and your files stay available in your dashboard for a while longer.`) +
        paragraph(`If you have two minutes, a short review of <strong>{{serviceName}}</strong> helps the next client decide — and tells me what to keep doing.`) +
        button("{{reviewUrl}}", "Leave a review") +
        calloutCard(`Prefer to say it privately? Just reply to this email.`),
    }),
    text: [
      "{{projectName}} is done",
      "",
      "Thank you for working with me on {{projectName}}. The project is now",
      "marked complete. If you have two minutes, a short review helps the",
      "next client decide:",
      "  {{reviewUrl}}",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // 5 · Support reply
  {
    key: "support.reply",
    subject: "Re: your support ticket #{{orderNumber}}",
    html: chrome({
      preheader: "A reply has been added to your support ticket.",
      eyebrow:   "Support reply",
      bodyHtml:
        heading(`Hi {{customerName}} — reply added to your ticket.`) +
        paragraph(`{{message}}`) +
        button("{{supportTicketUrl}}", "View ticket") +
        paragraph(`Just reply to this email if you need to add anything — it threads back into the same ticket.`),
    }),
    text: [
      "Re: your support ticket #{{orderNumber}}",
      "",
      "Hi {{customerName}},",
      "",
      "{{message}}",
      "",
      "View the full ticket:",
      "  {{supportTicketUrl}}",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // 6 · Order refunded
  // Tier 4 · manual invoice issued
  {
    key: "invoice.issued",
    subject: "Invoice {{invoiceNumber}} — {{orderTotal}} due {{dueDate}}",
    html: chrome({
      preheader: "A new invoice is ready for you.",
      eyebrow:   "Invoice",
      bodyHtml:
        heading(`Hi {{customerName}}, you have a new invoice.`) +
        paragraph(`Invoice <strong>{{invoiceNumber}}</strong> for <strong>{{description}}</strong> is ready. The amount is <strong>{{orderTotal}}</strong>, due on <strong>{{dueDate}}</strong>.`) +
        button("{{orderUrl}}", "View and pay invoice") +
        calloutCard(`Pay online with Mercado Pago or PayPal from the link above. Invoices paid after the due date incur a late fee; questions or a different arrangement — just reply to this email.`),
    }),
    text: [
      "Invoice {{invoiceNumber}} — {{orderTotal}} due {{dueDate}}",
      "",
      "Hi {{customerName}}, invoice {{invoiceNumber}} for {{description}}",
      "is ready. Amount: {{orderTotal}}. Due: {{dueDate}}.",
      "View and pay: {{orderUrl}}",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // Tier 4 · invoice overdue (sent once by invoiceDunningJob)
  {
    key: "invoice.overdue",
    subject: "Invoice {{invoiceNumber}} is overdue",
    html: chrome({
      preheader: "Your invoice was due {{dueDate}}.",
      eyebrow:   "Payment reminder",
      bodyHtml:
        heading(`Invoice {{invoiceNumber}} is past due.`) +
        paragraph(`Hi {{customerName}}, invoice <strong>{{invoiceNumber}}</strong> for <strong>{{orderTotal}}</strong> was due on <strong>{{dueDate}}</strong> and is still unpaid. A late fee of <strong>{{lateFee}}</strong> has been applied, bringing the balance to <strong>{{amountDue}}</strong>.`) +
        button("{{orderUrl}}", "Pay now") +
        calloutCard(`Project access is paused while a balance stays overdue, and deliverables are released once it is settled. Already paid? Ignore this message — it can take a few hours to reconcile.`),
    }),
    text: [
      "Invoice {{invoiceNumber}} is overdue",
      "",
      "Hi {{customerName}}, invoice {{invoiceNumber}} for {{orderTotal}} was due",
      "on {{dueDate}} and is still unpaid. Late fee applied: {{lateFee}}.",
      "Balance: {{amountDue}}. Pay now: {{orderUrl}}",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // Tier 4 · change request quoted
  {
    key: "project.change-request-quoted",
    subject: "Quote ready: {{requestTitle}} — {{projectName}}",
    html: chrome({
      preheader: "Your extra-work request has been quoted.",
      eyebrow:   "Quote ready",
      bodyHtml:
        heading(`Hi {{customerName}}, your quote is ready.`) +
        paragraph(`We reviewed <strong>{{requestTitle}}</strong> on <strong>{{projectName}}</strong>. The extra work comes to <strong>{{quoteAmount}}</strong>.`) +
        calloutCard(`<strong>Notes from the team:</strong><br/>{{quoteNote}}`) +
        paragraph(`Accept the quote from the project page and you'll get a payable order right away — work on the new milestone starts once it's paid. You can also decline it; nothing changes on the project.`) +
        button("{{dashboardUrl}}", "Review the quote"),
    }),
    text: [
      "Quote ready: {{requestTitle}} — {{projectName}}",
      "",
      "Hi {{customerName}}, the extra work \"{{requestTitle}}\" comes to {{quoteAmount}}.",
      "Notes: {{quoteNote}}",
      "Accept or decline it here: {{dashboardUrl}}",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  {
    key: "order.refunded",
    subject: "Refund processed — order {{orderNumber}}",
    html: chrome({
      preheader: "Your refund has been issued.",
      eyebrow:   "Refund processed",
      bodyHtml:
        heading(`Refund processed, {{customerName}}.`) +
        paragraph(`We've issued a refund of <strong>{{orderTotal}}</strong> on order <strong>{{orderNumber}}</strong>. Most banks post the credit within 3-7 business days; some are faster.`) +
        button("{{orderUrl}}", "View order") +
        paragraph(`If the credit hasn't appeared after a week, reply to this email with your bank's name and we'll trace it.`),
    }),
    text: [
      "Refund processed — order {{orderNumber}}",
      "",
      "Hi {{customerName}}, we've issued a refund of {{orderTotal}}.",
      "Most banks post within 3-7 business days.",
      "",
      "View order:",
      "  {{orderUrl}}",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // 7 · Review approved — fires when admin marks a queued review as live
  {
    key: "review.approved",
    subject: "Your review of {{subjectTitle}} is live",
    html: chrome({
      preheader: "Your review just went live — thanks for sharing.",
      eyebrow:   "Review approved",
      bodyHtml:
        heading(`Thanks for the review, {{customerName}}.`) +
        paragraph(`Your <strong>{{rating}}-star</strong> review of <strong>{{subjectTitle}}</strong> is now live on the site. Reviews from real customers are the best way for new visitors to figure out whether something will work for them — so this genuinely helps.`) +
        button("{{subjectUrl}}", "See your review") +
        paragraph(`Want to add a photo or update your thoughts? You can edit or remove your review any time from the same page within the next 30 days.`),
    }),
    text: [
      "Your review of {{subjectTitle}} is live",
      "",
      "Hi {{customerName}}, your {{rating}}-star review just went live.",
      "",
      "See it on:",
      "  {{subjectUrl}}",
      "",
      "You can edit or remove it any time within 30 days.",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // 8 · Review replied — fires when admin posts/updates a public reply
  {
    key: "review.replied",
    subject: "We replied to your review of {{subjectTitle}}",
    html: chrome({
      preheader: "A reply has been added to your review.",
      eyebrow:   "Reply added",
      bodyHtml:
        heading(`Hi {{customerName}} — we replied.`) +
        paragraph(`We've added a public reply to your review of <strong>{{subjectTitle}}</strong>. The reply now appears under your review on the site:`) +
        calloutCard(`{{adminReply}}`) +
        button("{{subjectUrl}}", "Read the reply") +
        paragraph(`If you'd like to respond directly, just reply to this email — it goes straight to me.`),
    }),
    text: [
      "We replied to your review of {{subjectTitle}}",
      "",
      "Hi {{customerName}},",
      "",
      "{{adminReply}}",
      "",
      "Read the full thread:",
      "  {{subjectUrl}}",
      "",
      "Reply to this email anytime.",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // 9 · Review rejected — fires when admin rejects a queued review
  {
    key: "review.rejected",
    subject: "Your review of {{subjectTitle}} couldn't be published",
    html: chrome({
      preheader: "We weren't able to publish your review.",
      eyebrow:   "Review not published",
      bodyHtml:
        heading(`Hi {{customerName}} — a heads-up about your review.`) +
        paragraph(`We weren't able to publish your <strong>{{rating}}-star</strong> review of <strong>{{subjectTitle}}</strong>. This usually happens when a review contains contact details, links, or language that falls outside our community guidelines, but it can also be a borderline call.`) +
        paragraph(`If you'd still like your feedback to reach us, please reply to this email — it goes straight to me and I'll make sure it's heard.`) +
        button("{{subjectUrl}}", "Visit the page"),
    }),
    text: [
      "Your review of {{subjectTitle}} couldn't be published",
      "",
      "Hi {{customerName}}, we weren't able to publish your {{rating}}-star review.",
      "",
      "Most often this is because of contact details, links, or community-guideline issues.",
      "",
      "If you'd like your feedback to reach us anyway, reply to this email.",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // 10 · Consultation confirmed — fires when admin confirms a booking
  // Variables: customerName · scheduledAt · durationMin · timezone ·
  //            serviceTitle · hostName · meetingLink · consultationUrl
  {
    key: "consultation.confirmed",
    subject: "Your consultation is confirmed — {{scheduledAt}}",
    html: chrome({
      preheader: "Your call is on the calendar. Join link inside.",
      eyebrow:   "Consultation confirmed",
      bodyHtml:
        heading(`See you on {{scheduledAt}}, {{customerName}}.`) +
        paragraph(`Your <strong>{{serviceTitle}}</strong> ({{durationMin}} min) with {{hostName}} is confirmed. The join link below opens the meeting room — no account or download required.`) +
        calloutCard(`<strong>Join link:</strong><br><a href="{{meetingLink}}" style="color:${BRAND_VIOLET};">{{meetingLink}}</a>`) +
        button("{{meetingLink}}", "Join the meeting") +
        paragraph(`Save this email — the link works on phone, tablet, or laptop. If something comes up, you can reschedule or cancel from your dashboard:`) +
        button("{{consultationUrl}}", "Manage consultation"),
    }),
    text: [
      "Your consultation is confirmed — {{scheduledAt}}",
      "",
      "Hi {{customerName}}, your {{serviceTitle}} ({{durationMin}} min) with {{hostName}}",
      "is confirmed on {{scheduledAt}} ({{timezone}}).",
      "",
      "Join link:",
      "  {{meetingLink}}",
      "",
      "Manage your booking:",
      "  {{consultationUrl}}",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // 11 · Consultation rescheduled — fires when admin or client moves a booking
  // Variables: customerName · scheduledAt (new) · previousScheduledAt (old) ·
  //            durationMin · timezone · serviceTitle · hostName ·
  //            meetingLink · consultationUrl
  // The meetingLink is the SAME across reschedules when the booking is on
  // Google Meet (same Calendar event → same URL). For Jitsi-fallback
  // bookings the link is regenerated; either way the variable is filled.
  {
    key: "consultation.rescheduled",
    subject: "Your consultation has moved — now {{scheduledAt}}",
    html: chrome({
      preheader: "Same meeting, new time. Join link inside.",
      eyebrow:   "Consultation rescheduled",
      bodyHtml:
        heading(`New time: {{scheduledAt}}, {{customerName}}.`) +
        paragraph(`Your <strong>{{serviceTitle}}</strong> ({{durationMin}} min) with {{hostName}} has been moved. The same join link works — save it now so you have it ready.`) +
        calloutCard(
          `<strong>Previous time:</strong> <span style="text-decoration:line-through;opacity:0.6;">{{previousScheduledAt}}</span><br>` +
          `<strong>New time:</strong> {{scheduledAt}} ({{timezone}})<br><br>` +
          `<strong>Join link:</strong><br><a href="{{meetingLink}}" style="color:${BRAND_VIOLET};">{{meetingLink}}</a>`
        ) +
        button("{{meetingLink}}", "Join the meeting") +
        paragraph(`If the new time doesn't work, you can reschedule or cancel from your dashboard:`) +
        button("{{consultationUrl}}", "Manage consultation"),
    }),
    text: [
      "Your consultation has moved — now {{scheduledAt}}",
      "",
      "Hi {{customerName}}, your {{serviceTitle}} ({{durationMin}} min) with {{hostName}}",
      "has been rescheduled.",
      "",
      "Previous time: {{previousScheduledAt}}",
      "New time:      {{scheduledAt}} ({{timezone}})",
      "",
      "Join link (unchanged):",
      "  {{meetingLink}}",
      "",
      "Manage your booking:",
      "  {{consultationUrl}}",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  /* ── Step 41 · templates migrated out of utils/mailer.js ─────────────────
   * These are CONTENT FRAGMENTS (no <!doctype>): emailService wraps them
   * with services/emailLayoutService.wrap() at send time, so they pick up
   * the shared header/footer chrome automatically.
   * ───────────────────────────────────────────────────────────────────── */

  // 12 · Order pending (admin moved the order back to pending)
  // cart.abandoned · S2 · one reminder, once, when a signed-in customer's
  // cart has had no activity for a few hours. Sent by
  // src/jobs/abandonedCartJob.js, deduped per user via EmailLog.
  // Variables: customerName · itemCount · firstItem · itemsSummary · cartTotal · cartUrl
  {
    key: "cart.abandoned",
    subject: "You left {{firstItem}} in your cart",
    html:
      heading(`Still thinking it over, {{customerName}}?`) +
      paragraph(`You have <strong>{{itemCount}}</strong> item(s) waiting in your cart — {{itemsSummary}} — for <strong>{{cartTotal}}</strong>. Your cart is saved exactly as you left it.`) +
      paragraph(`Digital downloads are delivered instantly after checkout, and every purchase comes with a full-refund guarantee.`) +
      button("{{cartUrl}}", "Return to your cart"),
    text: [
      "Still thinking it over, {{customerName}}?",
      "",
      "You have {{itemCount}} item(s) waiting in your cart:",
      "  {{itemsSummary}}",
      "for {{cartTotal}}. Your cart is saved exactly as you left it.",
      "",
      "Digital downloads are delivered instantly after checkout, and every",
      "purchase comes with a full-refund guarantee.",
      "",
      "Return to your cart:",
      "  {{cartUrl}}",
      "",
      "You are receiving this because you have an account and items in your",
      "cart. We send at most one reminder a week.",
    ].join("\n"),
  },
  // Variables: customerName · orderNumber · orderTotal · orderUrl
  {
    key: "order.pending",
    subject: "Order {{orderNumber}} is pending",
    html:
      heading(`Order {{orderNumber}} is pending, {{customerName}}.`) +
      paragraph(`Your order for <strong>{{orderTotal}}</strong> is waiting on payment confirmation or review. No action is needed from you right now — you'll get another email as soon as it's confirmed.`) +
      button("{{orderUrl}}", "View order status"),
    text: [
      "Order {{orderNumber}} is pending.",
      "",
      "Hi {{customerName}}, your order for {{orderTotal}} is waiting on payment",
      "confirmation or review. No action is needed right now.",
      "",
      "Track status:",
      "  {{orderUrl}}",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // 13 · Order cancelled
  // Variables: customerName · orderNumber · orderTotal · orderUrl
  {
    key: "order.cancelled",
    subject: "Order {{orderNumber}} was cancelled",
    html:
      heading(`Order {{orderNumber}} was cancelled.`) +
      paragraph(`Hi {{customerName}}, your order for <strong>{{orderTotal}}</strong> has been cancelled. If this was a mistake or you need help, reply to this email and we'll sort it out.`) +
      button(SITE_URL + "/store", "Back to the store"),
    text: [
      "Order {{orderNumber}} was cancelled.",
      "",
      "Hi {{customerName}}, your order for {{orderTotal}} has been cancelled.",
      "If this was a mistake, reply to this email.",
      "",
      "Store: " + SITE_URL + "/store",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // 14 · Payment failed
  // Variables: customerName · orderNumber · orderTotal · orderUrl
  {
    key: "order.failed",
    subject: "Payment failed for order {{orderNumber}}",
    html:
      heading(`We couldn't process your payment, {{customerName}}.`) +
      paragraph(`The payment for order <strong>{{orderNumber}}</strong> ({{orderTotal}}) didn't go through. This usually means the card was declined or the payment session expired.`) +
      button(SITE_URL + "/store", "Try again") +
      calloutCard(`If it keeps failing, try a different payment method or contact your bank. Reply to this email if you need a hand.`),
    text: [
      "Payment failed for order {{orderNumber}}.",
      "",
      "Hi {{customerName}}, the payment for {{orderTotal}} didn't go through.",
      "Try again: " + SITE_URL + "/store",
      "",
      "If it keeps failing, try another payment method or reply to this email.",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // 15 · Password changed (security notice)
  // Variables: loginUrl · changedAt
  {
    key: "auth.password-changed",
    subject: "Your password was changed",
    html:
      heading(`Password updated.`) +
      paragraph(`Your account password was changed successfully on {{changedAt}}.`) +
      paragraph(`If you made this change, no further action is needed. If you did <strong>not</strong> change your password, reply to this email immediately so we can secure your account.`) +
      button("{{loginUrl}}", "Sign in"),
    text: [
      "Your password was changed on {{changedAt}}.",
      "",
      "If you made this change, no action is needed.",
      "If you did NOT change your password, reply to this email immediately.",
      "",
      "Sign in: {{loginUrl}}",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // 16 · Support ticket created
  // Variables: customerName · ticketNumber · subject · priority · supportTicketUrl
  {
    key: "support.created",
    subject: "Support ticket #{{ticketNumber}} received",
    html:
      heading(`We've got your request, {{customerName}}.`) +
      paragraph(`Ticket <strong>#{{ticketNumber}}</strong> — <em>{{subject}}</em> — is open with priority <strong>{{priority}}</strong>. We'll reply as soon as possible and you'll get an email when we do.`) +
      button("{{supportTicketUrl}}", "View ticket"),
    text: [
      "Support ticket #{{ticketNumber}} received.",
      "",
      "Hi {{customerName}}, your request \"{{subject}}\" (priority: {{priority}}) is open.",
      "You'll get an email when we reply.",
      "",
      "View ticket: {{supportTicketUrl}}",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // 17 · Newsletter welcome (single opt-in confirmation)
  // Variables: storeUrl · unsubscribeUrl
  {
    key: "newsletter.welcome",
    subject: "You're subscribed",
    html:
      heading(`You're on the list.`) +
      paragraph(`Thanks for subscribing. Expect occasional updates about new digital products, technology insights, and service announcements — quality content, not spam.`) +
      button("{{storeUrl}}", "Explore the store") +
      paragraph(`Changed your mind? <a href="{{unsubscribeUrl}}" style="color:${BRAND_VIOLET};">Unsubscribe</a> any time.`),
    text: [
      "You're subscribed.",
      "",
      "Thanks for subscribing. Expect occasional updates about new products,",
      "technology insights and service announcements.",
      "",
      "Store: {{storeUrl}}",
      "Unsubscribe: {{unsubscribeUrl}}",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // 18 · Consultation cancelled (ICS CANCEL attached by mailer facade)
  // Variables: customerName · scheduledAt · serviceTitle · hostName ·
  //            durationMin · timezone · cancellationReason
  {
    key: "consultation.cancelled",
    subject: "Cancelled — consultation on {{scheduledAt}}",
    html:
      heading(`Your consultation was cancelled.`) +
      paragraph(`Hi {{customerName}}, the <strong>{{serviceTitle}}</strong> ({{durationMin}} min) with {{hostName}} on <strong>{{scheduledAt}}</strong> ({{timezone}}) has been cancelled.`) +
      calloutCard(`Reason: {{cancellationReason}}`) +
      button(SITE_URL + "/services", "Book another time") +
      paragraph(`If this was a mistake, you can book a new consultation from the services page.`),
    text: [
      "Your consultation was cancelled.",
      "",
      "Hi {{customerName}}, the {{serviceTitle}} ({{durationMin}} min) with {{hostName}}",
      "on {{scheduledAt}} ({{timezone}}) has been cancelled.",
      "Reason: {{cancellationReason}}",
      "",
      "Book another time: " + SITE_URL + "/services",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // 19 · Consultation reminder (24h / 1h, ICS REQUEST attached)
  // Variables: customerName · whenLabel · scheduledAt · serviceTitle ·
  //            hostName · durationMin · timezone · meetingLink · consultationUrl
  {
    key: "consultation.reminder",
    subject: "Reminder — your consultation is {{whenLabel}}",
    html:
      heading(`Your consultation is {{whenLabel}}, {{customerName}}.`) +
      paragraph(`A friendly reminder of your <strong>{{serviceTitle}}</strong> ({{durationMin}} min) with {{hostName}} on <strong>{{scheduledAt}}</strong> ({{timezone}}).`) +
      calloutCard(`<strong>Join link:</strong><br><a href="{{meetingLink}}" style="color:${BRAND_VIOLET};">{{meetingLink}}</a>`) +
      button("{{meetingLink}}", "Join the meeting") +
      paragraph(`Need to cancel or move it? Please give at least 12 hours' notice: <a href="{{consultationUrl}}" style="color:${BRAND_VIOLET};">manage your booking</a>.`),
    text: [
      "Reminder — your consultation is {{whenLabel}}.",
      "",
      "Hi {{customerName}}, your {{serviceTitle}} ({{durationMin}} min) with {{hostName}}",
      "is on {{scheduledAt}} ({{timezone}}).",
      "",
      "Join link:",
      "  {{meetingLink}}",
      "",
      "Manage your booking: {{consultationUrl}}",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },
]


/* ─────────────────────────── Spanish drafts ────────────────────────────
 * Mexican Spanish bodies for all 15 templates · I18N · Phase 120
 * Tone: tú form, professional-but-warm, tech loanwords kept where idiomatic.
 * Variables stay identical to the English templates.
 * ─────────────────────────────────────────────────────────────────── */
const TEMPLATES_ES = [
  // auth.welcome
  {
    key: "auth.welcome",
    subject: "Bienvenido a mustaphaukizuru.com, {{customerName}}",
    html: chrome({
      preheader: "Tu cuenta ya está lista. Esto es lo que sigue.",
      eyebrow:   "Bienvenido",
      bodyHtml:
        heading(`Bienvenido, {{customerName}}.`) +
        paragraph(`Tu cuenta en <a href="${SITE_URL}" style="color:${BRAND_VIOLET};">mustaphaukizuru.com</a> ya está activa. Puedes guardar tu dirección, dar seguimiento a tus pedidos, descargar todo lo que has comprado y agendar una consulta con un solo clic.`) +
        button("{{dashboardUrl}}", "Abrir mi panel") +
        paragraph(`Explora la <a href="${SITE_URL}/store" style="color:${BRAND_VIOLET};">tienda</a> para productos digitales y plantillas, o revisa la <a href="${SITE_URL}/services" style="color:${BRAND_VIOLET};">página de servicios</a> para consultoría y proyectos a la medida.`) +
        calloutCard(`Responde a este correo cuando quieras — me llega directamente a mí.`),
    }),
    text: [
      "Bienvenido a mustaphaukizuru.com, {{customerName}}.",
      "",
      "Tu cuenta está activa. Abre tu panel:",
      "  {{dashboardUrl}}",
      "",
      "Explora la tienda: " + SITE_URL + "/store",
      "Revisa servicios:  " + SITE_URL + "/services",
      "",
      "Responde a este correo cuando quieras.",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // order.placed
  {
    key: "order.placed",
    subject: "Pedido {{orderNumber}} recibido — pago pendiente",
    html: chrome({
      preheader: "Recibimos tu pedido. Falta confirmar el pago.",
      eyebrow:   "Pedido recibido",
      bodyHtml:
        heading(`Gracias {{customerName}} — pedido {{orderNumber}} recibido.`) +
        paragraph(`Recibimos tu pedido por <strong>{{orderTotal}}</strong> y está esperando la confirmación del pago. Te llegará un segundo correo en cuanto el pago se acredite, con tus descargas y recibo.`) +
        button("{{orderUrl}}", "Ver estado del pedido") +
        paragraph(`El pago suele acreditarse en pocos minutos. Si tu pedido sigue pendiente más de 15 minutos, revisa tu método de pago o responde a este correo.`),
    }),
    text: [
      "Pedido {{orderNumber}} recibido — pago pendiente.",
      "",
      "Gracias {{customerName}}. Recibimos tu pedido por {{orderTotal}}.",
      "Te llegará un segundo correo cuando el pago se acredite.",
      "",
      "Ver estado:",
      "  {{orderUrl}}",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // contact.admin
  {
    key: "contact.admin",
    subject: "Nuevo mensaje del formulario — {{name}}",
    html: chrome({
      preheader: "{{name}} acaba de enviar el formulario de contacto.",
      eyebrow:   "Formulario de contacto",
      bodyHtml:
        heading(`Nuevo mensaje de {{name}}`) +
        paragraph(`<strong>De:</strong> {{name}} &lt;{{email}}&gt;<br/><strong>Asunto:</strong> {{subject}}`) +
        calloutCard(`{{message}}`) +
        paragraph(`Responde directamente a este correo para contestarle a {{name}}.`),
    }),
    text: [
      "Nuevo mensaje del formulario de contacto",
      "",
      "De:     {{name}} <{{email}}>",
      "Asunto: {{subject}}",
      "",
      "{{message}}",
      "",
      "Responde directamente a este correo para contestarle.",
    ].join("\n"),
  },

  // contact.confirm
  {
    key: "contact.confirm",
    subject: "Recibimos tu mensaje — te respondo en menos de 24 horas",
    html: chrome({
      preheader: "Tu mensaje llegó. Respondo personalmente.",
      eyebrow:   "Mensaje recibido",
      bodyHtml:
        heading(`Gracias por escribir, {{name}}.`) +
        paragraph(`Recibí tu mensaje y te responderé personalmente en menos de 24 horas (de lunes a viernes, hora de Ciudad de México). La mayoría de las respuestas salen el mismo día.`) +
        paragraph(`Si tu pregunta es urgente o ya pasaron más de 24 horas, solo responde a este correo — me llega directamente a mí, no a una cola.`) +
        calloutCard(`Mientras tanto: <a href="${SITE_URL}/store" style="color:${BRAND_VIOLET};">explora la tienda</a> o <a href="${SITE_URL}/services" style="color:${BRAND_VIOLET};">revisa en qué puedo ayudarte</a>.`),
    }),
    text: [
      "Gracias por escribir, {{name}}.",
      "",
      "Recibí tu mensaje y te responderé en menos de 24 horas (Lun–Vie, hora de CDMX).",
      "La mayoría de las respuestas salen el mismo día.",
      "",
      "¿Urgente? Solo responde a este correo — me llega directamente.",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // order.confirmed
  {
    key: "order.confirmed",
    subject: "Pedido {{orderNumber}} confirmado — gracias, {{customerName}}",
    html: chrome({
      preheader: "Tu pedido está confirmado y listo para descargar.",
      eyebrow:   "Pedido confirmado",
      bodyHtml:
        heading(`Gracias {{customerName}} — tu pedido está pagado.`) +
        paragraph(`El pedido <strong>{{orderNumber}}</strong> por <strong>{{orderTotal}}</strong> se procesó correctamente vía {{gateway}}. Tus descargas y recibo te esperan en tu panel.`) +
        calloutCard(`¿Necesitas ayuda? Responde a este correo — me llega directamente a mí.`) +
        button("{{orderUrl}}", "Ver pedido") +
        paragraph(`Si algo no cuadra, responde dentro de 14 días y lo resolvemos.`),
    }),
    text: [
      "Pedido {{orderNumber}} confirmado — gracias {{customerName}}.",
      "",
      "Tu pedido por {{orderTotal}} se procesó correctamente vía {{gateway}}.",
      "Descargas y recibo en tu panel:",
      "  {{orderUrl}}",
      "",
      "¿Necesitas ayuda? Responde a este correo.",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // download.ready
  {
    key: "download.ready",
    subject: "Tu descarga está lista — {{productTitle}}",
    html: chrome({
      preheader: "Tu compra ya está disponible.",
      eyebrow:   "Descarga lista",
      bodyHtml:
        heading(`Tu descarga está lista, {{customerName}}.`) +
        paragraph(`<strong>{{productTitle}}</strong> ya está desbloqueado en tu panel. El enlace está vinculado a tu cuenta — no expira mientras tu compra siga activa.`) +
        button("{{downloadUrl}}", "Abrir descargas") +
        paragraph(`Te recomendamos guardar el archivo localmente — así lo tendrás aunque cambies de dispositivo.`),
    }),
    text: [
      "Tu descarga está lista — {{productTitle}}.",
      "",
      "Ábrela desde tu panel:",
      "  {{downloadUrl}}",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // auth.password-reset
  {
    key: "auth.password-reset",
    subject: "Restablece tu contraseña — mustaphaukizuru.com",
    html: chrome({
      preheader: "Usa el botón en los próximos 30 minutos para definir una nueva contraseña.",
      eyebrow:   "Restablecer contraseña",
      bodyHtml:
        heading(`Restablece tu contraseña.`) +
        paragraph(`Recibimos una solicitud para restablecer la contraseña de tu cuenta. El enlace de abajo expira en 30 minutos.`) +
        button("{{resetUrl}}", "Definir nueva contraseña") +
        paragraph(`Si no fuiste tú, ignora el correo — tu contraseña no cambia. Para mayor tranquilidad, también puedes activar la autenticación de dos factores desde tu panel.`) +
        calloutCard(`Recuerda: nunca te pediremos tu contraseña por correo o chat.`),
    }),
    text: [
      "Restablece tu contraseña — mustaphaukizuru.com",
      "",
      "Usa este enlace en los próximos 30 minutos para definir una nueva contraseña:",
      "  {{resetUrl}}",
      "",
      "Si no fuiste tú, ignora el correo — nada cambia.",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // auth.account-claim
  {
    key: "auth.account-claim",
    subject: "Pedido {{orderNumber}} confirmado — define tu contraseña para acceder a tus descargas",
    html: chrome({
      preheader: "Tu compra está lista. Un paso rápido para desbloquear tus descargas.",
      eyebrow:   "Bienvenido",
      bodyHtml:
        heading(`Bienvenido, {{customerName}}.`) +
        paragraph(`Gracias por tu compra — el pedido <strong>{{orderNumber}}</strong> está confirmado y tus descargas te esperan en tu panel.`) +
        paragraph(`Creamos una cuenta para ti con este correo para que puedas acceder a tus compras cuando quieras. Define tu contraseña con el botón de abajo — el enlace es válido por 14 días.`) +
        button("{{claimUrl}}", "Definir mi contraseña") +
        paragraph(`Una vez configurada tu contraseña, inicia sesión en <a href="${SITE_URL}/login" style="color:${BRAND_VIOLET};">${SITE_URL.replace(/^https?:\/\//, "")}/login</a> cuando lo necesites para volver a descargar, ver pedidos anteriores o contactar a soporte.`) +
        calloutCard(`¿No hiciste ninguna compra? Puedes ignorar este correo — no hay cuenta activa hasta que definas una contraseña.`),
    }),
    text: [
      "Pedido {{orderNumber}} confirmado — define tu contraseña",
      "",
      "Bienvenido, {{customerName}}.",
      "",
      "Tu compra está lista. Creamos una cuenta con este correo para que",
      "accedas a tus descargas cuando quieras. Define tu contraseña (válida 14 días):",
      "  {{claimUrl}}",
      "",
      "Después, inicia sesión en " + SITE_URL + "/login.",
      "",
      "¿No hiciste ninguna compra? Ignora este correo — no hay cuenta activa hasta que definas una contraseña.",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // newsletter.confirm
  {
    key: "newsletter.confirm",
    subject: "Confirma tu suscripción — mustaphaukizuru.com",
    html: chrome({
      preheader: "Un clic para confirmar tu suscripción.",
      eyebrow:   "Confirmar suscripción",
      bodyHtml:
        heading(`Confirma que estás dentro.`) +
        paragraph(`Gracias por suscribirte. Para empezar a recibir el newsletter — notas trimestrales sobre ingeniería, producto y lo que estoy construyendo — haz clic en el botón.`) +
        button("{{confirmUrl}}", "Confirmar suscripción") +
        paragraph(`Sin confirmación, no llegan correos — tu dirección se elimina automáticamente después de 7 días si no respondes.`),
    }),
    text: [
      "Confirma tu suscripción — mustaphaukizuru.com",
      "",
      "Haz clic aquí para confirmar:",
      "  {{confirmUrl}}",
      "",
      "Sin confirmación, no llegan correos — tu dirección se elimina después de 7 días.",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // project.milestone-completed
  {
    key: "project.milestone-completed",
    subject: "Hito completado: {{milestoneTitle}} — {{projectName}}",
    html: chrome({
      preheader: "Un hito de tu proyecto se marcó como completado.",
      eyebrow:   "Actualización del hito",
      bodyHtml:
        heading(`Hito completado: {{milestoneTitle}}`) +
        paragraph(`Buenas noticias — el hito <strong>{{milestoneTitle}}</strong> de tu proyecto <strong>{{projectName}}</strong> se marcó como completado.`) +
        paragraph(`Abre el panel de tu proyecto para ver los entregables más recientes, la línea de tiempo y lo que sigue.`) +
        button("{{dashboardUrl}}", "Ver el proyecto") +
        calloutCard(`¿Tienes preguntas o comentarios sobre este hito? Responde a este correo — el hilo regresa al responsable del proyecto.`),
    }),
    text: [
      "Hito completado: {{milestoneTitle}}",
      "",
      "Buenas noticias — el hito {{milestoneTitle}} de tu proyecto",
      "{{projectName}} se marcó como completado.",
      "",
      "Ver el panel del proyecto:",
      "  {{dashboardUrl}}",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // project.approval-requested
  {
    key: "project.approval-requested",
    subject: "Necesitamos tu revisión: {{milestoneTitle}} — {{projectName}}",
    html: chrome({
      preheader: "Un hito está listo para tu aprobación.",
      eyebrow:   "Revisión solicitada",
      bodyHtml:
        heading(`Listo para tu revisión: {{milestoneTitle}}`) +
        paragraph(`El hito <strong>{{milestoneTitle}}</strong> de <strong>{{projectName}}</strong> ya fue entregado y espera tu visto bueno.`) +
        paragraph(`Abre el proyecto, revisa los entregables y apruébalo con un clic o dinos qué debería cambiar. Al aprobar, el trabajo pasa a la siguiente fase.`) +
        button("{{dashboardUrl}}", "Revisar y aprobar") +
        calloutCard(`¿Aún no hay nada que aprobar? Deja un comentario en el hito — llega directo al responsable del proyecto.`),
    }),
    text: [
      "Listo para tu revisión: {{milestoneTitle}}",
      "",
      "El hito {{milestoneTitle}} de {{projectName}} ya fue entregado y",
      "espera tu visto bueno. Apruébalo o solicita cambios aquí:",
      "  {{dashboardUrl}}",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // portal.pin
  {
    key: "portal.pin",
    subject: "Tu PIN de acceso para {{projectName}}: {{pin}}",
    html: chrome({
      preheader: "Tu PIN de un solo uso para abrir el portal del proyecto.",
      eyebrow:   "Portal del proyecto",
      bodyHtml:
        heading(`Tu PIN: {{pin}}`) +
        paragraph(`Alguien abrió el enlace del portal de <strong>{{projectName}}</strong>. Escribe este PIN en la página para ver los hitos, archivos y la vista previa del proyecto:`) +
        calloutCard(`<span style="font-family:monospace;font-size:28px;letter-spacing:6px;font-weight:700">{{pin}}</span>`) +
        paragraph(`El PIN caduca en {{expiresMinutes}} minutos y funciona una sola vez. Si no abriste el enlace, ignora este correo — nada se comparte sin el PIN.`),
    }),
    text: [
      "Tu PIN: {{pin}}",
      "",
      "Alguien abrió el enlace del portal de {{projectName}}. Escribe este PIN en",
      "la página para ver los hitos, archivos y la vista previa del proyecto.",
      "",
      "El PIN caduca en {{expiresMinutes}} minutos y funciona una sola vez. Si no",
      "abriste el enlace, ignora este correo.",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // project.review-request
  {
    key: "project.review-request",
    subject: "{{projectName}} está completo — ¿cómo lo hicimos?",
    html: chrome({
      preheader: "Dos minutos para contar cómo fue el proyecto.",
      eyebrow:   "Proyecto completado",
      bodyHtml:
        heading(`{{projectName}} está listo`) +
        paragraph(`Gracias por trabajar conmigo en <strong>{{projectName}}</strong>. El proyecto ya está marcado como completado y tus archivos seguirán disponibles en tu panel un tiempo más.`) +
        paragraph(`Si tienes dos minutos, una reseña breve de <strong>{{serviceName}}</strong> ayuda al próximo cliente a decidir — y me dice qué debo seguir haciendo.`) +
        button("{{reviewUrl}}", "Dejar una reseña") +
        calloutCard(`¿Prefieres decirlo en privado? Responde a este correo.`),
    }),
    text: [
      "{{projectName}} está listo",
      "",
      "Gracias por trabajar conmigo en {{projectName}}. El proyecto ya está",
      "marcado como completado. Si tienes dos minutos, una reseña breve ayuda",
      "al próximo cliente a decidir:",
      "  {{reviewUrl}}",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // support.reply
  {
    key: "support.reply",
    subject: "Re: tu ticket de soporte #{{orderNumber}}",
    html: chrome({
      preheader: "Se agregó una respuesta a tu ticket de soporte.",
      eyebrow:   "Respuesta de soporte",
      bodyHtml:
        heading(`Hola {{customerName}} — agregamos una respuesta a tu ticket.`) +
        paragraph(`{{message}}`) +
        button("{{supportTicketUrl}}", "Ver ticket") +
        paragraph(`Solo responde a este correo si necesitas agregar algo — el hilo se guarda en el mismo ticket.`),
    }),
    text: [
      "Re: tu ticket de soporte #{{orderNumber}}",
      "",
      "Hola {{customerName}},",
      "",
      "{{message}}",
      "",
      "Ver el ticket completo:",
      "  {{supportTicketUrl}}",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // order.refunded
  // invoice.issued
  {
    key: "invoice.issued",
    subject: "Factura {{invoiceNumber}} — {{orderTotal}} vence el {{dueDate}}",
    html: chrome({
      preheader: "Tienes una nueva factura lista.",
      eyebrow:   "Factura",
      bodyHtml:
        heading(`Hola {{customerName}}, tienes una nueva factura.`) +
        paragraph(`La factura <strong>{{invoiceNumber}}</strong> por <strong>{{description}}</strong> ya está lista. El importe es <strong>{{orderTotal}}</strong> y vence el <strong>{{dueDate}}</strong>.`) +
        button("{{orderUrl}}", "Ver y pagar factura") +
        calloutCard(`Paga en línea con Mercado Pago o PayPal desde el enlace de arriba. Las facturas pagadas después de la fecha de vencimiento generan un recargo; si tienes dudas o necesitas otro arreglo, responde a este correo.`),
    }),
    text: [
      "Factura {{invoiceNumber}} — {{orderTotal}} vence el {{dueDate}}",
      "",
      "Hola {{customerName}}, la factura {{invoiceNumber}} por {{description}}",
      "ya está lista. Importe: {{orderTotal}}. Vence: {{dueDate}}.",
      "Ver y pagar: {{orderUrl}}",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // invoice.overdue
  {
    key: "invoice.overdue",
    subject: "La factura {{invoiceNumber}} está vencida",
    html: chrome({
      preheader: "Tu factura venció el {{dueDate}}.",
      eyebrow:   "Recordatorio de pago",
      bodyHtml:
        heading(`La factura {{invoiceNumber}} está vencida.`) +
        paragraph(`Hola {{customerName}}, la factura <strong>{{invoiceNumber}}</strong> por <strong>{{orderTotal}}</strong> venció el <strong>{{dueDate}}</strong> y sigue pendiente. Se aplicó un recargo de <strong>{{lateFee}}</strong>, por lo que el saldo es <strong>{{amountDue}}</strong>.`) +
        button("{{orderUrl}}", "Pagar ahora") +
        calloutCard(`El acceso al proyecto se pausa mientras haya un saldo vencido y los entregables se liberan al liquidarlo. ¿Ya pagaste? Ignora este mensaje — la conciliación puede tardar unas horas.`),
    }),
    text: [
      "La factura {{invoiceNumber}} está vencida",
      "",
      "Hola {{customerName}}, la factura {{invoiceNumber}} por {{orderTotal}} venció",
      "el {{dueDate}} y sigue pendiente. Recargo aplicado: {{lateFee}}.",
      "Saldo: {{amountDue}}. Pagar ahora: {{orderUrl}}",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // project.change-request-quoted
  {
    key: "project.change-request-quoted",
    subject: "Cotización lista: {{requestTitle}} — {{projectName}}",
    html: chrome({
      preheader: "Tu solicitud de trabajo adicional ya tiene cotización.",
      eyebrow:   "Cotización lista",
      bodyHtml:
        heading(`Hola {{customerName}}, tu cotización está lista.`) +
        paragraph(`Revisamos <strong>{{requestTitle}}</strong> en <strong>{{projectName}}</strong>. El trabajo adicional tiene un costo de <strong>{{quoteAmount}}</strong>.`) +
        calloutCard(`<strong>Notas del equipo:</strong><br/>{{quoteNote}}`) +
        paragraph(`Acepta la cotización desde la página del proyecto y recibirás un pedido listo para pagar; el trabajo en el nuevo hito empieza al confirmarse el pago. También puedes rechazarla; el proyecto no cambia.`) +
        button("{{dashboardUrl}}", "Revisar la cotización"),
    }),
    text: [
      "Cotización lista: {{requestTitle}} — {{projectName}}",
      "",
      "Hola {{customerName}}, el trabajo adicional \"{{requestTitle}}\" cuesta {{quoteAmount}}.",
      "Notas: {{quoteNote}}",
      "Acéptala o recházala aquí: {{dashboardUrl}}",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  {
    key: "order.refunded",
    subject: "Reembolso procesado — pedido {{orderNumber}}",
    html: chrome({
      preheader: "Tu reembolso ya fue emitido.",
      eyebrow:   "Reembolso procesado",
      bodyHtml:
        heading(`Reembolso procesado, {{customerName}}.`) +
        paragraph(`Emitimos un reembolso de <strong>{{orderTotal}}</strong> en el pedido <strong>{{orderNumber}}</strong>. La mayoría de los bancos reflejan el crédito en 3 a 7 días hábiles; algunos son más rápidos.`) +
        button("{{orderUrl}}", "Ver pedido") +
        paragraph(`Si el crédito no aparece después de una semana, responde a este correo con el nombre de tu banco y lo rastreamos.`),
    }),
    text: [
      "Reembolso procesado — pedido {{orderNumber}}",
      "",
      "Hola {{customerName}}, emitimos un reembolso de {{orderTotal}}.",
      "La mayoría de los bancos reflejan el crédito en 3 a 7 días hábiles.",
      "",
      "Ver pedido:",
      "  {{orderUrl}}",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // review.approved
  {
    key: "review.approved",
    subject: "Tu reseña de {{subjectTitle}} ya está publicada",
    html: chrome({
      preheader: "Tu reseña acaba de publicarse — gracias por compartir.",
      eyebrow:   "Reseña aprobada",
      bodyHtml:
        heading(`Gracias por la reseña, {{customerName}}.`) +
        paragraph(`Tu reseña de <strong>{{rating}} estrellas</strong> sobre <strong>{{subjectTitle}}</strong> ya está publicada en el sitio. Las reseñas de clientes reales son la mejor forma de que nuevos visitantes decidan si algo les funciona — así que esto realmente ayuda.`) +
        button("{{subjectUrl}}", "Ver tu reseña") +
        paragraph(`¿Quieres agregar una foto o actualizar tu opinión? Puedes editar o eliminar tu reseña en cualquier momento desde la misma página durante los próximos 30 días.`),
    }),
    text: [
      "Tu reseña de {{subjectTitle}} ya está publicada",
      "",
      "Hola {{customerName}}, tu reseña de {{rating}} estrellas acaba de publicarse.",
      "",
      "Verla en:",
      "  {{subjectUrl}}",
      "",
      "Puedes editarla o eliminarla en los próximos 30 días.",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // review.replied
  {
    key: "review.replied",
    subject: "Respondimos a tu reseña de {{subjectTitle}}",
    html: chrome({
      preheader: "Se agregó una respuesta a tu reseña.",
      eyebrow:   "Respuesta agregada",
      bodyHtml:
        heading(`Hola {{customerName}} — respondimos.`) +
        paragraph(`Agregamos una respuesta pública a tu reseña sobre <strong>{{subjectTitle}}</strong>. La respuesta ya aparece debajo de tu reseña en el sitio:`) +
        calloutCard(`{{adminReply}}`) +
        button("{{subjectUrl}}", "Leer la respuesta") +
        paragraph(`Si quieres responder directamente, solo contesta a este correo — me llega directamente a mí.`),
    }),
    text: [
      "Respondimos a tu reseña de {{subjectTitle}}",
      "",
      "Hola {{customerName}},",
      "",
      "{{adminReply}}",
      "",
      "Leer el hilo completo:",
      "  {{subjectUrl}}",
      "",
      "Responde a este correo cuando quieras.",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // review.rejected
  {
    key: "review.rejected",
    subject: "Tu reseña de {{subjectTitle}} no pudo publicarse",
    html: chrome({
      preheader: "No pudimos publicar tu reseña.",
      eyebrow:   "Reseña no publicada",
      bodyHtml:
        heading(`Hola {{customerName}} — un aviso sobre tu reseña.`) +
        paragraph(`No pudimos publicar tu reseña de <strong>{{rating}} estrellas</strong> sobre <strong>{{subjectTitle}}</strong>. Esto suele pasar cuando una reseña incluye datos de contacto, enlaces o lenguaje fuera de nuestras normas de la comunidad, pero también puede ser una decisión de borde.`) +
        paragraph(`Si aún así quieres que tu opinión nos llegue, responde a este correo — me llega directamente a mí y me aseguraré de leerla.`) +
        button("{{subjectUrl}}", "Visitar la página"),
    }),
    text: [
      "Tu reseña de {{subjectTitle}} no pudo publicarse",
      "",
      "Hola {{customerName}}, no pudimos publicar tu reseña de {{rating}} estrellas.",
      "",
      "Por lo general es por datos de contacto, enlaces o normas de la comunidad.",
      "",
      "Si quieres que tu opinión nos llegue, responde a este correo.",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // consultation.confirmed
  {
    key: "consultation.confirmed",
    subject: "Tu consulta está confirmada — {{scheduledAt}}",
    html: chrome({
      preheader: "Tu llamada está agendada. Link de la reunión adentro.",
      eyebrow:   "Consulta confirmada",
      bodyHtml:
        heading(`Nos vemos el {{scheduledAt}}, {{customerName}}.`) +
        paragraph(`Tu <strong>{{serviceTitle}}</strong> ({{durationMin}} min) con {{hostName}} ya está confirmada. El link de abajo abre la sala de reunión — no necesitas cuenta ni descargar nada.`) +
        calloutCard(`<strong>Link para unirte:</strong><br><a href="{{meetingLink}}" style="color:${BRAND_VIOLET};">{{meetingLink}}</a>`) +
        button("{{meetingLink}}", "Unirme a la reunión") +
        paragraph(`Guarda este correo — el link funciona en celular, tablet o laptop. Si necesitas mover la cita, puedes reagendar o cancelar desde tu panel:`) +
        button("{{consultationUrl}}", "Administrar consulta"),
    }),
    text: [
      "Tu consulta está confirmada — {{scheduledAt}}",
      "",
      "Hola {{customerName}}, tu {{serviceTitle}} ({{durationMin}} min) con {{hostName}}",
      "está confirmada el {{scheduledAt}} ({{timezone}}).",
      "",
      "Link para unirte:",
      "  {{meetingLink}}",
      "",
      "Administrar tu reserva:",
      "  {{consultationUrl}}",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  // consultation.rescheduled
  {
    key: "consultation.rescheduled",
    subject: "Tu consulta se reagendó — ahora {{scheduledAt}}",
    html: chrome({
      preheader: "Misma reunión, nuevo horario. Link adentro.",
      eyebrow:   "Consulta reagendada",
      bodyHtml:
        heading(`Nuevo horario: {{scheduledAt}}, {{customerName}}.`) +
        paragraph(`Tu <strong>{{serviceTitle}}</strong> ({{durationMin}} min) con {{hostName}} se movió. El mismo link sirve — guárdalo para tenerlo a la mano.`) +
        calloutCard(
          `<strong>Horario anterior:</strong> <span style="text-decoration:line-through;opacity:0.6;">{{previousScheduledAt}}</span><br>` +
          `<strong>Nuevo horario:</strong> {{scheduledAt}} ({{timezone}})<br><br>` +
          `<strong>Link para unirte:</strong><br><a href="{{meetingLink}}" style="color:${BRAND_VIOLET};">{{meetingLink}}</a>`
        ) +
        button("{{meetingLink}}", "Unirme a la reunión") +
        paragraph(`Si el nuevo horario no te funciona, puedes reagendar o cancelar desde tu panel:`) +
        button("{{consultationUrl}}", "Administrar consulta"),
    }),
    text: [
      "Tu consulta se reagendó — ahora {{scheduledAt}}",
      "",
      "Hola {{customerName}}, tu {{serviceTitle}} ({{durationMin}} min) con {{hostName}}",
      "se reagendó.",
      "",
      "Horario anterior: {{previousScheduledAt}}",
      "Nuevo horario:    {{scheduledAt}} ({{timezone}})",
      "",
      "Link para unirte (no cambió):",
      "  {{meetingLink}}",
      "",
      "Administrar tu reserva:",
      "  {{consultationUrl}}",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },

  /* ── Step 41 · Spanish drafts for the migrated mailer templates ───────── */

  // cart.abandoned · S2 · un recordatorio, una sola vez, cuando el carrito de
  // un cliente con cuenta lleva unas horas sin actividad.
  // Variables: customerName · itemCount · firstItem · itemsSummary · cartTotal · cartUrl
  {
    key: "cart.abandoned",
    subject: "Dejaste {{firstItem}} en tu carrito",
    html:
      heading(`¿Todavía lo estás pensando, {{customerName}}?`) +
      paragraph(`Tienes <strong>{{itemCount}}</strong> artículo(s) esperando en tu carrito — {{itemsSummary}} — por <strong>{{cartTotal}}</strong>. Tu carrito está guardado tal como lo dejaste.`) +
      paragraph(`Las descargas digitales se entregan al instante después del pago, y cada compra incluye garantía de reembolso total.`) +
      button("{{cartUrl}}", "Volver a mi carrito"),
    text: [
      "¿Todavía lo estás pensando, {{customerName}}?",
      "",
      "Tienes {{itemCount}} artículo(s) esperando en tu carrito:",
      "  {{itemsSummary}}",
      "por {{cartTotal}}. Tu carrito está guardado tal como lo dejaste.",
      "",
      "Las descargas digitales se entregan al instante después del pago, y",
      "cada compra incluye garantía de reembolso total.",
      "",
      "Volver a mi carrito:",
      "  {{cartUrl}}",
      "",
      "Recibes este correo porque tienes una cuenta y artículos en tu carrito.",
      "Enviamos como máximo un recordatorio por semana.",
    ].join("\n"),
  },
  {
    key: "order.pending",
    subject: "Tu pedido {{orderNumber}} está pendiente",
    html:
      heading(`Tu pedido {{orderNumber}} está pendiente, {{customerName}}.`) +
      paragraph(`Tu pedido por <strong>{{orderTotal}}</strong> está esperando la confirmación del pago o una revisión. No necesitas hacer nada por ahora — te avisaremos por correo en cuanto se confirme.`) +
      button("{{orderUrl}}", "Ver estado del pedido"),
    text: [
      "Tu pedido {{orderNumber}} está pendiente.",
      "",
      "Hola {{customerName}}, tu pedido por {{orderTotal}} está esperando la",
      "confirmación del pago o una revisión. No necesitas hacer nada por ahora.",
      "",
      "Ver estado:",
      "  {{orderUrl}}",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },
  {
    key: "order.cancelled",
    subject: "Tu pedido {{orderNumber}} fue cancelado",
    html:
      heading(`Tu pedido {{orderNumber}} fue cancelado.`) +
      paragraph(`Hola {{customerName}}, tu pedido por <strong>{{orderTotal}}</strong> fue cancelado. Si fue un error o necesitas ayuda, responde a este correo y lo resolvemos.`) +
      button(SITE_URL + "/es/store", "Volver a la tienda"),
    text: [
      "Tu pedido {{orderNumber}} fue cancelado.",
      "",
      "Hola {{customerName}}, tu pedido por {{orderTotal}} fue cancelado.",
      "Si fue un error, responde a este correo.",
      "",
      "Tienda: " + SITE_URL + "/es/store",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },
  {
    key: "order.failed",
    subject: "El pago del pedido {{orderNumber}} falló",
    html:
      heading(`No pudimos procesar tu pago, {{customerName}}.`) +
      paragraph(`El pago del pedido <strong>{{orderNumber}}</strong> ({{orderTotal}}) no se completó. Normalmente esto pasa cuando la tarjeta fue rechazada o la sesión de pago expiró.`) +
      button(SITE_URL + "/es/store", "Intentar de nuevo") +
      calloutCard(`Si sigue fallando, prueba otro método de pago o contacta a tu banco. Responde a este correo si necesitas ayuda.`),
    text: [
      "El pago del pedido {{orderNumber}} falló.",
      "",
      "Hola {{customerName}}, el pago por {{orderTotal}} no se completó.",
      "Intentar de nuevo: " + SITE_URL + "/es/store",
      "",
      "Si sigue fallando, prueba otro método de pago o responde a este correo.",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },
  {
    key: "auth.password-changed",
    subject: "Tu contraseña fue cambiada",
    html:
      heading(`Contraseña actualizada.`) +
      paragraph(`La contraseña de tu cuenta se cambió correctamente el {{changedAt}}.`) +
      paragraph(`Si hiciste este cambio, no necesitas hacer nada más. Si <strong>no</strong> cambiaste tu contraseña, responde a este correo de inmediato para proteger tu cuenta.`) +
      button("{{loginUrl}}", "Iniciar sesión"),
    text: [
      "Tu contraseña fue cambiada el {{changedAt}}.",
      "",
      "Si hiciste este cambio, no necesitas hacer nada.",
      "Si NO cambiaste tu contraseña, responde a este correo de inmediato.",
      "",
      "Iniciar sesión: {{loginUrl}}",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },
  {
    key: "support.created",
    subject: "Recibimos tu ticket de soporte #{{ticketNumber}}",
    html:
      heading(`Recibimos tu solicitud, {{customerName}}.`) +
      paragraph(`El ticket <strong>#{{ticketNumber}}</strong> — <em>{{subject}}</em> — está abierto con prioridad <strong>{{priority}}</strong>. Te responderemos lo antes posible y recibirás un correo cuando lo hagamos.`) +
      button("{{supportTicketUrl}}", "Ver ticket"),
    text: [
      "Recibimos tu ticket de soporte #{{ticketNumber}}.",
      "",
      "Hola {{customerName}}, tu solicitud \"{{subject}}\" (prioridad: {{priority}}) está abierta.",
      "Recibirás un correo cuando respondamos.",
      "",
      "Ver ticket: {{supportTicketUrl}}",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },
  {
    key: "newsletter.welcome",
    subject: "Ya estás suscrito",
    html:
      heading(`Ya estás en la lista.`) +
      paragraph(`Gracias por suscribirte. Recibirás actualizaciones ocasionales sobre nuevos productos digitales, ideas de tecnología y novedades de servicios — contenido de calidad, sin spam.`) +
      button("{{storeUrl}}", "Explorar la tienda") +
      paragraph(`¿Cambiaste de opinión? Puedes <a href="{{unsubscribeUrl}}" style="color:${BRAND_VIOLET};">darte de baja</a> cuando quieras.`),
    text: [
      "Ya estás suscrito.",
      "",
      "Gracias por suscribirte. Recibirás actualizaciones ocasionales sobre nuevos",
      "productos, ideas de tecnología y novedades de servicios.",
      "",
      "Tienda: {{storeUrl}}",
      "Darse de baja: {{unsubscribeUrl}}",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },
  {
    key: "consultation.cancelled",
    subject: "Cancelada — consulta del {{scheduledAt}}",
    html:
      heading(`Tu consulta fue cancelada.`) +
      paragraph(`Hola {{customerName}}, la <strong>{{serviceTitle}}</strong> ({{durationMin}} min) con {{hostName}} del <strong>{{scheduledAt}}</strong> ({{timezone}}) fue cancelada.`) +
      calloutCard(`Motivo: {{cancellationReason}}`) +
      button(SITE_URL + "/es/services", "Reservar otro horario") +
      paragraph(`Si fue un error, puedes reservar una nueva consulta desde la página de servicios.`),
    text: [
      "Tu consulta fue cancelada.",
      "",
      "Hola {{customerName}}, la {{serviceTitle}} ({{durationMin}} min) con {{hostName}}",
      "del {{scheduledAt}} ({{timezone}}) fue cancelada.",
      "Motivo: {{cancellationReason}}",
      "",
      "Reservar otro horario: " + SITE_URL + "/es/services",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },
  {
    key: "consultation.reminder",
    subject: "Recordatorio — tu consulta es {{whenLabel}}",
    html:
      heading(`Tu consulta es {{whenLabel}}, {{customerName}}.`) +
      paragraph(`Un recordatorio de tu <strong>{{serviceTitle}}</strong> ({{durationMin}} min) con {{hostName}} el <strong>{{scheduledAt}}</strong> ({{timezone}}).`) +
      calloutCard(`<strong>Enlace de la reunión:</strong><br><a href="{{meetingLink}}" style="color:${BRAND_VIOLET};">{{meetingLink}}</a>`) +
      button("{{meetingLink}}", "Unirme a la reunión") +
      paragraph(`¿Necesitas cancelar o mover la cita? Avísanos con al menos 12 horas de anticipación: <a href="{{consultationUrl}}" style="color:${BRAND_VIOLET};">administrar tu reserva</a>.`),
    text: [
      "Recordatorio — tu consulta es {{whenLabel}}.",
      "",
      "Hola {{customerName}}, tu {{serviceTitle}} ({{durationMin}} min) con {{hostName}}",
      "es el {{scheduledAt}} ({{timezone}}).",
      "",
      "Enlace de la reunión:",
      "  {{meetingLink}}",
      "",
      "Administrar tu reserva: {{consultationUrl}}",
      "",
      "© {{year}} Mustapha Ukizuru · " + SUPPORT_EMAIL,
    ].join("\n"),
  },
]

async function main() {
  console.log("Seeding email templates …")
  const year = new Date().getFullYear()

  // 1. Upsert all English templates as locale="en"
  for (const t of TEMPLATES) {
    const subject  = t.subject
    const htmlBody = t.html.replace(/\{\{year\}\}/g, year)
    const textBody = t.text.replace(/\{\{year\}\}/g, year)

    await prisma.emailTemplate.upsert({
      where:  { key_locale: { key: t.key, locale: "en" } },
      update: { subject, htmlBody, textBody, isActive: true },
      create: { key: t.key, locale: "en", subject, htmlBody, textBody, isActive: true },
    })
    console.log(`  ↻  EN  ${t.key}`)
  }

  // 2. Upsert all Spanish drafts as locale="es"
  for (const t of TEMPLATES_ES) {
    const subject  = t.subject
    const htmlBody = t.html.replace(/\{\{year\}\}/g, year)
    const textBody = t.text.replace(/\{\{year\}\}/g, year)

    await prisma.emailTemplate.upsert({
      where:  { key_locale: { key: t.key, locale: "es" } },
      update: { subject, htmlBody, textBody, isActive: true },
      create: { key: t.key, locale: "es", subject, htmlBody, textBody, isActive: true },
    })
    console.log(`  ↻  ES  ${t.key}`)
  }

  console.log(`\nDone. Seeded ${TEMPLATES.length} EN + ${TEMPLATES_ES.length} ES templates.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
