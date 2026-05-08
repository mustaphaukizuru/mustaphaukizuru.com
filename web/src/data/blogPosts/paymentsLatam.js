import { AUTHOR_MUSTAPHA } from "./_author"

export default {
  slug: "mercadopago-paypal-side-by-side-latam",
  title: "MercadoPago vs PayPal in LATAM: a side-by-side I wish I had",
  excerpt:
    "Fees, UX, dispute flow, payouts, and the integration headaches you only learn about after launch. Honest notes from production.",
  category: "web-development",
  tags: ["MercadoPago", "PayPal", "Mexico"],
  author: AUTHOR_MUSTAPHA,
  publishedAt: "2026-02-14T09:00:00Z",
  readMinutes: 12,
  cover: null,
  featured: false,
  body: [
    { type: "p", text: "If you sell digital products to a LATAM audience, MercadoPago and PayPal are the two rails worth integrating. They are not interchangeable. After running both in production for six months, here's the side-by-side I wish someone had handed me on day one." },

    { type: "h2", text: "Fees, in plain numbers" },
    { type: "p", text: "Both publish fee tables. Reality is messier. **MercadoPago** in Mexico runs roughly 3.49% + IVA on cards, 3.99% + IVA on installments, and 0.99% on cash methods like OXXO. **PayPal** charges 5.4% + fixed fee on cross-border card payments, plus a currency conversion spread of about 4% if your account is in MXN and the buyer pays in USD." },
    { type: "p", text: "For a $50 USD digital product, MercadoPago nets ~$48.25, PayPal nets ~$45.80. On a hundred orders that's $245 of margin." },

    { type: "h2", text: "UX in the Mexican market" },
    { type: "p", text: "MercadoPago's checkout is the local standard. Buyers know the brand, trust it, and pick from local methods (OXXO, SPEI, debit, installments) without flinching. PayPal still has a perception of being for international purchases, useful for gringos and cross-border, less so for local impulse buys." },

    { type: "h2", text: "Integration headaches" },
    { type: "list", items: [
      "**MercadoPago webhooks** retry aggressively. Make handlers idempotent on the order ID, not the webhook ID.",
      "**PayPal IPN vs Webhooks**, they're different systems, both still in production. Use webhooks. Verify the signature with PayPal's verify-webhook endpoint, not a shared secret.",
      "**Refunds**, MercadoPago needs the original payment ID, not the order ID. PayPal needs the capture ID, not the order ID. Store all three.",
      "**Sandbox parity**, MercadoPago's sandbox doesn't fully simulate failed-then-succeeded payments. Test your retry logic against real micro-transactions in production with a test SKU.",
    ] },

    { type: "h2", text: "When to use which" },
    { type: "callout", variant: "info", text: "Default to **MercadoPago** for Mexican / LATAM buyers, fees, UX, and dispute resolution all favour it. Keep **PayPal** as the international fallback so a buyer in the US, Canada, or Europe doesn't bounce. Most platforms eventually run both, with the checkout selecting based on detected geo." },
  ],
}
