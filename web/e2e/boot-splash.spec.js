// @ts-check
import { test, expect } from "@playwright/test"

/**
 * The inline boot splash (U3).
 *
 * WHY IT EXISTS. Measured under Lighthouse-mobile throttling — 4x CPU, slow
 * 4G — first contentful paint was 4.10-4.22s on every page:
 *
 *     /          4220ms        /store     4112ms
 *     /about     4096ms        /contact   4100ms
 *     /services  4096ms
 *
 * Flat across five completely different pages, which is the signature of a
 * bundle-gated paint rather than page content. The body was
 * `<div id="root"></div>` and nothing else, and `main.jsx` does not call
 * render() until `i18nReady` resolves — so ~338 KB of gzipped JavaScript had
 * to arrive, parse and execute before the first pixel. On /services and
 * /contact the largest-contentful-paint ELEMENT was the React splash's own
 * rotating tagline, which says the same thing from the other direction.
 *
 * After: 1584-1612ms on four pages and 2316ms on the homepage, all inside
 * the 3000ms budget. The floor is now the 41 KB gzipped render-blocking
 * stylesheet, not the JavaScript.
 *
 * The no-JavaScript case below is the whole point, and it is the one thing a
 * normal Playwright run cannot show you: with scripting on, React replaces
 * the splash so fast that a passing test proves nothing about whether the
 * splash was ever painted from HTML alone.
 */

test.describe("with JavaScript disabled", () => {
  test.use({ javaScriptEnabled: false })

  test("the brand splash paints from HTML alone", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" })

    const boot = page.locator("#boot")
    await expect(boot).toBeVisible()
    await expect(boot).toContainText("Mustapha Ukizuru")

    // It has to COVER the screen, or it is a decoration rather than a first
    // paint. Asserted as the two properties that make that true plus a
    // coverage ratio, rather than an exact pixel width: an exact comparison
    // was off by 10px in the runner and matched exactly in a standalone
    // probe of the same build, which is a scrollbar-width difference and not
    // something worth encoding in an assertion.
    const geom = await page.evaluate(() => {
      const el = document.getElementById("boot")
      const cs = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      return {
        position: cs.position,
        inset: [cs.top, cs.right, cs.bottom, cs.left].join(" "),
        coverW: r.width / document.documentElement.clientWidth,
        coverH: r.height / document.documentElement.clientHeight,
      }
    })
    expect(geom.position).toBe("fixed")
    expect(geom.inset).toBe("0px 0px 0px 0px")
    expect(geom.coverW).toBeGreaterThan(0.98)
    expect(geom.coverH).toBeGreaterThan(0.98)
  })

  test("it draws itself with no asset of its own", async ({ page }) => {
    // The first version of this asserted "no requests at all besides the
    // stylesheet" and failed on Sora and JetBrainsMono — which are the
    // APP's fonts, preloaded from <head>, and nothing to do with the
    // splash. The claim worth pinning is narrower and is the one that keeps
    // the splash fast: it renders from inline markup, inline CSS, an inline
    // SVG and a system font stack, so no request it triggers can delay it.
    await page.goto("/", { waitUntil: "domcontentloaded" })

    const boot = await page.evaluate(() => {
      const el = document.getElementById("boot")
      const name = el.querySelector(".boot-name")
      return {
        font: getComputedStyle(name).fontFamily,
        imgs: el.querySelectorAll("img").length,
        // background-image is allowed (it is a gradient), a url() is not.
        url: /url\(/.test(getComputedStyle(el).backgroundImage),
      }
    })
    expect(boot.font).toMatch(/system-ui|-apple-system|Segoe UI/i)
    expect(boot.font).not.toMatch(/Sora|JetBrains/i)
    expect(boot.imgs).toBe(0)
    expect(boot.url).toBe(false)
  })
})

test("React replaces the splash, and does not leave two of them", async ({ page }) => {
  // The splash sits INSIDE #root so createRoot().render() removes it as it
  // paints — no timer, no cleanup, and no window where the app and the
  // splash are both on screen.
  await page.goto("/", { waitUntil: "networkidle" })
  await page.waitForTimeout(1200)

  expect(await page.locator("#boot").count()).toBe(0)
  await expect(page.getByRole("navigation").first()).toBeVisible()
})

test("the app is visible as soon as it renders, not on a timer", async ({ page }) => {
  // The `appReady` gate held the whole app at `opacity: 0` for ~1.6s after
  // React had already rendered it, on every full page load. Nothing in the
  // tree may do that any more.
  await page.goto("/", { waitUntil: "networkidle" })
  await page.waitForTimeout(600)

  const hidden = await page.evaluate(() => {
    const out = []
    for (const el of document.querySelectorAll("body > div, #root > div")) {
      const cs = getComputedStyle(el)
      if (Number(cs.opacity) === 0 && el.getBoundingClientRect().height > 100) {
        out.push(el.tagName.toLowerCase() + "." + String(el.className).split(" ")[0])
      }
    }
    return out
  })
  expect(hidden).toEqual([])
})
