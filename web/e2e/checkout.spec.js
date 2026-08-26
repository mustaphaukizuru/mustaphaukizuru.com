// @ts-check
import { test, expect } from "@playwright/test"

/**
 * The money path, in a browser: store → add to cart → cart → checkout →
 * Mercado Pago hand-off → success page. All API traffic is stubbed with
 * page.route (see playwright.config.js for why), the gateway redirect is
 * pointed back at our own success page, and the order-status probe reports
 * "paid". We assert the payloads the SPA sends and the screens it renders.
 */

const BASE = "http://localhost:4173"

const USER = { id: "usr_e2e", email: "buyer@example.com", fullName: "E2E Buyer", role: "member", isClaimed: true }

const PRODUCT = {
  id: "prod_e2e",
  slug: "e2e-playbook",
  title: "E2E Automation Playbook",
  shortDescription: "A test product that only exists inside Playwright.",
  price: 499,
  currency: "MXN",
  category: "Templates",
  images: [],
  files: [],
  features: [],
  isActive: true,
}

const UPSELL = { ...PRODUCT, id: "prod_e2e_2", slug: "e2e-toolkit", title: "E2E Ops Toolkit", price: 299 }

const ORDER_ID = "ord_e2e_001"

/** Seed a signed-in session the way the SPA recognises one (auth-user cache + csrf cookie). */
async function signIn(context) {
  await context.addCookies([{ name: "mu_csrf", value: "e2e-csrf-token", url: BASE }])
  await context.addInitScript((user) => {
    window.localStorage.setItem("auth-user", JSON.stringify(user))
  }, USER)
}

/** The store card shows "Add" at desktop widths and "Add to Cart" on the product page. */
const addButton = (page) => page.getByRole("button", { name: /^add( to cart)?$/i }).first()

/** The consent banner sits over the page on first visit; get it out of the way. */
async function dismissConsent(page) {
  const accept = page.getByRole("button", { name: /accept all/i })
  if (await accept.isVisible().catch(() => false)) await accept.click()
}

/** Stub every API the funnel touches. Returns the captured request bodies. */
async function stubApi(page, { orderStatus = 201 } = {}) {
  const captured = { addToCart: null, order: null, preference: null }
  const cart = { id: "cart_e2e", items: [], totals: { subtotal: 0, discount: 0, tax: 0, total: 0 } }
  const cartPayload = () => ({ success: true, data: cart })
  const recalc = () => {
    cart.totals.subtotal = cart.items.reduce((s, i) => s + i.priceSnapshot * i.quantity, 0)
    cart.totals.total = cart.totals.subtotal
  }
  const ok = (data) => ({ json: { success: true, data } })

  // Registered first so the specific routes below win (Playwright tries the
  // most recently registered route first).
  await page.route("**/api/**", (route) =>
    route.fulfill({ status: 404, json: { success: false, message: `unstubbed ${route.request().method()} ${route.request().url()}` } }))

  await page.route("**/api/**/analytics/**", (route) => route.fulfill({ status: 204, body: "" }))
  await page.route("**/api/**/auth/me", (route) => route.fulfill(ok(USER)))
  await page.route("**/api/**/member/addresses**", (route) => route.fulfill(ok([])))
  await page.route("**/api/**/products/featured**", (route) => route.fulfill(ok([PRODUCT])))
  await page.route(`**/api/**/products/${PRODUCT.slug}`, (route) => route.fulfill(ok(PRODUCT)))
  await page.route(`**/api/**/products/${PRODUCT.slug}/related`, (route) => route.fulfill(ok([UPSELL, PRODUCT])))
  await page.route("**/api/**/products", (route) => route.fulfill(ok([PRODUCT])))
  await page.route("**/api/**/products?**", (route) => route.fulfill(ok([PRODUCT])))

  await page.route("**/api/**/member/cart", (route) => {
    if (route.request().method() === "DELETE") { cart.items = []; recalc() }
    route.fulfill(ok(cart))
  })
  await page.route("**/api/**/member/cart/merge", (route) =>
    route.fulfill({ json: { ...cartPayload(), merged: 0, skipped: 0 } }))
  await page.route("**/api/**/member/cart/items", (route) => {
    const body = route.request().postDataJSON()
    captured.addToCart = body
    const existing = cart.items.find((i) => i.productId === body.productId)
    if (existing) existing.quantity += body.quantity
    else cart.items.push({ id: "line_1", productId: body.productId, quantity: body.quantity, priceSnapshot: PRODUCT.price, titleSnapshot: PRODUCT.title, product: PRODUCT })
    recalc()
    route.fulfill(ok(cart))
  })

  await page.route("**/api/**/orders", (route) => {
    captured.order = { body: route.request().postDataJSON(), headers: route.request().headers() }
    if (orderStatus !== 201) {
      return route.fulfill({ status: orderStatus, json: { success: false, message: "Order rejected by test" } })
    }
    route.fulfill({ status: 201, json: { success: true, data: { id: ORDER_ID, orderNumber: "MU-E2E-1", status: "pending", totalAmount: PRODUCT.price, currency: "MXN" } } })
  })
  await page.route("**/api/**/mercadopago/create-preference", (route) => {
    captured.preference = route.request().postDataJSON()
    route.fulfill(ok({ initPoint: `${BASE}/checkout/success/${ORDER_ID}?gateway=mercadopago&pending=true` }))
  })
  await page.route(`**/api/**/orders/${ORDER_ID}/status`, (route) =>
    route.fulfill(ok({ status: "paid", paymentProvider: "mercadopago" })))
  await page.route(`**/api/**/orders/${ORDER_ID}`, (route) =>
    route.fulfill(ok({
      id: ORDER_ID, orderNumber: "MU-E2E-1", status: "paid", totalAmount: PRODUCT.price, currency: "MXN",
      paymentProvider: "mercadopago", createdAt: new Date(0).toISOString(),
      items: [{ id: "oi_1", productId: PRODUCT.id, titleSnapshot: PRODUCT.title, unitPrice: PRODUCT.price, quantity: 1, product: { id: PRODUCT.id, slug: PRODUCT.slug, title: PRODUCT.title } }],
      downloads: [],
    })))

  return captured
}

