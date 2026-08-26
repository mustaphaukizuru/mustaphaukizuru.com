/**
 * src/jobs/abandonedCartJob.js · one reminder for a cart that went quiet
 *
 * S2. A cart that sits unpaid is a customer who already chose. This sends
 * ONE email, once, when a signed-in customer's active cart has had no
 * activity for `hours` — the single highest-ROI commerce feature the app
 * did not have. Runs every 30 minutes from scheduler.js.
 *
 * WHAT MAKES IT SAFE TO RUN UNATTENDED
 *
 *   - Never flips Cart.status. The storefront looks up `active` carts
 *     (cartService.getOrCreateActiveCart); marking a cart `abandoned` would
 *     make it vanish from the customer's own cart page, which is the
 *     opposite of what a reminder is for.
 *
 *   - Dedupes through EmailLog, not a new column: a reminder is skipped if
 *     one was logged for this user in the last `dedupeDays`. That avoids a
 *     second schema change on top of the one A6 already owes the operator,
 *     and it dedupes at the level that matters — the person, not the cart
 *     row — so a customer who clears and refills a cart is not nagged twice.
 *
 *   - Only carts touched within the last `dedupeDays`. A cart abandoned a
 *     month ago is not a warm lead; emailing it is noise.
 *
 *   - Guest carts (no userId) have no address to write to and are excluded
 *     in the WHERE, not in JS.
 *
 *   - Probes the DB first (Hostinger drops idle sockets — see lib/prisma.js)
 *     and skips the pass rather than half-send.
 *
 *   - Batch-capped. A backlog is drained over several passes rather than in
 *     one burst through SMTP.
 */
const prisma = require("../lib/prisma")
const { isAlive, recycle } = require("../lib/prisma")
const logger = require("../utils/logger")
const { sendTemplateEmail } = require("../services/emailService")
const { resolveUserLocale } = require("../utils/resolveUserLocale")

const TEMPLATE_KEY = "cart.abandoned"
const DEFAULT_HOURS = 3
const DEFAULT_DEDUPE_DAYS = 7
const DEFAULT_LIMIT = 100

function frontendBase() {
  return (process.env.FRONTEND_URL || process.env.CLIENT_URL || "").replace(/\/$/, "")
}

function formatMoney(amount, currency = "MXN") {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(amount))
  } catch {
    return `${amount} ${currency}`
  }
}

async function runAbandonedCartPass({
  hours = DEFAULT_HOURS,
  dedupeDays = DEFAULT_DEDUPE_DAYS,
  limit = DEFAULT_LIMIT,
  now = new Date(),
} = {}) {
  if (!(await isAlive())) {
    await recycle()
    if (!(await isAlive())) {
      logger.warn("[abandonedCart] database unreachable — skipping this pass")
      return { skipped: true, reason: "db-unreachable", sent: 0, deduped: 0, failed: 0 }
    }
  }

  const quietSince = new Date(now.getTime() - hours * 60 * 60 * 1000)
  const notOlderThan = new Date(now.getTime() - dedupeDays * 24 * 60 * 60 * 1000)

  const carts = await prisma.cart.findMany({
    where: {
      status: "active",
      userId: { not: null },
      updatedAt: { lte: quietSince, gte: notOlderThan },
      items: { some: {} },
    },
    orderBy: { updatedAt: "asc" },
    take: Math.max(1, Math.min(500, Number(limit) || DEFAULT_LIMIT)),
    include: {
      // resolveUserLocale({ user }) reads user.profile?.locale. The whole
      // relation is included rather than a field select so this never throws
      // if UserProfile gains or renames that column; the helper falls back to
      // "en" when it is absent.
      user:  { select: { id: true, email: true, fullName: true, profile: true } },
      items: { select: { titleSnapshot: true, priceSnapshot: true, quantity: true } },
    },
  })

  let sent = 0, deduped = 0, failed = 0

  for (const cart of carts) {
    const user = cart.user
    if (!user?.email) continue

    const already = await prisma.emailLog.findFirst({
      where: {
        userId: user.id,
        templateKey: TEMPLATE_KEY,
        createdAt: { gte: notOlderThan },
        status: { in: ["queued", "sent"] },
      },
      select: { id: true },
    })
    if (already) { deduped++; continue }

    const itemCount = cart.items.reduce((n, i) => n + (Number(i.quantity) || 1), 0)
    const subtotal  = cart.items.reduce((n, i) => n + Number(i.priceSnapshot || 0) * (Number(i.quantity) || 1), 0)
    const first     = cart.items[0]?.titleSnapshot || "your items"
    const itemsSummary = cart.items
      .map((i) => `${i.quantity > 1 ? `${i.quantity} × ` : ""}${i.titleSnapshot}`)
      .join(", ")

    try {
      await sendTemplateEmail({
        locale:      resolveUserLocale({ user }),
        to:          user.email,
        templateKey: TEMPLATE_KEY,
        userId:      user.id,
        variables: {
          customerName: (user.fullName || "").split(" ")[0] || "there",
          itemCount,
          firstItem:    first,
          itemsSummary,
          cartTotal:    formatMoney(subtotal),
          cartUrl:      `${frontendBase()}/cart`,
        },
      })
      sent++
    } catch (err) {
      failed++
      logger.warn(`[abandonedCart] send failed for user ${user.id} (cart ${cart.id}): ${err.message}`)
    }
  }

  if (carts.length) {
    logger.info(`[abandonedCart] candidates=${carts.length} sent=${sent} deduped=${deduped} failed=${failed} (quiet >= ${hours}h)`)
  }
  return { skipped: false, candidates: carts.length, sent, deduped, failed }
}

module.exports = { runAbandonedCartPass, TEMPLATE_KEY, DEFAULT_HOURS, DEFAULT_DEDUPE_DAYS, DEFAULT_LIMIT }
