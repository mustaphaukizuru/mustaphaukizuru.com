// @ts-check
import { test, expect } from "@playwright/test"

/**
 * Project stages (components/portfolio/ProjectShowcase + ui/ContainerScroll).
 *
 * Every project on the site is presented as a screen that tilts flat as the
 * reader scrolls into it. Two things about that are easy to break silently
 * and impossible to see in a unit test:
 *
 *   1. The scroll offset. The upstream component's default offset only works
 *      when the track is taller than the viewport; get it wrong and the frame
 *      simply stays tilted forever, which still renders and still passes a
 *      snapshot. So this asserts the transform actually resolves to flat once
 *      a stage is centred, and is NOT flat while it is entering.
 *   2. prefers-reduced-motion. The tilt is decorative; a reader who asked for
 *      no motion must get a frame with no transform at all.
 *
 * API traffic is stubbed at the network layer (see checkout.spec.js for why)
 * so the suite never touches the production database.
 */

const BASE = "http://localhost:4173"
const STAGE = "article[aria-labelledby^='showcase-']"
const FRAME = `${STAGE} [style*='perspective'] > div:nth-child(2)`

test.use({ baseURL: BASE })

const project = (i) => ({
  id: `p${i}`,
  slug: `project-${i}`,
  title: `Ledger Rebuild ${i}`,
  shortDescription: "A billing monolith, rewritten without a freeze window.",
  category: "Platform",
  year: 2025,
  coverImage: `/images/stage-cover-${i}.jpg`,
  outcomeLine: "-40% deploy time",
  caseStudy: {
    serviceSlug: "cloud-architecture-migration",
    problem: "Releases took a nine-hour window.",
    outcomes: [{ value: "-40%", label: "deploy time" }],
    stack: ["Node", "MySQL"],
  },
})

async function stubApi(page) {
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url())
    const json = /\/portfolio\/[^/?]+$/.test(url.pathname)
      ? { success: true, data: project(1) }                      // GET /portfolio/:slug
      : url.pathname.includes("/portfolio")
        ? { success: true, data: [1, 2, 3].map(project), pagination: { page: 1, totalPages: 1 }, categories: [] }
        : { success: true, data: [], items: [], total: 0 }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(json) })
  })
  // The covers are invented, so serve a real decodable image for them.
  await page.route("**/images/stage-cover-*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="900"><rect width="1400" height="900" fill="#5D3FD3"/></svg>',
    }))
}

/** The frame's own transform, or "none" when it is sitting flat. */
const frameTransform = (page, index) =>
  page.locator(FRAME).nth(index).evaluate((el) => getComputedStyle(el).transform)

test.describe("project stages", () => {
  test.beforeEach(async ({ page }) => { await stubApi(page) })

  test("every project on /portfolio is a stage, and the tilt resolves flat", async ({ page }) => {
    await page.goto("/portfolio")
    await expect(page.locator(STAGE)).toHaveCount(3)

    // Entering from below: the frame is mid-tilt, so it carries a 3D matrix.
    await page.locator(STAGE).nth(1).scrollIntoViewIfNeeded()
    await page.evaluate(() => window.scrollBy(0, -350))
    await expect.poll(() => frameTransform(page, 1)).toContain("matrix3d")

    // Centred: the tilt has finished and the transform collapses to none.
    await page.locator(STAGE).nth(1).evaluate((el) => el.scrollIntoView({ block: "center" }))
    await expect.poll(() => frameTransform(page, 1)).toBe("none")
  })

  test("a stage names its project and links to the case study", async ({ page }) => {
    await page.goto("/portfolio")
    const stage = page.locator(STAGE).first()

    // The <article> takes its accessible name from the project heading.
    await expect(stage.getByRole("heading", { name: "Ledger Rebuild 1" })).toBeVisible()
    await expect(stage.locator("a[href='/projects/project-1']").first()).toBeVisible()
    // The cover repeats that link for the mouse — it must not be a tab stop.
    await expect(stage.locator("a[aria-hidden='true']")).toHaveAttribute("tabindex", "-1")
  })

  test("prefers-reduced-motion leaves every frame untransformed", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/portfolio")
    await page.locator(STAGE).nth(1).evaluate((el) => el.scrollIntoView({ block: "center" }))

    const transforms = await page.locator(FRAME).evaluateAll((els) =>
      els.map((el) => getComputedStyle(el).transform))
    expect(transforms.length).toBeGreaterThan(0)
    expect(transforms.every((t) => t === "none")).toBe(true)
  })

  test("paging returns the reader to the top of the list", async ({ page }) => {
    // Two pages, so the pager renders.
    await page.route("**/api/**", (route) => {
      const url = new URL(route.request().url())
      const json = url.pathname.includes("/portfolio")
        ? { success: true, data: [1, 2, 3].map(project), pagination: { page: Number(url.searchParams.get("page")) || 1, totalPages: 2 }, categories: [] }
        : { success: true, data: [], items: [], total: 0 }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(json) })
    })
    await page.goto("/portfolio")
    await expect(page.locator(STAGE)).toHaveCount(3)

    // A stage is most of a screen tall, so the pager sits several screens down.
    const pager = page.getByRole("button", { name: /next/i })
    await pager.scrollIntoViewIfNeeded()
    const before = await page.evaluate(() => window.scrollY)
    expect(before).toBeGreaterThan(1000)

    await pager.click()
    // Back at the first result of the new page, not stranded at the buttons.
    const listTop = await page.locator("#portfolio-work-heading").evaluate((el) =>
      el.getBoundingClientRect().top + window.scrollY)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(listTop + 120)
  })

  test("the detail hero wears the same frame as the stage it came from", async ({ page }) => {
    await page.goto("/projects/project-1")
    // Same bezel chrome (STAGE_FRAME_CLASS), held flat above the fold.
    const frame = page.locator("[class*='rounded-[30px]']").first()
    await expect(frame).toBeVisible()
    await expect(frame).toHaveCSS("transform", "none")
  })
})
