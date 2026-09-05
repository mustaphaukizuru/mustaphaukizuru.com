/**
 * The /about stat strip shows measurements, or nothing (T4-4).
 *
 * The strip exists to be checkable by a stranger, which makes its failure
 * modes the whole design: a tile with no number must not render as a zero, a
 * strip with no tiles must not render as an empty heading, and the date must
 * be there whenever a number is. Numbers without a date are the ones that
 * quietly become untrue.
 *
 * Each state is produced by stubbing the static file, which is also the only
 * way to see the empty ones on a machine where the numbers exist.
 */
import { expect, test } from "@playwright/test"

const consentAway = async (page) => {
  const accept = page.getByRole("button", { name: /^(accept all|aceptar todas)$/i })
  await accept.waitFor({ state: "visible", timeout: 10_000 })
  await accept.click()
  await accept.waitFor({ state: "detached", timeout: 10_000 })
}

/** Serve a given payload — or a 404 — for the stats file. */
const stubStats = (page, payload) =>
  page.route("**/engineering-stats.json", (route) => (payload === null
    ? route.fulfill({ status: 404, body: "" })
    : route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload),
    })))

const strip = (page) => page.locator("[data-engineering-stats]")

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
})

test("a full set renders six tiles and the date", async ({ page }) => {
  await stubStats(page, {
    generatedAt: "2026-09-04T00:00:00.000Z",
    tests: 1566,
    suites: 115,
    coverage: 62,
    lighthouse: { performance: 94, accessibility: 100, "best-practices": 96, seo: 100, urls: 8 },
  })
  await page.goto("/about")
  await consentAway(page)

  await strip(page).scrollIntoViewIfNeeded()
  await expect(strip(page)).toBeVisible()
  // Thousands separator: "1566" reads as a version number.
  await expect(strip(page)).toContainText("1,566")
  await expect(strip(page)).toContainText("62%")
  await expect(strip(page)).toContainText("94")
  await expect(strip(page)).toContainText("September 4, 2026")
  await expect(page.locator("[data-stat-tile]")).toHaveCount(6)
})

test("a missing figure is ABSENT, not a zero", async ({ page }) => {
  // The failure this guards: "0%" beside the word coverage is a false claim
  // about the work, and worse than saying nothing.
  await stubStats(page, { generatedAt: "2026-09-04T00:00:00.000Z", tests: 1566, suites: 115 })
  await page.goto("/about")
  await consentAway(page)

  await strip(page).scrollIntoViewIfNeeded()

  // Asserted on the TILES, not on the strip's text: the intro copy mentions
  // "the coverage report", so a text search finds the word whether or not a
  // number was rendered — which is how the first version of this passed on
  // prose. The tiles carry their own names for exactly this reason.
  await expect(page.locator('[data-stat-tile="tests"]')).toHaveCount(1)
  await expect(page.locator('[data-stat-tile="coverage"]')).toHaveCount(0)
  await expect(page.locator('[data-stat-tile="performance"]')).toHaveCount(0)
  await expect(strip(page)).toContainText("1,566")
  expect(await strip(page).innerText()).not.toContain("0%")
})

test("no numbers at all means no strip, not an empty heading", async ({ page }) => {
  await stubStats(page, { generatedAt: "2026-09-04T00:00:00.000Z" })
  await page.goto("/about")
  await consentAway(page)
  await expect(strip(page)).toHaveCount(0)
})

test("a missing file is an ordinary answer, and the page is fine without it", async ({ page }) => {
  // This is the state a fresh clone is in before anyone runs the generator.
  const errors = []
  page.on("pageerror", (e) => errors.push(e.message))
  await stubStats(page, null)
  await page.goto("/about")
  await consentAway(page)

  await expect(strip(page)).toHaveCount(0)
  // The rest of /about still renders — the strip failing must not take a
  // page with it.
  await expect(page.locator("#clients-heading")).toBeAttached()
  expect(errors).toEqual([])
})

test("the shipped file is real, and its numbers are plausible", async ({ page }) => {
  // No stub: this reads what is actually committed. A file that is present
  // but says 0 tests, or that was measured in the future, is the kind of
  // thing nobody notices until a visitor does.
  const res = await page.request.get("/engineering-stats.json")
  expect(res.status()).toBe(200)
  const stats = await res.json()

  expect(new Date(stats.generatedAt).getTime()).toBeLessThanOrEqual(Date.now())
  if ("tests" in stats) expect(stats.tests).toBeGreaterThan(100)
  if ("coverage" in stats) {
    expect(stats.coverage).toBeGreaterThan(0)
    expect(stats.coverage).toBeLessThanOrEqual(100)
  }
  for (const key of ["performance", "accessibility", "best-practices", "seo"]) {
    if (stats.lighthouse && key in stats.lighthouse) {
      expect(stats.lighthouse[key]).toBeGreaterThanOrEqual(0)
      expect(stats.lighthouse[key]).toBeLessThanOrEqual(100)
    }
  }
})

test("it renders in Spanish too", async ({ page }) => {
  await stubStats(page, { generatedAt: "2026-09-04T00:00:00.000Z", tests: 1566, coverage: 62 })
  await page.goto("/es/about")
  await consentAway(page)
  await strip(page).scrollIntoViewIfNeeded()
  await expect(strip(page)).toContainText(/Medido, no prometido/i)
  await expect(strip(page)).toContainText(/cobertura de l[ií]neas/i)
})
