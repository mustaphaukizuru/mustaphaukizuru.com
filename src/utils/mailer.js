const nodemailer = require("nodemailer");

// Transporter with connection test and fallback logging
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   || "smtp.hostinger.com",
  port:   Number(process.env.SMTP_PORT || 465),
  secure: process.env.SMTP_SECURE !== "false", // default true (port 465)
  auth: {
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
  },
  pool: true,
  maxConnections: 3,
  rateLimit: 10, // max 10 messages per second
});

// Verify SMTP on startup (non-blocking)
if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter.verify((error) => {
    if (error) {
      console.error("✗ SMTP connection failed:", error.message);
      console.error("  → Check SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env");
    } else {
      console.log("✓ SMTP connection verified — email delivery ready");
    }
  });
} else {
  console.warn("⚠  SMTP credentials not set — emails will be logged but not sent");
}

// Safe send wrapper — logs instead of throwing if SMTP not configured
async function safeSendMail(options) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log("[EMAIL - not sent, SMTP not configured]", options.subject, "→", options.to);
    return;
  }
  try {
    await transporter.sendMail(options);   // ← fixed: was calling itself recursively
    console.log(`[EMAIL sent] "${options.subject}" → ${options.to}`);
  } catch (err) {
    console.error(`[EMAIL failed] "${options.subject}" → ${options.to}:`, err.message);
    // Do not throw — email failure must never crash the request
  }
}

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderItems(items = []) {
  return items
    .map((item) => {
      const title = escapeHtml(item.title || "Item");
      const quantity = escapeHtml(item.quantity ?? 1);
      const price = money(item.price);

      return `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #ece7ef;font-size:14px;line-height:22px;color:#2e2f3a;">
            ${title}
          </td>
          <td style="padding:14px 0;border-bottom:1px solid #ece7ef;text-align:center;font-size:14px;line-height:22px;color:#5f6470;">
            ${quantity}
          </td>
          <td style="padding:14px 0;border-bottom:1px solid #ece7ef;text-align:right;font-size:14px;line-height:22px;color:#2e2f3a;font-weight:600;">
            ${price}
          </td>
        </tr>
      `;
    })
    .join("");
}

function getBaseUrl() {
  return process.env.FRONTEND_URL || "http://localhost:5173";
}

function getSupportEmail() {
  return process.env.SUPPORT_EMAIL || process.env.SMTP_USER || "hello@mustaphaukizuru.com";
}

function getOrderId(order) {
  return escapeHtml(order?.orderNumber || order?.id || "N/A");
}

function getOrderStatus(order) {
  return escapeHtml(order?.status || "pending");
}

function getCustomerName(order) {
  return escapeHtml(order?.customerName || "Customer");
}

function getEmailShell({ preheader = "", headerEyebrow = "Mustapha Ukizuru", headerTitle, introHtml, contentHtml, footerHtml = "" }) {
  const safePreheader = escapeHtml(preheader);

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(headerTitle)}</title>
      </head>
      <body style="margin:0;padding:0;background-color:#f6f2f7;font-family:Arial,Helvetica,sans-serif;color:#2e2f3a;">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
          ${safePreheader}
        </div>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f6f2f7;margin:0;padding:24px 0;">
          <tr>
            <td align="center" style="padding:0 16px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:680px;background-color:#ffffff;border-radius:22px;overflow:hidden;box-shadow:0 16px 50px rgba(66,0,96,0.08);">
                
                <tr>
                  <td style="background:linear-gradient(135deg,#420060 0%,#5d1f7d 55%,#634F40 100%);padding:34px 36px 30px 36px;">
                    <div style="font-size:12px;line-height:18px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:rgba(247,249,244,0.78);">
                      ${escapeHtml(headerEyebrow)}
                    </div>
                    <div style="padding-top:10px;font-size:30px;line-height:38px;font-weight:700;color:#ffffff;">
                      ${escapeHtml(headerTitle)}
                    </div>
                    <div style="padding-top:12px;font-size:15px;line-height:24px;color:rgba(247,249,244,0.88);max-width:520px;">
                      ${introHtml}
                    </div>
                  </td>
                </tr>

                <tr>
                  <td style="padding:34px 36px 18px 36px;">
                    ${contentHtml}
                  </td>
                </tr>

                <tr>
                  <td style="padding:0 36px 34px 36px;">
                    <div style="height:1px;background-color:#ece7ef;margin-bottom:18px;"></div>
                    ${footerHtml || `
                      <p style="margin:0 0 8px 0;font-size:13px;line-height:22px;color:#6b7280;">
                        This email was sent by Mustapha Ukizuru.
                      </p>
                      <p style="margin:0;font-size:13px;line-height:22px;color:#6b7280;">
                        Need help? Contact
                        <a href="mailto:${escapeHtml(getSupportEmail())}" style="color:#420060;text-decoration:none;font-weight:700;">
                          ${escapeHtml(getSupportEmail())}
                        </a>
                      </p>
                    `}
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

