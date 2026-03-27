const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function renderItems(items = []) {
  return items
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #eee;">${item.title}</td>
          <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
          <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;">${money(item.price)}</td>
        </tr>
      `
    )
    .join("");
}

async function sendResetEmail(email, resetLink) {
  await transporter.sendMail({
    from: `"Mustapha Ukizuru" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Password Reset",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;">
        <h2 style="color:#420060;">Password Reset</h2>
        <p>You requested a password reset.</p>
        <p>
          <a href="${resetLink}" style="display:inline-block;padding:12px 18px;background:#420060;color:#fff;text-decoration:none;border-radius:8px;">
            Reset Password
          </a>
        </p>
        <p>This link expires in 1 hour.</p>
      </div>
    `,
  });
}

async function sendOrderPlacedEmail(order) {
  await transporter.sendMail({
    from: `"Mustapha Ukizuru" <${process.env.SMTP_USER}>`,
    to: order.customerEmail,
    subject: `Order Received - ${order.id}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:24px;">
        <h2 style="color:#420060;">Order Received</h2>
        <p>Hello ${order.customerName},</p>
        <p>We received your order successfully. It is currently <strong>pending payment confirmation</strong>.</p>

        <div style="margin:20px 0;padding:16px;background:#f8f4f2;border-radius:12px;">
          <p style="margin:0 0 8px;"><strong>Order ID:</strong> ${order.id}</p>
          <p style="margin:0 0 8px;"><strong>Status:</strong> ${order.status}</p>
          <p style="margin:0;"><strong>Total:</strong> ${money(order.totalAmount)}</p>
        </div>

        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="text-align:left;padding:10px 0;border-bottom:1px solid #ddd;">Product</th>
              <th style="text-align:center;padding:10px 0;border-bottom:1px solid #ddd;">Qty</th>
              <th style="text-align:right;padding:10px 0;border-bottom:1px solid #ddd;">Unit Price</th>
            </tr>
          </thead>
          <tbody>
            ${renderItems(order.items)}
          </tbody>
        </table>

        <p style="margin-top:24px;">Once payment is confirmed, you will receive another email confirming that your downloads are ready.</p>
      </div>
    `,
  });
}

async function sendOrderPaidEmail(order) {
  const dashboardUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/dashboard/products`;

  await transporter.sendMail({
    from: `"Mustapha Ukizuru" <${process.env.SMTP_USER}>`,
    to: order.customerEmail,
    subject: `Payment Confirmed - ${order.id}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:24px;">
        <h2 style="color:#420060;">Payment Confirmed</h2>
        <p>Hello ${order.customerName},</p>
        <p>Your payment has been confirmed and your digital products are now available in your member dashboard.</p>

        <div style="margin:20px 0;padding:16px;background:#f8f4f2;border-radius:12px;">
          <p style="margin:0 0 8px;"><strong>Order ID:</strong> ${order.id}</p>
          <p style="margin:0 0 8px;"><strong>Status:</strong> ${order.status}</p>
          <p style="margin:0;"><strong>Total:</strong> ${money(order.totalAmount)}</p>
        </div>

        <p style="margin:24px 0;">
          <a href="${dashboardUrl}" style="display:inline-block;padding:12px 18px;background:#420060;color:#fff;text-decoration:none;border-radius:8px;">
            Open My Products
          </a>
        </p>

        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="text-align:left;padding:10px 0;border-bottom:1px solid #ddd;">Product</th>
              <th style="text-align:center;padding:10px 0;border-bottom:1px solid #ddd;">Qty</th>
              <th style="text-align:right;padding:10px 0;border-bottom:1px solid #ddd;">Unit Price</th>
            </tr>
          </thead>
          <tbody>
            ${renderItems(order.items)}
          </tbody>
        </table>
      </div>
    `,
  });
}

async function sendOrderPendingEmail(order) {
  await transporter.sendMail({
    from: `"Mustapha Ukizuru" <${process.env.SMTP_USER}>`,
    to: order.customerEmail,
    subject: `Order Pending - ${order.id}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:24px;">
        <h2 style="color:#420060;">Order Pending</h2>
        <p>Hello ${order.customerName},</p>
        <p>Your order status has been updated to <strong>pending</strong>. We are still waiting for payment confirmation or review.</p>

        <div style="margin:20px 0;padding:16px;background:#f8f4f2;border-radius:12px;">
          <p style="margin:0 0 8px;"><strong>Order ID:</strong> ${order.id}</p>
          <p style="margin:0 0 8px;"><strong>Status:</strong> ${order.status}</p>
          <p style="margin:0;"><strong>Total:</strong> ${money(order.totalAmount)}</p>
        </div>

        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="text-align:left;padding:10px 0;border-bottom:1px solid #ddd;">Product</th>
              <th style="text-align:center;padding:10px 0;border-bottom:1px solid #ddd;">Qty</th>
              <th style="text-align:right;padding:10px 0;border-bottom:1px solid #ddd;">Unit Price</th>
            </tr>
          </thead>
          <tbody>
            ${renderItems(order.items)}
          </tbody>
        </table>
      </div>
    `,
  });
}

