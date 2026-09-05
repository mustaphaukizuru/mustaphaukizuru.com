/**
 * The scroll narratives still tell their story, without gsap (T4-3).
 *
 * Three sections were driven by a lazily-loaded 114 KB gsap + ScrollTrigger
 * bundle to do what Framer's useScroll and whileInView already do. Porting
 * animation is the kind of change that looks fine in a diff and is broken on
 * screen, and the one thing a reviewer cannot check by reading is whether an
 * element that starts at opacity 0 ever reaches 1.
 *
 * So these scroll a real browser and read computed styles at each stage. The
 * assertions are deliberately about VISIBILITY rather than about easing
 * curves: the failure that matters is content a visitor can never see.
 */
import { expect, test } from "@playwright/test"

const DESKTOP = { width: 1280, height: 900 }
const MOBILE = { width: 390, height: 844 }

/**
 * Scroll to a point measured from the top of the process track.
 *
 * Relative to the TRACK, not to the page. The first version of this sampled
 * fractions of the document and found nothing mid-reveal — the homepage is
 * 10,000 px tall and the 1,980 px track starts two-thirds of the way down, so
 * every sample landed outside it. A page-fraction assertion would also break
 * the next time a section is added above.
 */
async function scrollIntoTrack(page, offset) {
  await page.evaluate((px) => {
    const track = document.querySelector("[data-step]")?.closest("section")
    const top = track ? track.getBoundingClientRect().top + window.scrollY : 0
    window.scrollTo(0, top + px)
  }, offset)
  await page.waitForTimeout(300)
}

/** Scroll to a fraction of the whole page and let the frame settle. */
async function scrollTo(page, fraction) {
  await page.evaluate((f) => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    window.scrollTo(0, max * f)
  }, fraction)
  await page.waitForTimeout(400)
}

const consentAway = async (page) => {
  const accept = page.getByRole("button", { name: /^(accept all|aceptar todas)$/i })
  await accept.waitFor({ state: "visible", timeout: 10_000 })
  await accept.click()
  await accept.waitFor({ state: "detached", timeout: 10_000 })
}

const opacityOf = (locator) => locator.evaluate((el) => Number(getComputedStyle(el).opacity))

test.describe("home · the process narrative", () => {
  test("gsap is not loaded, on any viewport", async ({ page }) => {
    const chunks = []
    page.on("request", (r) => { if (/gsap|ScrollTrigger/i.test(r.url())) chunks.push(r.url()) })
    await page.setViewportSize(DESKTOP)
    await page.goto("/")
    await consentAway(page)
    await scrollTo(page, 0.5)
    expect(chunks).toEqual([])
    // And the global it used to install is gone with it.
    expect(await page.evaluate(() => typeof window.gsap)).toBe("undefined")
  })

  test("desktop · the steps reveal as the track scrolls, and all three arrive", async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto("/")
    await consentAway(page)

    const steps = page.locator("[data-step]")
    await expect(steps).toHaveCount(3)
    await steps.first().scrollIntoViewIfNeeded()

    // At the top of the runway nothing has been revealed yet.
    await scrollIntoTrack(page, 0)
    expect(await opacityOf(steps.nth(0))).toBeLessThan(0.1)

    // The steps arrive IN ORDER as the track scrolls. That ordering is the
    // narrative — a fade-in that happens to all three at once would pass a
    // naive "is it visible" check and be a different section.
    await scrollIntoTrack(page, 400)
    const early = await Promise.all([0, 1, 2].map((i) => opacityOf(steps.nth(i))))
    expect(early[0]).toBeGreaterThan(early[1])
    expect(early[1]).toBeGreaterThanOrEqual(early[2])
    expect(
      early.some((o) => o > 0 && o < 1),
      "no step was mid-reveal — the scroll link is not driving anything",
    ).toBe(true)

    // And by the end of the runway every step is fully there. A card stuck at
    // 0 is content the visitor never sees, which is the failure this is for.
    await scrollIntoTrack(page, 1100)
    for (let i = 0; i < 3; i += 1) {
      expect(await opacityOf(steps.nth(i))).toBeGreaterThan(0.95)
    }
  })

  test("mobile · every step is visible, with no runway at all", async ({ page }) => {
    // The track's 220vh is an `lg:` class, so on a phone there is no runway
    // and the scroll link has nothing to map. The cards must not depend on it.
    await page.setViewportSize(MOBILE)
    await page.goto("/")
    await consentAway(page)

    const steps = page.locator("[data-step]")
    await steps.nth(2).scrollIntoViewIfNeeded()
    await page.waitForTimeout(700)
    for (let i = 0; i < 3; i += 1) {
      expect(await opacityOf(steps.nth(i))).toBeGreaterThan(0.95)
    }
  })

  test("reduced motion · everything is simply there", async ({ page }) => {
    // The contract the old hook had and the new code keeps: the DOM is
    // authored in its final state, so nothing has to animate for the page to
    // be complete.
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.setViewportSize(DESKTOP)
    await page.goto("/")
    await consentAway(page)

    const steps = page.locator("[data-step]")
    await steps.first().scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)
    for (let i = 0; i < 3; i += 1) {
      expect(await opacityOf(steps.nth(i))).toBe(1)
    }
    // The connector line too — it was scaleX(0) under gsap until scrolled.
    const line = page.locator("[data-progress-line]")
    const transform = await line.evaluate((el) => getComputedStyle(el).transform)
    expect(transform === "none" || !transform.includes("matrix(0")).toBe(true)
  })
})

