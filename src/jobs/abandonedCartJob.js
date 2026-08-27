/**
 * src/jobs/abandonedCartJob.js · reminders for a cart that went quiet
 *
 * S2 (touch 1) + Tier 3 v2 (touch 2). A cart that sits unpaid is a customer
 * who already chose. Runs every 30 minutes from scheduler.js.
 *
 *   Touch 1 · `cart.abandoned`        — `hours` (3) after the cart went quiet.
 *   Touch 2 · `cart.abandoned-offer`  — `secondTouchHours` (72) after touch 1,
 *             with a single-use, per-customer, 7-day COMEBACK-xxxx coupon
 *             minted for that cart. One offer per cart, ever.
 *
 * WHAT MAKES IT SAFE TO RUN UNATTENDED
 *
 *   - Never flips Cart.status. The storefront looks up `active` carts
 *     (cartService.getOrCreateActiveCart); marking a cart `abandoned` would
 *     make it vanish from the customer's own cart page.
 *
 *   - Dedupes through EmailLog, not a new column. Touch 1 is skipped if one
 *     was logged for this user since the CART was created (and within
 *     `dedupeDays`) — so a customer who buys, then starts a new cart, gets a
 *     fresh reminder instead of a week of silence. Touch 2 is keyed on the
 *     coupon it minted (description `abandoned-cart:<cartId>`), so it can
 *     never fire twice for the same cart even if the email log is pruned.
 *
 *   - Skips carts whose items the customer already bought after the cart
 *     went quiet (the "bought it in another tab" case) — no reminder, no
 *     coupon for something they own.
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

const TEMPLATE_KEY        = "cart.abandoned"
const OFFER_TEMPLATE_KEY  = "cart.abandoned-offer"
const DEFAULT_HOURS       = 3
const DEFAULT_DEDUPE_DAYS = 7
const DEFAULT_LIMIT       = 100
const DEFAULT_SECOND_TOUCH_HOURS = 72
const DEFAULT_OFFER_PCT   = 10
const OFFER_VALID_DAYS    = 7
const OFFER_PREFIX        = "COMEBACK-"

function frontendBase() {
  return (process.env.FRONTEND_URL || process.env.CLIENT_URL || "").replace(/\/$/, "")
}

function offerPct() {
  const n = Number(process.env.ABANDONED_CART_OFFER_PCT)
  return Number.isFinite(n) && n > 0 && n <= 50 ? Math.round(n) : DEFAULT_OFFER_PCT
}

function secondTouchHours() {
  const n = Number(process.env.ABANDONED_CART_SECOND_TOUCH_HOURS)
  return Number.isFinite(n) && n >= 1 ? n : DEFAULT_SECOND_TOUCH_HOURS
}

/** Money in the customer's locale, in the CART's currency — never hardcoded MXN/en-US. */
function formatMoney(amount, currency = "MXN", locale = "en") {
  const tag = String(locale).toLowerCase().startsWith("es") ? "es-MX" : "en-US"
  try {
    return new Intl.NumberFormat(tag, { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(amount))
  } catch {
    return `${amount} ${currency}`
  }
}

function formatDate(date, locale = "en") {
  const tag = String(locale).toLowerCase().startsWith("es") ? "es-MX" : "en-US"
  try { return new Intl.DateTimeFormat(tag, { dateStyle: "long" }).format(date) } catch { return date.toISOString().slice(0, 10) }
}

function offerCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let s = ""
  for (let i = 0; i < 6; i += 1) s += alphabet[Math.floor(Math.random() * alphabet.length)]
  return `${OFFER_PREFIX}${s}`
}

