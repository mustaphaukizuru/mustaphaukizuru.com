// @ts-check
import { test, expect } from "@playwright/test"

/**
 * Client logo wall on /about.
 *
 * The failure mode worth guarding is silent: a filename or path typo still
 * renders an <img>, it just never paints. So this asserts the browser
 * actually decoded every logo (naturalWidth > 0) rather than merely that the
 * elements exist. It also pins the responsive column count, since the wall is
 * the one place the grid changes shape between phone and desktop.
 *
 * API traffic is stubbed at the network layer (see checkout.spec.js for why)
 * so the suite never touches the production database.
 */

const BASE = "http://localhost:4173"
const EXPECTED_LOGOS = 7

test.use({ baseURL: BASE })

async function stubApi(page) {
  await page.route("**/api/**", (route) => {
    const url = route.request().url()
    if (url.includes("/auth/me")) {
      return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ success: false }) })
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: [], items: [], posts: [], total: 0 }),
    })
  })
}

test.describe("client logo wall", () => {
  test.beforeEach(async ({ page }) => { await stubApi(page) })

  test("every client logo actually loads on /about", async ({ page }) => {
    await page.goto("/about")

    const logos = page.locator('img[src^="/images/brand/companies/"]')
    await expect(logos).toHaveCount(EXPECTED_LOGOS)

    // Scroll it into view so the lazy images are fetched.
    await logos.first().scrollIntoViewIfNeeded()

    for (let i = 0; i < EXPECTED_LOGOS; i++) {
      const img = logos.nth(i)
      await expect(img).toBeVisible()
      // A 404 still yields an element — only naturalWidth proves it decoded.
      await expect
        .poll(() => img.evaluate((el) => /** @type {HTMLImageElement} */ (el).naturalWidth), { timeout: 15_000 })
        .toBeGreaterThan(0)
      // Every mark is named, so the wall is meaningful to a screen reader.
      await expect(img).toHaveAttribute("alt", /\w/)
    }
  })

  test("2 columns on a phone, 4 on desktop", async ({ page }) => {
    await page.goto("/about")
    const logos = page.locator('img[src^="/images/brand/companies/"]')
    await logos.first().scrollIntoViewIfNeeded()

    const columnCount = async () => {
      const boxes = await logos.evaluateAll((els) =>
        els.map((el) => Math.round(el.closest("div").getBoundingClientRect().left))
      )
      return new Set(boxes).size
    }

    await page.setViewportSize({ width: 390, height: 844 })
    expect(await columnCount()).toBe(2)

    await page.setViewportSize({ width: 1280, height: 900 })
    expect(await columnCount()).toBe(4)
  })
})
