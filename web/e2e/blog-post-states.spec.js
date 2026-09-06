// @ts-check
import { test, expect } from "@playwright/test"

/**
 * The three states a blog post URL can be in (U2).
 *
 * `BlogPostPage` resolved a post as `apiPost || staticPost` and then did:
 *
 *     if (!post) return <Navigate to="/blog" replace />
 *
 * which collapsed two different situations into one wrong answer.
 *
 *   A MISSING POST WAS A SILENT REDIRECT. A reader following an old or
 *   mistyped link landed on the index with no explanation, and a crawler was
 *   told 200 for a page that does not exist — a soft 404. The app already
 *   ships the right surface: ErrorPage's own docblock offers itself for
 *   inline use, it carries the NotFoundArt illustration, and it sets
 *   robots=noindex.
 *
 *   AND "NOT LOADED YET" LOOKED IDENTICAL TO "NOT FOUND". Posts that exist
 *   only in the database — anything published through the admin CMS after
 *   the static data file was written — have no static fallback, so `post` is
 *   null on the first render while the fetch is in flight. The guard fired
 *   before the answer arrived. It happened not to bite in practice, because
 *   the fetch usually resolves before Navigate's effect commits, but that is
 *   a race and not a design: on a slow connection it bounces a reader off a
 *   perfectly good post.
 *
 * All three assertions are on the URL as much as the content, because the
 * defect was a navigation, not a rendering.
 */

const BASE = "http://localhost:4173"

async function ready(page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("mu_cookie_consent_v1", JSON.stringify({
      version: 1, necessary: true, analytics: true, marketing: false, at: Date.now(),
    }))
  })
}

test("a real post renders, with no skeleton left behind", async ({ page }) => {
  // Static data carries this one, so it is available on the first render and
  // must NOT flash a loading state.
  await ready(page)
  await page.goto("/blog/edtech-that-actually-helps-teachers", { waitUntil: "networkidle" })
  await page.waitForTimeout(1200)

  expect(new URL(page.url()).pathname).toBe("/blog/edtech-that-actually-helps-teachers")
  await expect(page.locator("h1")).toContainText(/EdTech/i)
  expect(await page.locator('[role="status"][aria-busy="true"]').count()).toBe(0)
})

test("a missing post is a 404 on its own URL, not a bounce to the index", async ({ page }) => {
  await ready(page)
  // 404 from the API, which is what an unknown slug actually gets.
  await page.route("**/api/**", (route) => route.fulfill({
    status: 404, contentType: "application/json", body: JSON.stringify({ success: false }),
  }))
  await page.goto("/blog/totally-made-up-slug", { waitUntil: "commit" })
  await page.waitForTimeout(2600)

  // The URL is the assertion that matters: it used to become /blog.
  expect(new URL(page.url()).pathname).toBe("/blog/totally-made-up-slug")
  await expect(page.locator("h1")).toContainText(/not here|no está aquí/i)
  // ErrorPage sets this itself, which is the other half of a soft 404.
  const robots = await page.evaluate(() =>
    [...document.querySelectorAll('meta[name="robots"]')].map((m) => m.content))
  expect(robots.some((r) => r.includes("noindex"))).toBe(true)
})

test("a slow lookup shows a skeleton and keeps the reader on the post URL", async ({ page }) => {
  // The case that made the old guard a race: no static fallback, fetch still
  // in flight. A terminal state here throws the reader off a good post.
  await ready(page)
  await page.route("**/api/**", (route) => {
    setTimeout(() => route.fulfill({
      status: 200, contentType: "application/json", body: JSON.stringify({ success: true }),
    }), 5000)
  })
  await page.goto("/blog/some-db-only-post", { waitUntil: "commit" })
  await page.waitForTimeout(1500)

  // Still here, and showing a skeleton rather than a verdict.
  expect(new URL(page.url()).pathname).toBe("/blog/some-db-only-post")
  expect(await page.locator('[role="status"][aria-busy="true"]').count()).toBe(1)
  expect(await page.locator("h1").count()).toBe(0)
})
