/**
 * The Spanish funnel stays Spanish (T2-1).
 *
 * The site routes language by URL prefix and LanguageWrapper sets i18n's
 * language from that prefix on every navigation. So an unprefixed link is
 * not cosmetic: clicking one from /es switches the whole interface to
 * English mid-journey. Roughly 150 of them shipped, which is why the
 * Spanish translation reached almost nobody.
 *
 * This walks the funnel a Spanish prospect actually walks and asserts the
 * prefix survives every hop, plus the two edge cases that were broken:
 * campaign parameters through the language redirect, and operator links
 * that must NOT be prefixed because those routes are not mirrored.
 */
import { test, expect } from "@playwright/test"

/* The services hero rests as an isometric pile of four overlapping tiles and
   springs them apart on scroll, so a click target there is never "stable" and
   whichever tile is on top intercepts the pointer. Under reduced motion the
   hero renders its separated 2x2 grid statically — the same deterministic
   state check-contrast-live.mjs measures against, and for the same reason.
   This spec is about where links point, not how they move.

   It has to be page.emulateMedia rather than `test.use({ reducedMotion })`:
   the nested describes below each declare their own test.use({ locale }),
   which replaces the file-level options instead of merging with them, so the
   fixture form silently reached the browser as "no-preference" (verified —
   matchMedia reported false and the tiles were still stacked). */
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
})

const dismissConsent = async (page) => {
  const accept = page.getByRole("button", { name: /accept all|aceptar todo/i })
  if (await accept.count()) await accept.first().click().catch(() => {})
}

test.describe("a Spanish visitor keeps Spanish", () => {
  test("home → services → a category → book, all inside /es", async ({ page }) => {
    await page.goto("/es")
    await dismissConsent(page)
    await expect(page).toHaveURL(/\/es\/?$/)
    await expect(page.locator("html")).toHaveAttribute("lang", /^es/)

    // Every link the page offers must already carry the prefix — this is the
    // assertion that would have failed on ~150 links before the codemod.
    const unprefixed = await page.evaluate(() =>
      [...document.querySelectorAll('a[href^="/"]')]
        .map((a) => a.getAttribute("href"))
        // Static files are not routes and are never localized.
        .filter((h) => !h.startsWith("/es")
          && !/^\/(admin|dashboard)(\/|$)/.test(h)
          && !/\.(xml|txt|pdf|json|ico|png|jpe?g|webp|avif|svg)$/i.test(h)))
    expect(unprefixed, "internal links on /es that would drop the visitor into English").toEqual([])

    // The drawer duplicates the nav, so several links match; take a visible one.
    await page.getByRole("link", { name: /servicios/i }).filter({ visible: true }).first().click()
    await expect(page).toHaveURL(/\/es\/services/)
    await expect(page.locator("html")).toHaveAttribute("lang", /^es/)

    // No scrollIntoViewIfNeeded here. The category list renders from
    // /api/v1/services, so the first paint is a skeleton and the real list
    // replaces it — a one-shot scroll resolves the locator once and throws
    // "not attached" when that swap lands mid-action. click() re-resolves on
    // retry and scrolls itself, so it rides out the re-render.
    const category = page.locator('a[href^="/es/services/"]').filter({ visible: true }).first()
    await category.click()
    await expect(page).toHaveURL(/\/es\/services\/[a-z-]+/)
    await expect(page.locator("html")).toHaveAttribute("lang", /^es/)

    const book = page.locator('a[href^="/es/book"]').filter({ visible: true }).first()
    await book.click()
    await expect(page).toHaveURL(/\/es\/book/)
    await expect(page.locator("html")).toHaveAttribute("lang", /^es/)
  })

  test("the header and drawer navigation stay prefixed", async ({ page }) => {
    await page.goto("/es/about")
    await dismissConsent(page)
    for (const name of [/inicio|home/i, /servicios/i, /contacto/i]) {
      const link = page.getByRole("link", { name }).first()
      if (await link.count()) {
        await expect(link).toHaveAttribute("href", /^\/es(\/|$)/)
      }
    }
  })

  test("operator links are NOT prefixed — those routes are not mirrored", async ({ page }) => {
    await page.goto("/es/checkout")
    await dismissConsent(page)
    const operator = await page.evaluate(() =>
      [...document.querySelectorAll('a[href*="/dashboard"], a[href*="/admin"]')]
        .map((a) => a.getAttribute("href")))
    for (const href of operator) {
      expect(href, "a prefixed operator link would 404 on reload").not.toMatch(/^\/es\//)
    }
  })
})

test.describe("the language redirect keeps campaign parameters", () => {
  test.use({ locale: "es-MX" })

  test("/?utm_source=x survives the hop to /es", async ({ page }) => {
    await page.goto("/?utm_source=newsletter&utm_campaign=spring")
    await expect(page).toHaveURL(/\/es\?.*utm_source=newsletter/)
    await expect(page).toHaveURL(/utm_campaign=spring/)
  })

  test("a hash survives too", async ({ page }) => {
    await page.goto("/?utm_source=x#pricing")
    await expect(page).toHaveURL(/#pricing/)
  })
})

test.describe("an English visitor is untouched", () => {
  test.use({ locale: "en-US" })

  test("no redirect, and links stay unprefixed", async ({ page }) => {
    await page.goto("/")
    await dismissConsent(page)
    await expect(page).toHaveURL(/\/$/)
    await expect(page.locator("html")).toHaveAttribute("lang", /^en/)
    const prefixed = await page.evaluate(() =>
      [...document.querySelectorAll('a[href^="/es"]')].map((a) => a.getAttribute("href")))
    // The language switcher is the one legitimate /es link on an English page.
    expect(prefixed.length).toBeLessThanOrEqual(2)
  })
})