async function sendOrderCancelledEmail(order) {
  await transporter.sendMail({
    from: `"Mustapha Ukizuru" <${process.env.SMTP_USER}>`,
    to: order.customerEmail,
    subject: `Order Cancelled - ${order.id}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:24px;">
        <h2 style="color:#420060;">Order Cancelled</h2>
        <p>Hello ${order.customerName},</p>
        <p>Your order has been updated to <strong>cancelled</strong>. If you believe this is incorrect, please contact support.</p>

        <div style="margin:20px 0;padding:16px;background:#f8f4f2;border-radius:12px;">
          <p style="margin:0 0 8px;"><strong>Order ID:</strong> ${order.id}</p>
          <p style="margin:0 0 8px;"><strong>Status:</strong> ${order.status}</p>
          <p style="margin:0;"><strong>Total:</strong> ${money(order.totalAmount)}</p>
        </div>

        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="text-align:left;padding:10px 0;border-bottom:1px solid #ddd;">Product</th>
              <th style="text-align:center;padding:10px 0;border-bottom:1px solid #ddd;">Qty</th>
              <th style="text-align:right;padding:10px 0;border-bottom:1px solid #ddd;">Unit Price</th>
            </tr>
          </thead>
          <tbody>
            ${renderItems(order.items)}
          </tbody>
        </table>
      </div>
    `,
  });
}

async function sendOrderFailedEmail(order) {
  const dashboardUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/dashboard/products`;

  await transporter.sendMail({
    from: `"Mustapha Ukizuru" <${process.env.SMTP_USER}>`,
    to: order.customerEmail,
    subject: `Order Failed - ${order.id}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:24px;">
        <h2 style="color:#420060;">Payment Failed</h2>
        <p>Hello ${order.customerName},</p>
        <p>Your order has been updated to <strong>failed</strong>. The payment could not be completed or was not confirmed. Please try again or contact support if you need help.</p>

        <div style="margin:20px 0;padding:16px;background:#f8f4f2;border-radius:12px;">
          <p style="margin:0 0 8px;"><strong>Order ID:</strong> ${order.id}</p>
          <p style="margin:0 0 8px;"><strong>Status:</strong> ${order.status}</p>
          <p style="margin:0;"><strong>Total:</strong> ${money(order.totalAmount)}</p>
        </div>

        <p style="margin:24px 0;">
          <a href="${dashboardUrl}" style="display:inline-block;padding:12px 18px;background:#420060;color:#fff;text-decoration:none;border-radius:8px;">
            Open My Products
          </a>
        </p>

        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="text-align:left;padding:10px 0;border-bottom:1px solid #ddd;">Product</th>
              <th style="text-align:center;padding:10px 0;border-bottom:1px solid #ddd;">Qty</th>
              <th style="text-align:right;padding:10px 0;border-bottom:1px solid #ddd;">Unit Price</th>
            </tr>
          </thead>
          <tbody>
            ${renderItems(order.items)}
          </tbody>
        </table>
      </div>
    `,
  });
}

async function sendOrderRefundedEmail(order) {
  await transporter.sendMail({
    from: `"Mustapha Ukizuru" <${process.env.SMTP_USER}>`,
    to: order.customerEmail,
    subject: `Order Refunded - ${order.id}` ,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:24px;">
        <h2 style="color:#420060;">Order Refunded</h2>
        <p>Hello ${order.customerName},</p>
        <p>Your order has been updated to <strong>refunded</strong>. Any eligible refund has been initiated to your original payment method.</p>

        <div style="margin:20px 0;padding:16px;background:#f8f4f2;border-radius:12px;">
          <p style="margin:0 0 8px;"><strong>Order ID:</strong> ${order.id}</p>
          <p style="margin:0 0 8px;"><strong>Status:</strong> ${order.status}</p>
          <p style="margin:0;"><strong>Total:</strong> ${money(order.totalAmount)}</p>
        </div>

        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="text-align:left;padding:10px 0;border-bottom:1px solid #ddd;">Product</th>
              <th style="text-align:center;padding:10px 0;border-bottom:1px solid #ddd;">Qty</th>
              <th style="text-align:right;padding:10px 0;border-bottom:1px solid #ddd;">Unit Price</th>
            </tr>
          </thead>
          <tbody>
            ${renderItems(order.items)}
          </tbody>
        </table>
      </div>
    `,
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
};