test.describe("case study · outcomes and approach", () => {
  /**
   * A case study with the two things under test, stubbed at the network
   * layer.
   *
   * The first version of this walked to a real /projects/:slug, and skipped
   * on every run — the preview build has no seeded portfolio, so two of the
   * three ports were going untested while reporting green. Stubbing is what
   * makes them actually run, and it also pins the figures the count-up has to
   * land on.
   */
  const PROJECT = {
    id: "p1",
    slug: "colegio-vista",
    title: "Colegio Vista",
    shortDescription: "Payroll migration",
    coverImage: null,
    gallery: [],
    caseStudy: {
      serviceSlug: null,
      context: "240 staff records on a system nobody could export from.",
      problem: "Payroll took four days a month.",
      approach: [
        { title: "Audit", body: "Read every field of the old schema." },
        { title: "Migrate", body: "Moved the records in one night." },
        { title: "Verify", body: "Reconciled against the last three runs." },
      ],
      outcomes: [
        { value: "-40%", label: "time per payroll run" },
        { value: "1,240", label: "records migrated" },
        { value: "99.8%", label: "reconciled first pass" },
      ],
      stack: [],
    },
  }

  const stub = (page) => Promise.all([
    page.route("**/api/**/portfolio/colegio-vista", (r) => r.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ success: true, data: PROJECT }),
    })),
    page.route("**/api/**/portfolio*", (r) => r.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ success: true, data: [PROJECT], total: 1 }),
    })),
  ])

  test("the outcome figures end on their real values, not on a zero", async ({ page }) => {
    // The count-up starts at 0 and tweens to the figure. If it never runs — or
    // runs and never lands — the page shows a WRONG NUMBER, which is a great
    // deal worse than showing no animation.
    await page.setViewportSize(DESKTOP)
    await stub(page)
    await page.goto("/projects/colegio-vista")
    await consentAway(page)

    const counts = page.locator("[data-count]")
    await expect(counts).toHaveCount(3)
    await counts.first().scrollIntoViewIfNeeded()
    await page.waitForTimeout(2400)

    for (let i = 0; i < 3; i += 1) {
      const el = counts.nth(i)
      const target = Number(await el.getAttribute("data-count"))
      const shown = Number((await el.textContent())?.replace(/,/g, ""))
      expect(shown).toBeCloseTo(target, 2)
    }
    // And the grouped one keeps its separator rather than reading "1240".
    await expect(counts.nth(1)).toHaveText("1,240")
  })

  test("the stat cards and approach steps are readable once scrolled to", async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await stub(page)
    await page.goto("/projects/colegio-vista")
    await consentAway(page)

    const stats = page.locator("[data-stat]")
    await expect(stats).toHaveCount(3)
    await stats.first().scrollIntoViewIfNeeded()
    await page.waitForTimeout(1400)
    for (let i = 0; i < 3; i += 1) {
      expect(await opacityOf(stats.nth(i))).toBeGreaterThan(0.95)
    }

    const steps = page.locator("[data-approach-step]")
    await expect(steps).toHaveCount(3)
    await steps.last().scrollIntoViewIfNeeded()
    await page.waitForTimeout(1400)
    for (let i = 0; i < 3; i += 1) {
      expect(await opacityOf(steps.nth(i).locator("[data-approach-body]"))).toBeGreaterThan(0.95)
    }
  })

  test("reduced motion · the real figures are there from the first frame", async ({ page }) => {
    // The contract: no count-up at all, and the DOM already holds the number.
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.setViewportSize(DESKTOP)
    await stub(page)
    await page.goto("/projects/colegio-vista")
    await consentAway(page)

    const counts = page.locator("[data-count]")
    await counts.first().scrollIntoViewIfNeeded()
    // No wait: it must already be right.
    await expect(counts.nth(1)).toHaveText("1,240")
    expect(await opacityOf(page.locator("[data-stat]").first())).toBe(1)
  })
})