test.describe("checkout funnel", () => {
  test("a signed-in buyer goes store → cart → checkout → paid success", async ({ page, context }) => {
    await signIn(context)
    const captured = await stubApi(page)

    // Store: the stubbed product is listed and can be added.
    await page.goto("/store")
    await dismissConsent(page)
    await expect(page.getByText(PRODUCT.title).first()).toBeVisible()
    await addButton(page).click()
    await expect.poll(() => captured.addToCart).toEqual({ productId: PRODUCT.id, quantity: 1 })

    // Cart: the line is on screen, and Checkout leads to /checkout.
    await page.goto("/cart")
    await expect(page.getByText(PRODUCT.title).first()).toBeVisible()
    await page.getByRole("button", { name: /^checkout$/i }).first().click()
    await expect(page).toHaveURL(/\/checkout$/)

    // Checkout: identity is prefilled from the session; agree to terms; place the order.
    await expect(page.getByLabel(/full name/i)).toHaveValue(USER.fullName)
    await expect(page.getByLabel(/^email$/i)).toHaveValue(USER.email)
    await page.getByRole("button", { name: /agree to terms/i }).filter({ visible: true }).first().click()
    await page.getByRole("button", { name: /place order/i }).click()

    // The SPA creates the order with the cart lines, then asks for a preference for THAT order.
    await expect.poll(() => captured.order).not.toBeNull()
    expect(captured.order.body).toMatchObject({
      customerName: USER.fullName,
      customerEmail: USER.email,
      items: [{ productId: PRODUCT.id, quantity: 1 }],
    })
    expect(captured.order.headers["idempotency-key"]).toBeTruthy()
    await expect.poll(() => captured.preference).toEqual({ orderId: ORDER_ID })

    // Gateway hand-off comes back to the success page, which polls the probe and lands on "paid".
    await expect(page).toHaveURL(new RegExp(`/checkout/success/${ORDER_ID}`))
    await expect(page.getByRole("heading", { name: /thank you for your order/i })).toBeVisible()
    await expect(page.getByText("MU-E2E-1").first()).toBeVisible()

    // S6 · post-purchase upsell: related to what was bought, minus what was bought.
    await expect(page.getByRole("heading", { name: /you may also like/i })).toBeVisible()
    await expect(page.getByRole("link", { name: new RegExp(UPSELL.title) })).toBeVisible()
    await expect(page.getByRole("link", { name: new RegExp(`^${PRODUCT.title}`) })).toHaveCount(0)
  })

  test("a visitor without a session is sent to login before checkout", async ({ page }) => {
    await stubApi(page)
    await page.goto("/checkout")
    await expect(page).toHaveURL(/\/login/)
  })

  test("a rejected order keeps the buyer on checkout with the error, no gateway call", async ({ page, context }) => {
    await signIn(context)
    const captured = await stubApi(page, { orderStatus: 400 })

    await page.goto("/store")
    await dismissConsent(page)
    await addButton(page).click()
    await expect.poll(() => captured.addToCart).not.toBeNull()

    await page.goto("/checkout")
    await page.getByRole("button", { name: /agree to terms/i }).filter({ visible: true }).first().click()
    await page.getByRole("button", { name: /place order/i }).click()

    await expect(page.getByRole("alert").filter({ hasText: /order rejected by test/i })).toBeVisible()
    await expect(page).toHaveURL(/\/checkout$/)
    expect(captured.preference).toBeNull()
  })
})
