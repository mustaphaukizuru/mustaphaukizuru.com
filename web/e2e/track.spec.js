/**
 * The public tracking page renders, and shows only what it may (T5-5).
 *
 * Two things are worth an e2e here and neither can be caught by a unit test.
 *
 * The first is that the page renders at all. It is the site's one anonymous
 * read of a live client engagement, it is reached by typing a code rather
 * than by clicking anything, and nothing else in the app links to a real
 * one — which is exactly the shape of the self-audit bug: a surface nobody
 * walks, quietly broken behind an error boundary. `dashboard` also became a
 * route-scoped namespace in this change, so this page now has to fetch its
 * own strings before it paints; if that goes wrong it renders raw keys, and
 * the assertions below are on real sentences.
 *
 * The second is what does NOT appear. ADR 0006 is a promise about a page
 * anyone can open with a forwarded link. The serializer is tested in Jest;
 * this checks the rendered DOM, because a page is free to fetch something
 * else and print it.
 */
import { expect, test } from "@playwright/test"

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
})

const CODE = "MU-7K4C-9XQF"

/** Exactly the shape projectTrackingService.serializePublicProject returns. */
const PROJECT = {
  reference: CODE,
  status: "in_progress",
  percentComplete: 40,
  startDate: "2026-07-01T00:00:00.000Z",
  dueDate: "2026-10-15T00:00:00.000Z",
  isClosed: false,
  milestones: [
    { title: "Discovery workshop", status: "completed", completedAt: "2026-07-10T00:00:00.000Z" },
    { title: "Information architecture", status: "in_progress", completedAt: null },
  ],
  events: [
    { type: "project.started", title: "Work started", createdAt: "2026-07-01T09:00:00.000Z" },
    { type: "milestone.approved", title: "Milestone approved", createdAt: "2026-07-10T16:30:00.000Z" },
  ],
  openRequestCount: 2,
  links: { portal: "/portal", dashboard: "/dashboard/projects" },
}

const stubTrack = (page, body = PROJECT, status = 200) =>
  page.route(`**/api/v1/track/${CODE}`, (route) => route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(status === 200
      ? { success: true, data: body }
      : { success: false, code: "PROJECT_NOT_FOUND", message: "No project matches that code." }),
  }))

const consentAway = async (page) => {
  const accept = page.getByRole("button", { name: /^(accept all|aceptar todas)$/i })
  await accept.waitFor({ state: "visible", timeout: 10_000 })
  await accept.click()
  await accept.waitFor({ state: "detached", timeout: 10_000 })
}

const LOCALES = [
  { path: "/track", started: /Work started/, waiting: /2 documents are waiting on you/i, portal: /Client portal/i, missing: /No project matches that code/i },
  { path: "/es/track", started: /Work started/, waiting: /Faltan 2 documentos de tu parte/i, portal: /Portal de cliente/i, missing: /Ning[uú]n proyecto coincide con ese c[oó]digo/i },
]

for (const locale of LOCALES) {
  test(`${locale.path}/:code renders the frame`, async ({ page }) => {
    await stubTrack(page)
    // The preview build points at a dev API that is not running, so its
    // analytics beacon fails CORS on every page. That is an environment
    // artifact, not this page: what is being watched for is a render error.
    const errors = []
    page.on("console", (msg) => {
      const text = msg.text()
      if (msg.type() !== "error") return
      if (/analytics|CORS|ERR_FAILED|Failed to load resource/i.test(text)) return
      errors.push(text)
    })

    await page.goto(`${locale.path}/${CODE}`)
    await consentAway(page)

    // The code itself, the phase strip's progress, a milestone, an event
    // from the timeline, and the count of what is outstanding.
    await expect(page.getByText(CODE, { exact: true }).first()).toBeVisible()
    await expect(page.getByText("40%")).toBeVisible()
    await expect(page.getByText("Discovery workshop")).toBeVisible()
    await expect(page.getByText(locale.started).first()).toBeVisible()
    await expect(page.getByText(locale.waiting)).toBeVisible()
    await expect(page.getByText(locale.portal).first()).toBeVisible()

    // Raw i18n keys would mean the lazily-fetched namespace never landed.
    await expect(page.locator("body")).not.toContainText("track.title")
    expect(errors).toEqual([])
  })

  test(`${locale.path} takes a code and goes to the result`, async ({ page }) => {
    await stubTrack(page)
    await page.goto(locale.path)
    await consentAway(page)

    // Typed without hyphens and in lowercase, the way it is actually done.
    // By its label. getByRole("textbox").first() finds the FOOTER
    // newsletter input on this page, which is a nicely typo-shaped bug for
    // a spec to have.
    const field = page.getByLabel(/tracking code|c[oó]digo de seguimiento/i)
    await field.fill("")
    await field.pressSequentially("mu7k4c9xqf")
    await expect(field).toHaveValue(CODE)

    await page.getByRole("button", { name: /^(track|rastrear)$/i }).click()
    await expect(page).toHaveURL(new RegExp(`${locale.path}/${CODE}$`))
    await expect(page.getByText("40%")).toBeVisible()
  })

  test(`${locale.path} says nothing useful about an unknown code`, async ({ page }) => {
    await stubTrack(page, null, 404)
    await page.goto(`${locale.path}/${CODE}`)
    await consentAway(page)
    await expect(page.getByText(locale.missing)).toBeVisible()
    // And the field is back, so the reader can correct a typo without
    // navigating anywhere.
    await expect(page.getByLabel(/tracking code|c[oó]digo de seguimiento/i)).toBeVisible()
  })
}

test("the rendered page carries no money, no names and no file names", async ({ page }) => {
  // The serializer cannot return these (Jest covers that). This asserts the
  // PAGE does not go and find them somewhere else — the failure mode of a
  // later change that adds "one more useful thing" to an anonymous surface.
  await stubTrack(page)
  await page.goto(`/track/${CODE}`)
  await consentAway(page)

  const body = (await page.locator("body").innerText()).toLowerCase()
  for (const forbidden of ["@", "mxn", "usd", "$", "invoice", ".pdf", ".docx"]) {
    expect(body, `"${forbidden}" must not appear on the anonymous tracking page`)
      .not.toContain(forbidden)
  }
})

test("it is not offered to crawlers", async ({ page }) => {
  await stubTrack(page)
  await page.goto(`/track/${CODE}`)
  // Helmet APPENDS its tag after React mounts rather than rewriting the one
  // public/index.html ships, so the head ends up carrying both and the
  // assertion is on the last. Conflicting directives resolve to the most
  // restrictive at every major engine — but the copy a non-JS crawler reads
  // is still index,follow, which is why robots.txt carries the Disallow
  // asserted below.
  await expect(page.locator('meta[name="robots"]').last())
    .toHaveAttribute("content", /noindex/, { timeout: 15_000 })
})

test("robots.txt keeps a code out of a crawl that never runs JavaScript", async ({ request }) => {
  const body = await (await request.get("/robots.txt")).text()
  expect(body).toContain("Disallow: /track/")
  expect(body).toContain("Disallow: /es/track/")
})