function buildCtaButton(label, href) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 20px 0;">
      <tr>
        <td align="center" bgcolor="#420060" style="border-radius:12px;">
          <a
            href="${href}"
            style="display:inline-block;padding:15px 28px;font-size:16px;font-weight:700;line-height:20px;color:#ffffff;text-decoration:none;background-color:#420060;border-radius:12px;"
          >
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>
  `;
}

function buildInfoCard(rows = []) {
  const content = rows
    .map(
      (row) => {
        const label = Array.isArray(row) ? row[0] : row.label
        const value = Array.isArray(row) ? row[1] : row.value
        return `
        <tr>
          <td style="padding:0 0 10px 0;font-size:14px;line-height:22px;color:#6b7280;vertical-align:top;">
            <strong style="color:#2e2f3a;">${escapeHtml(label)}:</strong> ${value}
          </td>
        </tr>
      `
      }
    )
    .join("");

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px 0;background-color:#f8f5fa;border:1px solid #eee5f4;border-radius:14px;">
      <tr>
        <td style="padding:18px 18px 8px 18px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            ${content}
          </table>
        </td>
      </tr>
    </table>
  `;
}

function buildItemsTable(items = []) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin-top:6px;">
      <thead>
        <tr>
          <th style="text-align:left;padding:0 0 12px 0;border-bottom:1px solid #dcd5e3;font-size:12px;line-height:18px;letter-spacing:0.08em;text-transform:uppercase;color:#8d6f59;">
            Product
          </th>
          <th style="text-align:center;padding:0 0 12px 0;border-bottom:1px solid #dcd5e3;font-size:12px;line-height:18px;letter-spacing:0.08em;text-transform:uppercase;color:#8d6f59;">
            Qty
          </th>
          <th style="text-align:right;padding:0 0 12px 0;border-bottom:1px solid #dcd5e3;font-size:12px;line-height:18px;letter-spacing:0.08em;text-transform:uppercase;color:#8d6f59;">
            Unit Price
          </th>
        </tr>
      </thead>
      <tbody>
        ${renderItems(items)}
      </tbody>
    </table>
  `;
}

function buildOrderEmail({ order, title, intro, ctaLabel, ctaUrl, note }) {
  const infoCard = buildInfoCard([
    { label: "Order ID", value: getOrderId(order) },
    { label: "Status", value: getOrderStatus(order) },
    { label: "Total", value: `<span style="font-weight:700;color:#420060;">${money(order.totalAmount)}</span>` },
  ]);

  const buttonHtml = ctaLabel && ctaUrl ? buildCtaButton(ctaLabel, ctaUrl) : "";

  const noteHtml = note
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:22px 0 0 0;background-color:#fcfafc;border:1px solid #ece7ef;border-radius:14px;">
        <tr>
          <td style="padding:16px 18px;font-size:14px;line-height:24px;color:#5f6470;">
            ${note}
          </td>
        </tr>
      </table>
    `
    : "";

  return getEmailShell({
    preheader: `${title} - ${getOrderId(order)}`,
    headerTitle: title,
    introHtml: intro,
    contentHtml: `
      <p style="margin:0 0 18px 0;font-size:16px;line-height:28px;color:#4b5563;">
        Hello ${getCustomerName(order)},
      </p>

      ${infoCard}

      ${buttonHtml}

      <div style="margin:2px 0 0 0;font-size:15px;line-height:24px;font-weight:700;color:#420060;">
        Order summary
      </div>

      <div style="margin-top:10px;">
        ${buildItemsTable(order.items)}
      </div>

      ${noteHtml}
    `,
  });
}