/** True when the customer bought any of the cart's products after the cart went quiet. */
async function alreadyPurchased(cart) {
  const productIds = (cart.items || []).map((i) => i.productId).filter(Boolean)
  if (!productIds.length || !prisma.order?.findFirst) return false
  const order = await prisma.order.findFirst({
    where: {
      userId:    cart.userId,
      status:    { in: ["paid", "completed"] },
      createdAt: { gte: cart.updatedAt },
      items:     { some: { productId: { in: productIds } } },
    },
    select: { id: true },
  })
  return Boolean(order)
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
      return { skipped: true, reason: "db-unreachable", sent: 0, offers: 0, deduped: 0, purchased: 0, failed: 0 }
    }
  }

  const quietSince   = new Date(now.getTime() - hours * 60 * 60 * 1000)
  const notOlderThan = new Date(now.getTime() - dedupeDays * 24 * 60 * 60 * 1000)
  const secondTouchBefore = new Date(now.getTime() - secondTouchHours() * 60 * 60 * 1000)

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
      // resolveUserLocale({ user }) reads user.profile — the whole relation is
      // included rather than a field select so this never throws if
      // UserProfile gains or renames a column.
      user:  { select: { id: true, email: true, fullName: true, profile: true } },
      items: { select: { productId: true, titleSnapshot: true, priceSnapshot: true, quantity: true, product: { select: { currency: true } } } },
    },
  })

  let sent = 0, offers = 0, deduped = 0, purchased = 0, failed = 0

  for (const cart of carts) {
    const user = cart.user
    if (!user?.email) continue

    // Touch-1 dedupe: one reminder per user per dedupeDays — but a cart
    // created AFTER the last reminder is a new decision and gets its own.
    const sinceCart = cart.createdAt ? new Date(Math.max(notOlderThan.getTime(), new Date(cart.createdAt).getTime())) : notOlderThan
    const firstTouch = await prisma.emailLog.findFirst({
      where: {
        userId: user.id,
        templateKey: TEMPLATE_KEY,
        createdAt: { gte: sinceCart },
        status: { in: ["queued", "sent"] },
      },
      select: { id: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    })

    const locale   = resolveUserLocale({ user })
    const currency = cart.items.find((i) => i.product?.currency)?.product.currency || "MXN"
    const itemCount = cart.items.reduce((n, i) => n + (Number(i.quantity) || 1), 0)
    const subtotal  = cart.items.reduce((n, i) => n + Number(i.priceSnapshot || 0) * (Number(i.quantity) || 1), 0)
    const first     = cart.items[0]?.titleSnapshot || "your items"
    const itemsSummary = cart.items
      .map((i) => `${i.quantity > 1 ? `${i.quantity} × ` : ""}${i.titleSnapshot}`)
      .join(", ")
    const baseVars = {
      customerName: (user.fullName || "").split(" ")[0] || "there",
      itemCount,
      firstItem:    first,
      itemsSummary,
      cartTotal:    formatMoney(subtotal, currency, locale),
      cartUrl:      `${frontendBase()}/cart`,
    }

    if (!firstTouch) {
      if (await alreadyPurchased(cart)) { purchased++; continue }
      try {
        await sendTemplateEmail({ locale, to: user.email, templateKey: TEMPLATE_KEY, userId: user.id, variables: baseVars })
        sent++
      } catch (err) {
        failed++
        logger.warn(`[abandonedCart] send failed for user ${user.id} (cart ${cart.id}): ${err.message}`)
      }
      continue
    }

    // Touch 2 · only once the first reminder is old enough, only once per cart.
    const firstAt = firstTouch.createdAt ? new Date(firstTouch.createdAt) : null
    if (!firstAt || firstAt.getTime() > secondTouchBefore.getTime() || !prisma.coupon?.findFirst) { deduped++; continue }

    const marker = `abandoned-cart:${cart.id}`
    const existingOffer = await prisma.coupon.findFirst({ where: { description: marker }, select: { id: true } })
    if (existingOffer) { deduped++; continue }
    if (await alreadyPurchased(cart)) { purchased++; continue }

    const expiresAt = new Date(now.getTime() + OFFER_VALID_DAYS * 24 * 60 * 60 * 1000)
    const pct = offerPct()
    let coupon = null
    for (let attempt = 0; attempt < 3 && !coupon; attempt += 1) {
      try {
        coupon = await prisma.coupon.create({
          data: {
            code:           offerCode(),
            description:    marker,
            discountType:   "percentage",
            discountValue:  pct,
            usageLimit:     1,
            maxUsesPerUser: 1,
            stackable:      false,
            startsAt:       now,
            expiresAt,
            isActive:       true,
          },
        })
      } catch (err) {
        if (err?.code !== "P2002") throw err // code collision → retry with a new code
      }
    }
    if (!coupon) { failed++; logger.warn(`[abandonedCart] could not mint offer for cart ${cart.id}`); continue }

    try {
      await sendTemplateEmail({
        locale, to: user.email, templateKey: OFFER_TEMPLATE_KEY, userId: user.id,
        variables: {
          ...baseVars,
          couponCode:   coupon.code,
          discountPct:  pct,
          offerExpires: formatDate(expiresAt, locale),
        },
      })
      offers++
    } catch (err) {
      failed++
      logger.warn(`[abandonedCart] offer send failed for user ${user.id} (cart ${cart.id}): ${err.message}`)
    }
  }

  if (carts.length) {
    logger.info(`[abandonedCart] candidates=${carts.length} sent=${sent} offers=${offers} deduped=${deduped} purchased=${purchased} failed=${failed} (quiet >= ${hours}h)`)
  }
  return { skipped: false, candidates: carts.length, sent, offers, deduped, purchased, failed }
}

module.exports = {
  runAbandonedCartPass, formatMoney,
  TEMPLATE_KEY, OFFER_TEMPLATE_KEY, OFFER_PREFIX,
  DEFAULT_HOURS, DEFAULT_DEDUPE_DAYS, DEFAULT_LIMIT, DEFAULT_SECOND_TOUCH_HOURS, DEFAULT_OFFER_PCT, OFFER_VALID_DAYS,
}
