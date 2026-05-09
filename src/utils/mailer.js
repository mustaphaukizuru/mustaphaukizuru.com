const nodemailer = require("nodemailer");
const prisma = require("../lib/prisma");
const { buildConsultationIcs } = require("./icsGenerator");

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
  console.warn("⚠  SMTP not configured. Emails logged only.");
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getBaseUrl() {
  return process.env.FRONTEND_URL || "https://mustaphaukizuru.com";
}

function getLogoUrl() {
  // Use same profile photo as the public website header
  const domain = process.env.EMAIL_LOGO_DOMAIN || "https://mustaphaukizuru.com";
  return `${domain}/images/profile/Ukizuru_Mustapha_Photo.jpg`;
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
  const logoUrl = getLogoUrl();

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<meta name="color-scheme" content="light"/>
<meta name="supported-color-schemes" content="light"/>
<title>Mustapha Ukizuru</title>
<!--[if mso]><style>table,td{font-family:Arial,sans-serif!important;}</style><![endif]-->
<style>
  @media only screen and (max-width:620px) {
    .email-wrapper { padding: 16px 8px !important; }
    .email-card td { padding: 24px 20px 20px 20px !important; }
    .email-cta td a { padding: 12px 20px !important; font-size: 14px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#f0eef2;font-family:'Segoe UI',Roboto,-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;color:#1a1a2e;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;">

<!-- preheader -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;">${esc(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0eef2;">
<tr><td class="email-wrapper" style="padding:32px 16px;" align="center">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:580px;">

  <!-- Brand header -->
  <tr><td style="padding:0 0 20px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr>
      <td style="vertical-align:middle;">
        <a href="${base}" style="text-decoration:none;display:inline-block;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="vertical-align:middle;padding-right:10px;">
              <img src="${logoUrl}" alt="MU" width="38" height="38" style="width:38px;height:38px;border-radius:50%;object-fit:cover;display:block;border:2px solid #5D3FD3;" />
            </td>
            <td style="vertical-align:middle;">
              <span style="font-size:17px;font-weight:700;color:#5D3FD3;letter-spacing:-0.3px;">Mustapha Ukizuru</span>
              <br/>
              <span style="font-size:11px;color:#8b8b9e;letter-spacing:0.3px;">Digital Products & Technology Consulting</span>
            </td>
          </tr></table>
        </a>
      </td>
      <td style="vertical-align:middle;text-align:right;">
        <a href="${base}/store" style="font-size:12px;color:#5D3FD3;text-decoration:none;font-weight:600;">Visit Store →</a>
      </td>
    </tr>
    </table>
  </td></tr>

  <!-- Content card -->
  <tr><td style="background:#ffffff;border-radius:14px;box-shadow:0 1px 4px rgba(66,0,96,0.06);">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <!-- Indigo top accent -->
    <tr><td style="height:4px;background:linear-gradient(90deg,#5D3FD3 0%,#1A1B23 100%);border-radius:14px 14px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr><td class="email-card" style="padding:32px 32px 28px 32px;">
      ${body}
    </td></tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:24px 8px 0 8px;">
    ${footer || `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr><td style="text-align:center;padding:0 0 12px 0;">
      <a href="${base}" style="display:inline-block;margin:0 6px;">
        <img src="${logoUrl}" alt="MU" width="28" height="28" style="width:28px;height:28px;border-radius:50%;object-fit:cover;display:inline-block;opacity:0.7;" />
      </a>
    </td></tr>
    <tr><td style="text-align:center;">
      <p style="margin:0 0 4px;font-size:12px;color:#8b8b9e;">
        © ${year} Mustapha Ukizuru · <a href="${base}" style="color:#5D3FD3;text-decoration:none;font-weight:600;">mustaphaukizuru.com</a>
      </p>
      <p style="margin:0 0 4px;font-size:11px;color:#a8a8be;">
        <a href="${base}/store" style="color:#8b8b9e;text-decoration:none;">Store</a>
        &nbsp;·&nbsp;
        <a href="${base}/services" style="color:#8b8b9e;text-decoration:none;">Services</a>
        &nbsp;·&nbsp;
        <a href="${base}/contact" style="color:#8b8b9e;text-decoration:none;">Contact</a>
        &nbsp;·&nbsp;
        <a href="mailto:${esc(support)}" style="color:#8b8b9e;text-decoration:none;">Support</a>
      </p>
      <p style="margin:0;font-size:11px;color:#b0b0c0;">
        <a href="${base}/terms" style="color:#b0b0c0;text-decoration:none;">Terms</a>
        &nbsp;·&nbsp;
        <a href="${base}/privacy" style="color:#b0b0c0;text-decoration:none;">Privacy</a>
      </p>
    </td></tr>
    </table>
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
<table role="presentation" class="email-cta" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
<tr><td style="border-radius:10px;background:#5D3FD3;text-align:center;">
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
      <th style="text-align:left;padding:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#8b8b9e;border-bottom:2px solid #5D3FD3;">Product</th>
      <th style="text-align:center;padding:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#8b8b9e;border-bottom:2px solid #5D3FD3;">Qty</th>
      <th style="text-align:right;padding:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#8b8b9e;border-bottom:2px solid #5D3FD3;">Price</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>`;
}

function note(text) {
  return `<p style="margin:20px 0 0;padding:14px 16px;background:#faf7fb;border-left:3px solid #5D3FD3;border-radius:0 8px 8px 0;font-size:13px;color:#5f6470;line-height:1.6;">${text}</p>`;
}

function smallText(text) {
  return `<p style="margin:16px 0 0;font-size:12px;color:#8b8b9e;line-height:1.5;">${text}</p>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORDER HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getOrderId(order) { return esc(order?.orderNumber || order?.id || "N/A"); }
function getCustomerName(order) { return order?.customerName || "there"; }

function orderBody({ order, title, intro, ctaLabel, ctaUrl, noteText }) {
  const base = getBaseUrl();
  let html = "";
  html += heading(title);
  html += greeting(getCustomerName(order));
  html += paragraph(intro);
  html += detailTable([
    ["Order", `#${getOrderId(order)}`],
    ["Status", `<span style="font-weight:700;color:#5D3FD3;">${esc(order?.status || "pending")}</span>`],
    ["Total", `<span style="font-weight:700;color:#5D3FD3;">${money(order?.totalAmount)}</span>`],
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
  html += smallText(`If you have questions about this order, reply to this email or contact <a href="mailto:${esc(getSupportEmail())}" style="color:#5D3FD3;">${esc(getSupportEmail())}</a>.`);
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
    paragraph(`This link expires in <strong>1 hour</strong>. If you did not request this, you can safely ignore this email; your password will not change.`) +
    divider() +
    smallText(`If the button doesn't work, copy this URL into your browser:<br/><a href="${resetLink}" style="color:#5D3FD3;word-break:break-all;">${esc(resetLink)}</a>`);

  await safeSendMail(
    { from: fromAddress(), to: email, subject: "Reset your password · Mustapha Ukizuru", html: layout({ preheader: "Password reset request", body }) },
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
    { from: fromAddress(), to: email, subject: "Password changed · Mustapha Ukizuru", html: layout({ preheader: "Your password was updated", body }) },
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
    { from: fromAddress(), to: order.customerEmail, subject: `Order received · #${getOrderId(order)}`, html: layout({ preheader: `Order #${getOrderId(order)} received`, body }) },
    { templateKey: "order_placed" }
  );
}

async function sendOrderPaidEmail(order) {
  if (!order?.customerEmail) return;
  const base = getBaseUrl();
  const body = orderBody({
    order,
    title: "Payment confirmed",
    intro: "Your payment has been confirmed. Your digital products are now available in your member dashboard, ready to download.",
    ctaLabel: "Go to My Products",
    ctaUrl: `${base}/dashboard/products`,
  });
  await safeSendMail(
    { from: fromAddress(), to: order.customerEmail, subject: `Payment confirmed · #${getOrderId(order)}`, html: layout({ preheader: "Your products are ready to download", body }) },
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
    { from: fromAddress(), to: order.customerEmail, subject: `Order pending · #${getOrderId(order)}`, html: layout({ preheader: "Order status update", body }) },
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
    { from: fromAddress(), to: order.customerEmail, subject: `Order cancelled · #${getOrderId(order)}`, html: layout({ preheader: "Your order was cancelled", body }) },
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
    { from: fromAddress(), to: order.customerEmail, subject: `Payment failed · #${getOrderId(order)}`, html: layout({ preheader: "Payment could not be completed", body }) },
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
    { from: fromAddress(), to: order.customerEmail, subject: `Refund processed · #${getOrderId(order)}`, html: layout({ preheader: "Your refund is on its way", body }) },
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
    { from: fromAddress(), to: email, subject: `Download ready · ${esc(productTitle)}`, html: layout({ preheader: `${productTitle} is ready to download`, body }) },
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
      ["Email", `<a href="mailto:${esc(email)}" style="color:#5D3FD3;">${esc(email)}</a>`],
      ["Subject", esc(subject || "N/A")],
    ]) +
    divider() +
    paragraph(`<em>"${esc(message)}"</em>`);

  await safeSendMail(
    { from: fromAddress(), to: support, subject: `Contact: ${esc(name)} · ${esc(subject || "New message")}`, html: layout({ preheader: `New message from ${name}`, body: adminBody }) },
    { templateKey: "contact_admin" }
  );

  // 2. Auto-reply to sender
  const replyBody =
    heading("We received your message") +
    greeting(name) +
    paragraph("Thank you for reaching out. We've received your message and will get back to you within <strong>24 hours</strong>.") +
    paragraph("For reference, here's what you sent us:") +
    note(esc(message)) +
    smallText(`This is an automated confirmation. Please do not reply to this email; instead, write to us at <a href="mailto:${esc(support)}" style="color:#5D3FD3;">${esc(support)}</a>.`);

  await safeSendMail(
    { from: fromAddress(), to: email, subject: "We received your message · Mustapha Ukizuru", html: layout({ preheader: "We will respond within 24 hours", body: replyBody }) },
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
  const ticketNum = ticket?.ticketNumber || ticket?.id?.slice(0, 8) || "N/A";

  const body =
    heading("Support ticket created") +
    greeting(user?.fullName || "there") +
    paragraph(`Your support request has been submitted. Our team will review it and respond as soon as possible.`) +
    detailTable([
      ["Ticket", `#${esc(ticketNum)}`],
      ["Subject", esc(ticket?.subject || "N/A")],
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
  const ticketNum = ticket?.ticketNumber || "N/A";

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
    paragraph("We respect your inbox. Expect quality content, not spam.") +
    cta("Explore the Store", `${base}/store`);

  const footer = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr><td style="text-align:center;padding:0 0 10px 0;">
      <p style="margin:0 0 4px;font-size:12px;color:#8b8b9e;">
        © ${year} Mustapha Ukizuru · <a href="${base}" style="color:#5D3FD3;text-decoration:none;font-weight:600;">mustaphaukizuru.com</a>
      </p>
      <p style="margin:0 0 8px;font-size:11px;color:#a8a8be;">
        You subscribed to updates at mustaphaukizuru.com.
      </p>
      <p style="margin:0;font-size:12px;">
        <a href="${unsubscribeUrl}" style="color:#5D3FD3;text-decoration:underline;font-weight:600;">Unsubscribe</a>
        &nbsp;&nbsp;·&nbsp;&nbsp;
        <a href="mailto:${esc(support)}" style="color:#8b8b9e;text-decoration:none;">Contact Support</a>
        &nbsp;&nbsp;·&nbsp;&nbsp;
        <a href="${base}/privacy" style="color:#8b8b9e;text-decoration:none;">Privacy</a>
      </p>
    </td></tr>
    </table>`;

  await safeSendMail(
    {
      from: fromAddress(),
      to: email,
      subject: "You are subscribed · Mustapha Ukizuru",
      html: layout({ preheader: "You'll receive updates and product announcements", body, footer }),
      headers: { "List-Unsubscribe": `<${unsubscribeUrl}>` },
    },
    { templateKey: "newsletter_confirm" }
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSULTATION / BOOKING EMAILS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build the nodemailer fields needed to ship an iCalendar invite alongside the
 * HTML body. Returns { alternatives, attachments } — both are needed:
 *   - alternatives → triggers Gmail/Outlook native "Yes / No / Maybe" UI.
 *   - attachments  → makes Apple Mail / mobile clients show "Add to Calendar".
 *
 * @param {Object} consultation Prisma row + relations (user, assignedAdmin, service)
 * @param {"REQUEST"|"CANCEL"} method
 */
function buildIcsMailParts(consultation, method = "REQUEST") {
  if (!consultation) return { alternatives: undefined, attachments: undefined };

  const ics = buildConsultationIcs(consultation, {
    method,
    fromEmail: process.env.SMTP_USER || "hello@mustaphaukizuru.com",
    fromName:  consultation?.assignedAdmin?.fullName || "Mustapha Ukizuru",
    baseUrl:   getBaseUrl(),
  });

  const filename = method === "CANCEL" ? "cancelled.ics" : "invite.ics";

  return {
    alternatives: [
      {
        contentType: `text/calendar; charset="utf-8"; method=${method}`,
        content:     ics,
      },
    ],
    attachments: [
      {
        filename,
        content:     ics,
        contentType: `text/calendar; charset="utf-8"; method=${method}`,
      },
    ],
  };
}

/**
 * Format a UTC Date as a human-readable string in the recipient's timezone.
 */
function formatScheduledTime(scheduledAt, timezone) {
  if (!scheduledAt) return "N/A";
  const d = scheduledAt instanceof Date ? scheduledAt : new Date(scheduledAt);
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit", timeZoneName: "short",
      timeZone: timezone || "UTC",
    }).format(d);
  } catch {
    return d.toUTCString();
  }
}

function consultationDetailRows(consultation) {
  const tz   = consultation?.timezone || "UTC";
  const when = formatScheduledTime(consultation?.scheduledAt, tz);
  const host = consultation?.assignedAdmin?.fullName || "Mustapha Ukizuru";
  const svc  = consultation?.service?.title || "Consultation";
  return [
    ["Service",  esc(svc)],
    ["When",     `<span style="font-weight:700;color:#5D3FD3;">${esc(when)}</span>`],
    ["Duration", `${esc(consultation?.durationMin || 30)} minutes`],
    ["Host",     esc(host)],
    ["Timezone", esc(tz)],
  ];
}

/**
 * Booking i18n helper · returns the Spanish or English copy for each
 * consultation-email surface depending on the resolved locale.
 *
 * The legacy mailer functions used to bake English copy directly into the
 * function body. After the I18N rollout, callers pass the resolved locale
 * (resolveUserLocale at the controller level) and the copy branches here.
 *
 * Keeping this localised here, rather than in DB-backed EmailTemplate rows,
 * is intentional: consultation emails carry an ICS calendar attachment that
 * the template service does not yet support. This branch keeps full ICS
 * support while still serving Spanish customers Spanish copy.
 */
function bookingCopy(locale = "en") {
  const isEs = String(locale).toLowerCase() === "es"
  return {
    confirmedHeading:    isEs ? "Tu consulta está confirmada"          : "Your consultation is confirmed",
    confirmedThanks:     isEs ? "Gracias por reservar. Aquí están los detalles de tu reunión:"
                              : "Thanks for booking. Here are your meeting details:",
    yourNotes:           isEs ? "Tus notas:"                            : "Your notes:",
    viewInDashboard:     isEs ? "Ver en el panel"                       : "View in Dashboard",
    joinLinkLabel:       isEs ? "Enlace de la reunión:"                 : "Join link:",
    pendingMeetingLink:  isEs ? "Te enviaremos el enlace antes de la llamada."
                              : "A meeting link will be sent before the call.",
    cancelLine:          isEs ? "¿Necesitas cambiar de planes? Reagenda o cancela al menos 12 horas antes de la llamada."
                              : "Need to change plans? Reschedule or cancel at least 12 hours before the call.",
    cancelLink:          isEs ? "Reagendar o cancelar"                  : "Reschedule or cancel",
    rescheduledHeading:  isEs ? "Tu consulta se reagendó"               : "Your consultation was rescheduled",
    rescheduledBody:     isEs ? "Tu reservación se movió a un nuevo horario:"
                              : "Your booking has been moved to a new time:",
    viewUpdated:         isEs ? "Ver reservación actualizada"           : "View Updated Booking",
    rescheduleAgain:     isEs ? "Si este nuevo horario no te funciona, puedes volver a reagendar desde tu panel."
                              : "If this new time doesn't work, you can reschedule again from your dashboard.",
    cancelledHeading:    isEs ? "Tu consulta fue cancelada"             : "Your consultation was cancelled",
    cancelledBody:       isEs ? "Cancelamos la siguiente reservación:"  : "We've cancelled the following booking:",
    cancelledReason:     isEs ? "Motivo:"                               : "Reason:",
    bookAnother:         isEs ? "Reservar otro horario"                 : "Book Another Time",
    cancelledFooter:     isEs ? "Si fue un error, puedes reservar una nueva consulta desde la página de servicios."
                              : "If this was a mistake, you can book a new consultation from the services page.",
    preheaderConfirmed:  isEs ? "Tu consulta está en el calendario"     : "Your consultation is on the calendar",
    preheaderRescheduled:isEs ? "Nuevo horario confirmado"              : "New time confirmed",
    preheaderCancelled:  isEs ? "Reservación cancelada"                 : "Booking cancelled",
    subjectConfirmed:    isEs ? "Reservación confirmada"                : "Booking confirmed",
    subjectRescheduled:  isEs ? "Reagendada"                            : "Rescheduled",
    subjectCancelled:    isEs ? "Cancelada · consulta del"              : "Cancelled · consultation on",
  }
}

async function sendConsultationConfirmationEmail(consultation, { locale } = {}) {
  const email = consultation?.user?.email;
  if (!email) return;
  const base = getBaseUrl();
  const c    = bookingCopy(locale);

  const meetingBlock = consultation.meetingLink
    ? note(`${c.joinLinkLabel} <a href="${consultation.meetingLink}" style="color:#5D3FD3;">${esc(consultation.meetingLink)}</a>`)
    : note(c.pendingMeetingLink);

  const cancelUrl = consultation.confirmationToken
    ? `${base}/booking/manage?token=${encodeURIComponent(consultation.confirmationToken)}`
    : `${base}/dashboard/consultations`;

  const body =
    heading(c.confirmedHeading) +
    greeting(consultation?.user?.fullName) +
    paragraph(c.confirmedThanks) +
    detailTable(consultationDetailRows(consultation)) +
    (consultation.clientNotes
      ? paragraph(`<strong>${c.yourNotes}</strong><br/><em>"${esc(consultation.clientNotes)}"</em>`)
      : "") +
    cta(c.viewInDashboard, `${base}/dashboard/consultations`) +
    meetingBlock +
    smallText(`${c.cancelLine.split("Reschedule").join("")}${c.cancelLine.includes("Reschedule") ? "" : ""} <a href="${cancelUrl}" style="color:#5D3FD3;">${c.cancelLink}</a>`);

  const ics = buildIcsMailParts(consultation, "REQUEST");
  await safeSendMail(
    {
      from: fromAddress(),
      to: email,
      subject: `${c.subjectConfirmed} · ${formatScheduledTime(consultation.scheduledAt, consultation.timezone)}`,
      html: layout({ preheader: c.preheaderConfirmed, body }),
      alternatives: ics.alternatives,
      attachments:  ics.attachments,
      icalEvent:    ics.attachments?.[0]
        ? { method: "REQUEST", content: ics.attachments[0].content, filename: ics.attachments[0].filename }
        : undefined,
    },
    { userId: consultation?.userId, templateKey: "consultation_confirmed" }
  );
}

async function sendConsultationRescheduledEmail(consultation, { locale } = {}) {
  const email = consultation?.user?.email;
  if (!email) return;
  const base = getBaseUrl();
  const c    = bookingCopy(locale);

  const body =
    heading(c.rescheduledHeading) +
    greeting(consultation?.user?.fullName) +
    paragraph(c.rescheduledBody) +
    detailTable(consultationDetailRows(consultation)) +
    cta(c.viewUpdated, `${base}/dashboard/consultations`) +
    smallText(c.rescheduleAgain);

  const ics = buildIcsMailParts(consultation, "REQUEST");
  await safeSendMail(
    {
      from: fromAddress(),
      to: email,
      subject: `${c.subjectRescheduled} · ${formatScheduledTime(consultation.scheduledAt, consultation.timezone)}`,
      html: layout({ preheader: c.preheaderRescheduled, body }),
      alternatives: ics.alternatives,
      attachments:  ics.attachments,
      icalEvent:    ics.attachments?.[0]
        ? { method: "REQUEST", content: ics.attachments[0].content, filename: ics.attachments[0].filename }
        : undefined,
    },
    { userId: consultation?.userId, templateKey: "consultation_rescheduled" }
  );
}

async function sendConsultationCancelledEmail(consultation, { locale } = {}) {
  const email = consultation?.user?.email;
  if (!email) return;
  const base = getBaseUrl();
  const c    = bookingCopy(locale);

  const body =
    heading(c.cancelledHeading) +
    greeting(consultation?.user?.fullName) +
    paragraph(c.cancelledBody) +
    detailTable(consultationDetailRows(consultation)) +
    (consultation.cancellationReason
      ? note(`${c.cancelledReason} ${esc(consultation.cancellationReason)}`)
      : "") +
    cta(c.bookAnother, `${base}/services`) +
    smallText(c.cancelledFooter);

  const ics = buildIcsMailParts(consultation, "CANCEL");
  await safeSendMail(
    {
      from: fromAddress(),
      to: email,
      subject: `${c.subjectCancelled} ${formatScheduledTime(consultation.scheduledAt, consultation.timezone)}`,
      html: layout({ preheader: c.preheaderCancelled, body }),
      alternatives: ics.alternatives,
      attachments:  ics.attachments,
      icalEvent:    ics.attachments?.[0]
        ? { method: "CANCEL", content: ics.attachments[0].content, filename: ics.attachments[0].filename }
        : undefined,
    },
    { userId: consultation?.userId, templateKey: "consultation_cancelled" }
  );
}

async function sendConsultationReminderEmail(consultation, hoursAway) {
  const email = consultation?.user?.email;
  if (!email) return;
  const base = getBaseUrl();
  const window = hoursAway >= 24 ? "tomorrow" : "in about an hour";

  const body =
    heading(`Reminder: your consultation is ${window}`) +
    greeting(consultation?.user?.fullName) +
    paragraph("Just a friendly reminder of your upcoming consultation:") +
    detailTable(consultationDetailRows(consultation)) +
    (consultation.meetingLink
      ? cta("Join Meeting", consultation.meetingLink)
      : note("A meeting link will be shared shortly before the call.")) +
    smallText(`Need to cancel? Please give at least 12 hours' notice via your <a href="${base}/dashboard/consultations" style="color:#5D3FD3;">dashboard</a>.`);

  const ics = buildIcsMailParts(consultation, "REQUEST");
  await safeSendMail(
    {
      from: fromAddress(),
      to: email,
      subject: `Reminder · consultation ${window}`,
      html: layout({ preheader: `Your consultation is ${window}`, body }),
      alternatives: ics.alternatives,
      attachments:  ics.attachments,
      icalEvent:    ics.attachments?.[0]
        ? { method: "REQUEST", content: ics.attachments[0].content, filename: ics.attachments[0].filename }
        : undefined,
    },
    { userId: consultation?.userId, templateKey: hoursAway >= 24 ? "consultation_reminder_24h" : "consultation_reminder_1h" }
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
  // Consultation / booking
  sendConsultationConfirmationEmail,
  sendConsultationRescheduledEmail,
  sendConsultationCancelledEmail,
  sendConsultationReminderEmail,
};
