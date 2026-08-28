// @ts-check
import { test, expect } from "@playwright/test"

/**
 * Mobile navigation drawer, in a real touch-enabled browser.
 *
 * These lock the behaviour that was reported broken: the menu opened and
 * then disappeared as soon as the user tried to look at it. The cause was a
 * document-level "scroll to close" listener — when the nav list fit without
 * overflow (the common case), ANY 6px vertical swipe dismissed the menu, and
 * the same touch that tapped the hamburger could dismiss it before it had
 * finished opening.
 *
 * What is asserted here:
 *   1. the drawer opens from the hamburger and its links are visible
 *   2. a vertical swipe over the drawer does NOT close it   ← the bug
 *   3. a decisive horizontal swipe DOES close it            ← the replacement
 *   4. Escape and the X button still close it
 *
 * Every API call is stubbed at the network layer (see checkout.spec.js for
 * the rationale) so the suite never touches the production database.
 */

const BASE = "http://localhost:4173"

// iPhone-class viewport with touch enabled — the drawer is `lg:hidden`, so a
// desktop viewport would not render it at all.
//
// The properties are set explicitly rather than spreading devices["iPhone 12"]:
// that preset carries `defaultBrowserType: "webkit"`, and CI installs chromium
// only (see .github/workflows/ci.yml), so the spread would fail to launch.
test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  baseURL: BASE,
})

/** Answer every /api/* call with an empty-but-valid shape. */
async function stubApi(page) {
  await page.route("**/api/**", (route) => {
    const url = route.request().url()
    if (url.includes("/auth/me")) {
      return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ success: false }) })
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: [], items: [], posts: [], products: [], total: 0 }),
    })
  })
}

async function openMenu(page) {
  await page.goto("/")
  const hamburger = page.getByRole("button", { name: /open menu|abrir menú/i })
  await hamburger.waitFor({ state: "visible" })
  await hamburger.tap()
  const drawer = page.getByRole("dialog")
  await expect(drawer).toBeVisible()
  return drawer
}

/** Swipe inside `box` by (dx, dy) using real touch events. */
async function swipe(page, box, dx, dy, steps = 8) {
  const startX = box.x + box.width / 2
  const startY = box.y + box.height / 2
  // Playwright's touchscreen has no drag primitive, and a tap here could
  // activate whatever link sits under the finger — dispatch the raw touch
  // sequence instead.
  await page.evaluate(
    ({ startX, startY, dx, dy, steps }) => {
      const el = document.elementFromPoint(startX, startY) || document.body
      const mk = (type, x, y) => {
        const touch = new Touch({ identifier: 1, target: el, clientX: x, clientY: y })
        return new TouchEvent(type, { touches: type === "touchend" ? [] : [touch], targetTouches: type === "touchend" ? [] : [touch], changedTouches: [touch], bubbles: true, cancelable: true })
      }
      el.dispatchEvent(mk("touchstart", startX, startY))
      for (let i = 1; i <= steps; i++) {
        el.dispatchEvent(mk("touchmove", startX + (dx * i) / steps, startY + (dy * i) / steps))
      }
      el.dispatchEvent(mk("touchend", startX + dx, startY + dy))
    },
    { startX, startY, dx, dy, steps }
  )
}

test.describe("mobile navigation drawer", () => {
  test.beforeEach(async ({ page }) => { await stubApi(page) })

  test("opens from the hamburger and shows the nav links", async ({ page }) => {
    const drawer = await openMenu(page)
    await expect(drawer.getByRole("link", { name: /about|acerca/i }).first()).toBeVisible()
    await expect(drawer.getByRole("link", { name: /contact|contacto/i }).first()).toBeVisible()
  })

  test("stays open when the user swipes vertically (the reported bug)", async ({ page }) => {
    const drawer = await openMenu(page)
    const box = await drawer.boundingBox()
    if (!box) throw new Error("drawer has no box")

    await swipe(page, box, 0, -120)   // swipe up, i.e. scroll the list down
    await page.waitForTimeout(400)
    await expect(drawer).toBeVisible()

    await swipe(page, box, 0, 120)    // and back down
    await page.waitForTimeout(400)
    await expect(drawer).toBeVisible()
  })

  test("closes on a decisive horizontal swipe", async ({ page }) => {
    const drawer = await openMenu(page)
    const box = await drawer.boundingBox()
    if (!box) throw new Error("drawer has no box")

    await swipe(page, box, 160, 0)    // drag right — the panel entered from the right
    await expect(drawer).toBeHidden({ timeout: 5000 })
  })

  test("closes on Escape and from the X button", async ({ page }) => {
    const drawer = await openMenu(page)
    await page.keyboard.press("Escape")
    await expect(drawer).toBeHidden()

    // No backdrop assertion on purpose: below the `sm` breakpoint the panel
    // is full-width by design, so there is no backdrop to tap on a phone —
    // the X (and Escape) are the dismissal affordances there.
    const again = await openMenu(page)
    await again.getByRole("button", { name: /close menu|cerrar men/i }).tap()
    await expect(again).toBeHidden()
  })
})