async function sendResetEmail(email, resetLink) {
  await safeSendMail({
    from: `"Mustapha Ukizuru" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Reset your password",
    text: `
Password Reset Request

We received a request to reset the password for your Mustapha Ukizuru account.

Reset your password:
${resetLink}

This link expires in 1 hour.

If you did not request a password reset, you can safely ignore this email.
    `.trim(),
    html: getEmailShell({
      preheader: "Reset your password securely",
      headerTitle: "Reset your password",
      introHtml:
        "Secure account recovery for your digital products, services, and member workspace.",
      contentHtml: `
        <div style="font-size:13px;line-height:20px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#8d6f59;">
          Password assistance
        </div>

        <p style="margin:14px 0 18px 0;font-size:16px;line-height:28px;color:#4b5563;">
          We received a request to reset the password for your account. Use the button below to create a new password securely.
        </p>

        ${buildCtaButton("Reset Password", resetLink)}

        <p style="margin:0 0 18px 0;font-size:14px;line-height:24px;color:#8d6f59;">
          This link expires in <strong>1 hour</strong>.
        </p>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0 0 0;background-color:#f8f5fa;border:1px solid #eee5f4;border-radius:14px;">
          <tr>
            <td style="padding:18px;">
              <div style="font-size:14px;line-height:22px;font-weight:700;color:#420060;margin-bottom:8px;">
                Didn’t request this?
              </div>
              <div style="font-size:14px;line-height:24px;color:#5f6470;">
                If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged unless this link is used.
              </div>
            </td>
          </tr>
        </table>

        <p style="margin:22px 0 10px 0;font-size:13px;line-height:22px;color:#6b7280;">
          If the button does not work, copy and paste this link into your browser:
        </p>

        <p style="margin:0;font-size:13px;line-height:22px;word-break:break-word;">
          <a href="${resetLink}" style="color:#420060;text-decoration:underline;">
            ${escapeHtml(resetLink)}
          </a>
        </p>
      `,
    }),
  });
}

async function sendOrderPlacedEmail(order) {
  await safeSendMail({
    from: `"Mustapha Ukizuru" <${process.env.SMTP_USER}>`,
    to: order.customerEmail,
    subject: `Order Received - ${order.id}`,
    html: buildOrderEmail({
      order,
      title: "Order received",
      intro: "We received your order successfully. It is currently pending payment confirmation.",
      note: "Once payment is confirmed, you will receive another email confirming that your downloads are ready.",
    }),
  });
}

async function sendOrderPaidEmail(order) {
  const dashboardUrl = `${getBaseUrl()}/dashboard/products`;

  await safeSendMail({
    from: `"Mustapha Ukizuru" <${process.env.SMTP_USER}>`,
    to: order.customerEmail,
    subject: `Payment Confirmed - ${order.id}`,
    html: buildOrderEmail({
      order,
      title: "Payment confirmed",
      intro: "Your payment has been confirmed and your digital products are now available in your member dashboard.",
      ctaLabel: "Open My Products",
      ctaUrl: dashboardUrl,
    }),
  });
}

async function sendOrderPendingEmail(order) {
  await safeSendMail({
    from: `"Mustapha Ukizuru" <${process.env.SMTP_USER}>`,
    to: order.customerEmail,
    subject: `Order Pending - ${order.id}`,
    html: buildOrderEmail({
      order,
      title: "Order pending",
      intro: "Your order status has been updated to pending. We are still waiting for payment confirmation or review.",
    }),
  });
}

async function sendOrderCancelledEmail(order) {
  await safeSendMail({
    from: `"Mustapha Ukizuru" <${process.env.SMTP_USER}>`,
    to: order.customerEmail,
    subject: `Order Cancelled - ${order.id}`,
    html: buildOrderEmail({
      order,
      title: "Order cancelled",
      intro: "Your order has been updated to cancelled. If you believe this is incorrect, please contact support.",
    }),
  });
}

async function sendOrderFailedEmail(order) {
  const dashboardUrl = `${getBaseUrl()}/dashboard/products`;

  await safeSendMail({
    from: `"Mustapha Ukizuru" <${process.env.SMTP_USER}>`,
    to: order.customerEmail,
    subject: `Order Failed - ${order.id}`,
    html: buildOrderEmail({
      order,
      title: "Payment failed",
      intro: "Your order has been updated to failed. The payment could not be completed or was not confirmed. Please try again or contact support if you need help.",
      ctaLabel: "Open My Products",
      ctaUrl: dashboardUrl,
    }),
  });
}

async function sendOrderRefundedEmail(order) {
  await safeSendMail({
    from: `"Mustapha Ukizuru" <${process.env.SMTP_USER}>`,
    to: order.customerEmail,
    subject: `Order Refunded - ${order.id}`,
    html: buildOrderEmail({
      order,
      title: "Order refunded",
      intro: "Your order has been updated to refunded. Any eligible refund has been initiated to your original payment method.",
    }),
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// ADDITIONAL EMAIL NOTIFICATIONS — added to cover all platform actions
// ─────────────────────────────────────────────────────────────────────────────

async function sendWelcomeEmail(user) {
  const dashboardUrl = `${getBaseUrl()}/dashboard`;
  const storeUrl = `${getBaseUrl()}/store`;
  const name = escapeHtml(user?.fullName || user?.name || "Member");
  const email = user?.email;
  if (!email) return;

  await safeSendMail({
    from: `"Mustapha Ukizuru" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Welcome to Mustapha Ukizuru Digital Platform",
    html: getEmailShell({
      preheader: "Your account is ready. Explore digital resources and consulting services.",
      headerTitle: "Welcome to the Platform",
      introHtml: `<p style="font-size:16px;line-height:28px;color:#2e2f3a;margin:0 0 20px;">Hello <strong>${name}</strong>,</p><p style="font-size:15px;line-height:26px;color:#5f6470;margin:0 0 16px;">Your account has been created successfully. You now have access to digital products, consulting services, and your personal member dashboard.</p>`,
      contentHtml: buildInfoCard([
        ["Access", "Digital products, templates, toolkits"],
        ["Dashboard", "Track orders, downloads, and account"],
        ["Support", "Reach our team anytime"],
      ]),
      footerHtml: `<div style="text-align:center;margin-top:28px;">${buildCtaButton("Open My Dashboard", dashboardUrl)}&nbsp;&nbsp;${buildCtaButton("Explore Store", storeUrl)}</div>`,
    }),
  });
}

