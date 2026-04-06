const nodemailer = require("nodemailer");
const prisma = require("../lib/prisma");

// ═══════════════════════════════════════════════════════════════════════════════
// SMTP TRANSPORT
// ═══════════════════════════════════════════════════════════════════════════════

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.hostinger.com",
  port: Number(process.env.SMTP_PORT || 465),
  secure: process.env.SMTP_SECURE !== "false",
  auth: {
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
  },
  pool: true,
  maxConnections: 3,
  rateLimit: 10,
});

if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter.verify((err) => {
    if (err) {
      console.error("✗ SMTP connection failed:", err.message);
    } else {
      console.log("✓ SMTP ready");
    }
  });
} else {
  console.warn("⚠  SMTP not configured — emails logged only");
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getBaseUrl() {
  return process.env.FRONTEND_URL || "http://localhost:5173";
}

function getSupportEmail() {
  return process.env.SUPPORT_EMAIL || process.env.SMTP_USER || "hello@mustaphaukizuru.com";
}

function esc(v = "") {
  return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function money(v) {
  return `$${Number(v || 0).toFixed(2)}`;
}

function fromAddress() {
  return `"Mustapha Ukizuru" <${process.env.SMTP_USER || "hello@mustaphaukizuru.com"}>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL LOG — fire & forget DB write
// ═══════════════════════════════════════════════════════════════════════════════

function logEmail({ userId, emailTo, templateKey, subject, status, providerMessageId, errorMessage }) {
  prisma.emailLog
    .create({
      data: {
        userId: userId || null,
        emailTo: emailTo || "",
        templateKey: templateKey || null,
        subject: subject || "",
        status: status || "queued",
        providerMessageId: providerMessageId || null,
        sentAt: status === "sent" ? new Date() : null,
        errorMessage: errorMessage || null,
      },
    })
    .catch((e) => console.error("[EmailLog]", e.message));
}

async function safeSendMail(options, meta = {}) {
  const emailTo = Array.isArray(options.to) ? options.to.join(", ") : String(options.to || "");
  const subject = String(options.subject || "");
  const { userId, templateKey } = meta;

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log("[EMAIL skip]", subject, "→", emailTo);
    logEmail({ userId, emailTo, templateKey, subject, status: "skipped", errorMessage: "SMTP not configured" });
    return;
  }

  try {
    const info = await transporter.sendMail(options);
    console.log(`[EMAIL ✓] "${subject}" → ${emailTo}`);
    logEmail({ userId, emailTo, templateKey, subject, status: "sent", providerMessageId: info?.messageId });
  } catch (err) {
    console.error(`[EMAIL ✗] "${subject}" → ${emailTo}:`, err.message);
    logEmail({ userId, emailTo, templateKey, subject, status: "failed", errorMessage: err.message });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BASE LAYOUT — clean, text-forward, professional
// ═══════════════════════════════════════════════════════════════════════════════

function layout({ preheader = "", body, footer }) {
  const base = getBaseUrl();
  const support = getSupportEmail();
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Mustapha Ukizuru</title>
</head>
<body style="margin:0;padding:0;background:#f4f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a2e;-webkit-font-smoothing:antialiased;">

<!-- preheader -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f2f5;">
<tr><td style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;">

  <!-- Logo bar -->
  <tr><td style="padding:0 0 24px 0;">
    <a href="${base}" style="text-decoration:none;display:inline-flex;align-items:center;gap:10px;">
      <div style="width:36px;height:36px;border-radius:10px;background:#420060;color:#fff;font-weight:700;font-size:14px;line-height:36px;text-align:center;">MU</div>
      <span style="font-size:16px;font-weight:700;color:#420060;letter-spacing:-0.3px;">Mustapha Ukizuru</span>
    </a>
  </td></tr>

  <!-- Content card -->
  <tr><td style="background:#ffffff;border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="padding:36px 32px 32px 32px;">
      ${body}
    </td></tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:24px 0 0 0;">
    ${footer || `
    <p style="margin:0 0 6px;font-size:12px;color:#8b8b9e;text-align:center;">
      © ${year} Mustapha Ukizuru · <a href="${base}" style="color:#420060;text-decoration:none;">mustaphaukizuru.com</a>
    </p>
    <p style="margin:0;font-size:12px;color:#8b8b9e;text-align:center;">
      Questions? <a href="mailto:${esc(support)}" style="color:#420060;text-decoration:none;">${esc(support)}</a>
    </p>
    `}
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS — reusable HTML snippets
// ═══════════════════════════════════════════════════════════════════════════════

function heading(text) {
  return `<h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#1a1a2e;line-height:1.3;">${esc(text)}</h1>`;
}

function subtext(text) {
  return `<p style="margin:0 0 24px;font-size:15px;color:#5f6470;line-height:1.6;">${text}</p>`;
}

function paragraph(text) {
  return `<p style="margin:0 0 16px;font-size:15px;color:#3a3a4a;line-height:1.7;">${text}</p>`;
}

function greeting(name) {
  return paragraph(`Hi ${esc(name || "there")},`);
}

function cta(label, href) {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
<tr><td style="border-radius:10px;background:#420060;text-align:center;">
  <a href="${href}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.2px;">${esc(label)}</a>
</td></tr>
</table>`;
}

function divider() {
  return `<hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>`;
}

function detailRow(label, value) {
  return `<tr>
    <td style="padding:6px 16px 6px 0;font-size:13px;color:#8b8b9e;white-space:nowrap;vertical-align:top;">${esc(label)}</td>
    <td style="padding:6px 0;font-size:14px;color:#1a1a2e;font-weight:500;">${value}</td>
  </tr>`;
}

function detailTable(rows) {
  const content = rows.map((r) => detailRow(r[0], r[1])).join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0;">${content}</table>`;
}

function itemsTable(items) {
  const rows = (items || [])
    .map(
      (item) => `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#1a1a2e;">${esc(item.title || "Item")}</td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#5f6470;text-align:center;">${esc(item.quantity ?? 1)}</td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#1a1a2e;text-align:right;font-weight:600;">${money(item.price)}</td>
      </tr>`
    )
    .join("");

  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0;">
  <thead>
    <tr>
      <th style="text-align:left;padding:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#8b8b9e;border-bottom:2px solid #420060;">Product</th>
      <th style="text-align:center;padding:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#8b8b9e;border-bottom:2px solid #420060;">Qty</th>
      <th style="text-align:right;padding:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#8b8b9e;border-bottom:2px solid #420060;">Price</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>`;
}

function note(text) {
  return `<p style="margin:20px 0 0;padding:14px 16px;background:#faf7fb;border-left:3px solid #420060;border-radius:0 8px 8px 0;font-size:13px;color:#5f6470;line-height:1.6;">${text}</p>`;
}

function smallText(text) {
  return `<p style="margin:16px 0 0;font-size:12px;color:#8b8b9e;line-height:1.5;">${text}</p>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORDER HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getOrderId(order) { return esc(order?.orderNumber || order?.id || "—"); }
function getCustomerName(order) { return order?.customerName || "there"; }

function orderBody({ order, title, intro, ctaLabel, ctaUrl, noteText }) {
  const base = getBaseUrl();
  let html = "";
  html += heading(title);
  html += greeting(getCustomerName(order));
  html += paragraph(intro);
  html += detailTable([
    ["Order", `#${getOrderId(order)}`],
    ["Status", `<span style="font-weight:700;color:#420060;">${esc(order?.status || "pending")}</span>`],
    ["Total", `<span style="font-weight:700;color:#420060;">${money(order?.totalAmount)}</span>`],
  ]);
  if (order?.items?.length > 0) {
    html += itemsTable(order.items);
  }
  if (ctaLabel && ctaUrl) {
    html += cta(ctaLabel, ctaUrl);
  }
  if (noteText) {
    html += note(noteText);
  }
  html += smallText(`If you have questions about this order, reply to this email or contact <a href="mailto:${esc(getSupportEmail())}" style="color:#420060;">${esc(getSupportEmail())}</a>.`);
  return html;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH EMAILS
// ═══════════════════════════════════════════════════════════════════════════════

async function sendWelcomeEmail(user) {
  const base = getBaseUrl();
  const name = user?.fullName || user?.name || "there";
  const email = user?.email;
  if (!email) return;

  const body =
    heading("Welcome aboard") +
    greeting(name) +
    paragraph("Your account has been created successfully. You now have access to digital products, consulting services, and your personal member dashboard.") +
    paragraph("Here's what you can do:") +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">
      <tr><td style="padding:4px 0;font-size:14px;color:#3a3a4a;">→ Browse and purchase digital products</td></tr>
      <tr><td style="padding:4px 0;font-size:14px;color:#3a3a4a;">→ Download files from your dashboard</td></tr>
      <tr><td style="padding:4px 0;font-size:14px;color:#3a3a4a;">→ Access consulting and technology services</td></tr>
      <tr><td style="padding:4px 0;font-size:14px;color:#3a3a4a;">→ Get priority support when you need help</td></tr>
    </table>` +
    cta("Open My Dashboard", `${base}/dashboard`) +
    smallText("You're receiving this because you created an account at mustaphaukizuru.com.");

  await safeSendMail(
    { from: fromAddress(), to: email, subject: "Welcome to Mustapha Ukizuru", html: layout({ preheader: "Your account is ready", body }) },
    { userId: user.id, templateKey: "welcome" }
  );
}

async function sendResetEmail(email, resetLink) {
  const body =
    heading("Reset your password") +
    paragraph("We received a request to reset the password for your account. Click the button below to choose a new password.") +
    cta("Reset Password", resetLink) +
    paragraph(`This link expires in <strong>1 hour</strong>. If you didn't request this, you can safely ignore this email — your password won't change.`) +
    divider() +
    smallText(`If the button doesn't work, copy this URL into your browser:<br/><a href="${resetLink}" style="color:#420060;word-break:break-all;">${esc(resetLink)}</a>`);

  await safeSendMail(
    { from: fromAddress(), to: email, subject: "Reset your password — Mustapha Ukizuru", html: layout({ preheader: "Password reset request", body }) },
    { templateKey: "password_reset" }
  );
}

async function sendPasswordResetConfirmationEmail(email) {
  const base = getBaseUrl();
  const body =
    heading("Password updated") +
    paragraph("Your account password has been changed successfully.") +
    paragraph("If you made this change, no further action is needed. If you did <strong>not</strong> change your password, please contact our support team immediately.") +
    cta("Sign In", `${base}/login`) +
    smallText(`Security notice: This change was made on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}.`);

  await safeSendMail(
    { from: fromAddress(), to: email, subject: "Password changed — Mustapha Ukizuru", html: layout({ preheader: "Your password was updated", body }) },
    { templateKey: "password_changed" }
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORDER EMAILS
// ═══════════════════════════════════════════════════════════════════════════════

async function sendOrderPlacedEmail(order) {
  if (!order?.customerEmail) return;
  const body = orderBody({
    order,
    title: "Order received",
    intro: "We've received your order and it's being processed. You'll get another email once payment is confirmed and your products are ready.",
    noteText: "Payment confirmation usually takes a few moments. If your order stays pending for more than 15 minutes, please check your payment method or contact support.",
  });
  await safeSendMail(
    { from: fromAddress(), to: order.customerEmail, subject: `Order received — #${getOrderId(order)}`, html: layout({ preheader: `Order #${getOrderId(order)} received`, body }) },
    { templateKey: "order_placed" }
  );
}

async function sendOrderPaidEmail(order) {
  if (!order?.customerEmail) return;
  const base = getBaseUrl();
  const body = orderBody({
    order,
    title: "Payment confirmed",
    intro: "Your payment has been confirmed. Your digital products are now available in your member dashboard — ready to download.",
    ctaLabel: "Go to My Products",
    ctaUrl: `${base}/dashboard/products`,
  });
  await safeSendMail(
    { from: fromAddress(), to: order.customerEmail, subject: `Payment confirmed — #${getOrderId(order)}`, html: layout({ preheader: "Your products are ready to download", body }) },
    { templateKey: "order_paid" }
  );
}

async function sendOrderPendingEmail(order) {
  if (!order?.customerEmail) return;
  const body = orderBody({
    order,
    title: "Order pending",
    intro: "Your order status has been updated to pending. We're waiting for payment confirmation or review. No action is needed from you right now.",
  });
  await safeSendMail(
    { from: fromAddress(), to: order.customerEmail, subject: `Order pending — #${getOrderId(order)}`, html: layout({ preheader: "Order status update", body }) },
    { templateKey: "order_pending" }
  );
}

async function sendOrderCancelledEmail(order) {
  if (!order?.customerEmail) return;
  const body = orderBody({
    order,
    title: "Order cancelled",
    intro: "Your order has been cancelled. If you believe this is a mistake or need assistance, please reach out to our support team.",
  });
  await safeSendMail(
    { from: fromAddress(), to: order.customerEmail, subject: `Order cancelled — #${getOrderId(order)}`, html: layout({ preheader: "Your order was cancelled", body }) },
    { templateKey: "order_cancelled" }
  );
}

async function sendOrderFailedEmail(order) {
  if (!order?.customerEmail) return;
  const base = getBaseUrl();
  const body = orderBody({
    order,
    title: "Payment failed",
    intro: "We couldn't process the payment for your order. This can happen if your card was declined or the payment session expired. You can try again from your dashboard.",
    ctaLabel: "Try Again",
    ctaUrl: `${base}/store`,
    noteText: "If you continue to experience issues, try a different payment method or contact your bank. Our support team is also here to help.",
  });
  await safeSendMail(
    { from: fromAddress(), to: order.customerEmail, subject: `Payment failed — #${getOrderId(order)}`, html: layout({ preheader: "Payment could not be completed", body }) },
    { templateKey: "order_failed" }
  );
}

async function sendOrderRefundedEmail(order) {
  if (!order?.customerEmail) return;
  const body = orderBody({
    order,
    title: "Refund processed",
    intro: "A refund has been initiated for your order. The amount will be returned to your original payment method within 5–10 business days, depending on your bank.",
    noteText: "If you don't see the refund after 10 business days, please contact your payment provider first, then reach out to us if needed.",
  });
  await safeSendMail(
    { from: fromAddress(), to: order.customerEmail, subject: `Refund processed — #${getOrderId(order)}`, html: layout({ preheader: "Your refund is on its way", body }) },
    { templateKey: "order_refunded" }
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOWNLOAD EMAIL
// ═══════════════════════════════════════════════════════════════════════════════

async function sendDownloadReadyEmail(order, product) {
  const email = order?.customerEmail;
  if (!email) return;
  const base = getBaseUrl();
  const productTitle = product?.title || "your product";

  const body =
    heading("Your download is ready") +
    greeting(getCustomerName(order)) +
    paragraph(`<strong>${esc(productTitle)}</strong> is ready to download from your member dashboard.`) +
    detailTable([
      ["Product", esc(productTitle)],
      ["Order", `#${getOrderId(order)}`],
      ["Access", "Instant download"],
    ]) +
    cta("Download Now", `${base}/dashboard/products`) +
    smallText("Downloads are available anytime from your dashboard. If you have trouble accessing your files, contact support.");

  await safeSendMail(
    { from: fromAddress(), to: email, subject: `Download ready — ${esc(productTitle)}`, html: layout({ preheader: `${productTitle} is ready to download`, body }) },
    { templateKey: "download_ready" }
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTACT FORM EMAIL
// ═══════════════════════════════════════════════════════════════════════════════

async function sendContactFormEmail(data) {
  const { name, email, subject, message } = data || {};
  if (!name || !email || !message) return;
  const support = getSupportEmail();

  // 1. Notify admin
  const adminBody =
    heading("New contact message") +
    paragraph(`A message was submitted through the contact form.`) +
    detailTable([
      ["From", esc(name)],
      ["Email", `<a href="mailto:${esc(email)}" style="color:#420060;">${esc(email)}</a>`],
      ["Subject", esc(subject || "—")],
    ]) +
    divider() +
    paragraph(`<em>"${esc(message)}"</em>`);

  await safeSendMail(
    { from: fromAddress(), to: support, subject: `Contact: ${esc(name)} — ${esc(subject || "New message")}`, html: layout({ preheader: `New message from ${name}`, body: adminBody }) },
    { templateKey: "contact_admin" }
  );

  // 2. Auto-reply to sender
  const replyBody =
    heading("We received your message") +
    greeting(name) +
    paragraph("Thank you for reaching out. We've received your message and will get back to you within <strong>24 hours</strong>.") +
    paragraph("For reference, here's what you sent us:") +
    note(esc(message)) +
    smallText(`This is an automated confirmation. Please don't reply to this email — instead, email us at <a href="mailto:${esc(support)}" style="color:#420060;">${esc(support)}</a>.`);

  await safeSendMail(
    { from: fromAddress(), to: email, subject: "We received your message — Mustapha Ukizuru", html: layout({ preheader: "We'll respond within 24 hours", body: replyBody }) },
    { templateKey: "contact_reply" }
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUPPORT TICKET EMAILS
// ═══════════════════════════════════════════════════════════════════════════════

async function sendSupportTicketEmail(ticket, user) {
  const email = user?.email || ticket?.email;
  if (!email) return;
  const base = getBaseUrl();
  const ticketNum = ticket?.ticketNumber || ticket?.id?.slice(0, 8) || "—";

  const body =
    heading("Support ticket created") +
    greeting(user?.fullName || "there") +
    paragraph(`Your support request has been submitted. Our team will review it and respond as soon as possible.`) +
    detailTable([
      ["Ticket", `#${esc(ticketNum)}`],
      ["Subject", esc(ticket?.subject || "—")],
      ["Priority", esc(ticket?.priority || "medium")],
      ["Status", "Open"],
    ]) +
    cta("View Ticket", `${base}/dashboard/support`) +
    smallText("You'll receive an email when our team replies to your ticket.");

  await safeSendMail(
    { from: fromAddress(), to: email, subject: `Support ticket #${esc(ticketNum)} created`, html: layout({ preheader: "Your support request was received", body }) },
    { userId: user?.id, templateKey: "support_created" }
  );
}

async function sendSupportReplyEmail(ticket, user, replyMessage) {
  const email = user?.email || ticket?.email;
  if (!email) return;
  const base = getBaseUrl();
  const ticketNum = ticket?.ticketNumber || "—";

  const body =
    heading("New reply on your ticket") +
    greeting(user?.fullName || "there") +
    paragraph(`Our team has replied to ticket <strong>#${esc(ticketNum)}</strong>.`) +
    divider() +
    paragraph(`<em>"${esc(replyMessage)}"</em>`) +
    divider() +
    cta("View Full Thread", `${base}/dashboard/support`) +
    smallText("You can reply directly from your dashboard.");

  await safeSendMail(
    { from: fromAddress(), to: email, subject: `Reply on ticket #${esc(ticketNum)}`, html: layout({ preheader: "Our team replied to your ticket", body }) },
    { userId: user?.id, templateKey: "support_reply" }
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEWSLETTER EMAIL — with unsubscribe link
// ═══════════════════════════════════════════════════════════════════════════════

async function sendNewsletterConfirmationEmail(email) {
  const base = getBaseUrl();
  const unsubscribeUrl = `${base}/api/newsletter/unsubscribe?email=${encodeURIComponent(email)}`;
  const year = new Date().getFullYear();
  const support = getSupportEmail();

  const body =
    heading("You're subscribed") +
    paragraph(`Hi there,`) +
    paragraph("Thanks for subscribing! You'll now receive occasional updates about:") +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
      <tr><td style="padding:5px 0;font-size:14px;color:#3a3a4a;">→ New digital products and templates</td></tr>
      <tr><td style="padding:5px 0;font-size:14px;color:#3a3a4a;">→ Technology insights and guides</td></tr>
      <tr><td style="padding:5px 0;font-size:14px;color:#3a3a4a;">→ Service updates and announcements</td></tr>
    </table>` +
    paragraph("We respect your inbox — expect quality content, not spam.") +
    cta("Explore the Store", `${base}/store`);

  const footer = `
    <p style="margin:0 0 6px;font-size:12px;color:#8b8b9e;text-align:center;">
      © ${year} Mustapha Ukizuru · <a href="${base}" style="color:#420060;text-decoration:none;">mustaphaukizuru.com</a>
    </p>
    <p style="margin:0 0 6px;font-size:12px;color:#8b8b9e;text-align:center;">
      You're receiving this because you subscribed at mustaphaukizuru.com.
    </p>
    <p style="margin:0;font-size:12px;text-align:center;">
      <a href="${unsubscribeUrl}" style="color:#8b8b9e;text-decoration:underline;">Unsubscribe</a>
       · <a href="mailto:${esc(support)}" style="color:#8b8b9e;text-decoration:underline;">Contact</a>
    </p>`;

  await safeSendMail(
    {
      from: fromAddress(),
      to: email,
      subject: "You're subscribed — Mustapha Ukizuru",
      html: layout({ preheader: "You'll receive updates and product announcements", body, footer }),
      headers: { "List-Unsubscribe": `<${unsubscribeUrl}>` },
    },
    { templateKey: "newsletter_confirm" }
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
  sendResetEmail,
  sendOrderPlacedEmail,
  sendOrderPaidEmail,
  sendOrderPendingEmail,
  sendOrderCancelledEmail,
  sendOrderFailedEmail,
  sendOrderRefundedEmail,
  sendWelcomeEmail,
  sendDownloadReadyEmail,
  sendContactFormEmail,
  sendSupportTicketEmail,
  sendSupportReplyEmail,
  sendNewsletterConfirmationEmail,
  sendPasswordResetConfirmationEmail,
};