async function sendDownloadReadyEmail(order, product) {
  const downloadUrl = `${getBaseUrl()}/dashboard/downloads`;
  const customerEmail = order?.customerEmail;
  if (!customerEmail) return;

  await safeSendMail({
    from: `"Mustapha Ukizuru" <${process.env.SMTP_USER}>`,
    to: customerEmail,
    subject: `Your Download is Ready — ${escapeHtml(product?.title || "Product")}`,
    html: getEmailShell({
      preheader: "Your digital product is ready to download from your dashboard.",
      headerTitle: "Download Ready",
      introHtml: `<p style="font-size:15px;line-height:26px;color:#5f6470;margin:0 0 16px;">Your payment has been confirmed and <strong>${escapeHtml(product?.title || "your product")}</strong> is ready to download from your member dashboard.</p>`,
      contentHtml: buildInfoCard([
        ["Product", escapeHtml(product?.title || "—")],
        ["Order", getOrderId(order)],
        ["Status", "Ready to download"],
      ]),
      footerHtml: `<div style="text-align:center;margin-top:28px;">${buildCtaButton("Download Now", downloadUrl)}</div>`,
    }),
  });
}

async function sendContactFormEmail(data) {
  const supportEmail = getSupportEmail();
  const { name, email, message } = data || {};
  if (!name || !email || !message) return;

  // Notify admin
  await safeSendMail({
    from: `"Mustapha Ukizuru" <${process.env.SMTP_USER}>`,
    to: supportEmail,
    subject: `New Contact Message from ${escapeHtml(name)}`,
    html: getEmailShell({
      preheader: `New contact message from ${escapeHtml(name)}`,
      headerTitle: "New Contact Message",
      introHtml: `<p style="font-size:15px;color:#5f6470;margin:0 0 16px;">A new message was submitted through the contact form.</p>`,
      contentHtml: buildInfoCard([
        ["Name", escapeHtml(name)],
        ["Email", escapeHtml(email)],
        ["Message", escapeHtml(message)],
      ]),
    }),
  });

  // Auto-reply to sender
  await safeSendMail({
    from: `"Mustapha Ukizuru" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "We received your message — Mustapha Ukizuru",
    html: getEmailShell({
      preheader: "We'll get back to you within 24 hours.",
      headerTitle: "Message Received",
      introHtml: `<p style="font-size:16px;line-height:28px;color:#2e2f3a;margin:0 0 16px;">Hello <strong>${escapeHtml(name)}</strong>,</p><p style="font-size:15px;line-height:26px;color:#5f6470;margin:0;">Thank you for reaching out. We've received your message and will respond within 24 hours.</p>`,
      contentHtml: buildInfoCard([["Your Message", escapeHtml(message)]]),
    }),
  });
}

async function sendSupportTicketEmail(ticket, user) {
  const ticketUrl = `${getBaseUrl()}/dashboard/support`;
  const email = user?.email || ticket?.email;
  if (!email) return;

  await safeSendMail({
    from: `"Mustapha Ukizuru" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `Support Ticket Created — #${escapeHtml(ticket?.ticketNumber || ticket?.id?.slice(0, 8) || "—")}`,
    html: getEmailShell({
      preheader: "Your support ticket has been created and our team will respond shortly.",
      headerTitle: "Support Ticket Created",
      introHtml: `<p style="font-size:15px;line-height:26px;color:#5f6470;margin:0 0 16px;">Your support request has been received. Our team will respond as soon as possible.</p>`,
      contentHtml: buildInfoCard([
        ["Ticket", `#${escapeHtml(ticket?.ticketNumber || "—")}`],
        ["Subject", escapeHtml(ticket?.subject || "—")],
        ["Priority", escapeHtml(ticket?.priority || "medium")],
        ["Status", "Open"],
      ]),
      footerHtml: `<div style="text-align:center;margin-top:28px;">${buildCtaButton("View Ticket", ticketUrl)}</div>`,
    }),
  });
}

async function sendSupportReplyEmail(ticket, user, replyMessage) {
  const ticketUrl = `${getBaseUrl()}/dashboard/support`;
  const email = user?.email || ticket?.email;
  if (!email) return;

  await safeSendMail({
    from: `"Mustapha Ukizuru" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `Support Reply — Ticket #${escapeHtml(ticket?.ticketNumber || "—")}`,
    html: getEmailShell({
      preheader: "Our team has replied to your support ticket.",
      headerTitle: "Support Reply",
      introHtml: `<p style="font-size:15px;line-height:26px;color:#5f6470;margin:0 0 16px;">Our support team has replied to your ticket <strong>#${escapeHtml(ticket?.ticketNumber || "—")}</strong>.</p>`,
      contentHtml: buildInfoCard([
        ["Subject", escapeHtml(ticket?.subject || "—")],
        ["Reply", escapeHtml(replyMessage || "—")],
      ]),
      footerHtml: `<div style="text-align:center;margin-top:28px;">${buildCtaButton("View Full Thread", ticketUrl)}</div>`,
    }),
  });
}

async function sendNewsletterConfirmationEmail(email) {
  await safeSendMail({
    from: `"Mustapha Ukizuru" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "You're subscribed — Mustapha Ukizuru",
    html: getEmailShell({
      preheader: "You've been added to the newsletter. Stay up to date with insights and product updates.",
      headerTitle: "Subscription Confirmed",
      introHtml: `<p style="font-size:15px;line-height:26px;color:#5f6470;margin:0 0 16px;">You've successfully subscribed to updates from Mustapha Ukizuru. You'll receive insights, product announcements, and technology resources.</p>`,
      footerHtml: `<div style="text-align:center;margin-top:28px;">${buildCtaButton("Explore Digital Store", `${getBaseUrl()}/store`)}</div>`,
    }),
  });
}

async function sendPasswordResetConfirmationEmail(email) {
  const loginUrl = `${getBaseUrl()}/login`;
  await safeSendMail({
    from: `"Mustapha Ukizuru" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Password Changed Successfully",
    html: getEmailShell({
      preheader: "Your password has been updated. Sign in with your new credentials.",
      headerTitle: "Password Updated",
      introHtml: `<p style="font-size:15px;line-height:26px;color:#5f6470;margin:0 0 16px;">Your account password has been changed successfully. If you did not make this change, please contact our support team immediately.</p>`,
      footerHtml: `<div style="text-align:center;margin-top:28px;">${buildCtaButton("Sign In", loginUrl)}</div>`,
    }),
  });
}

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