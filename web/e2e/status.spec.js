/**
 * The status page answers when the API does not (T1-9).
 *
 * That is the entire point of it, and it is the one condition that cannot be
 * checked by opening the page on a working machine. On 25 August production
 * served static pages normally while every database-backed route hung — the
 * site LOOKED alive — so the page has to survive an API that hangs, an API
 * that 500s, and an API that answers 200 while reporting its own database
 * down.
 *
 * Each case is stubbed at the network layer, which is also the only way to
 * produce them on demand.
 */
import { expect, test } from "@playwright/test"

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
})

const HEALTHY = {
  status: "ok", uptime: 1200, commit: "abc1234",
  database: "ok", prismaGenerate: "ok", timestamp: new Date().toISOString(),
}

const stub = (page, { health, jobs } = {}) => Promise.all([
  page.route("**/api/v1/health", (route) => (health === "hang"
    ? route.abort("timedout")
    : route.fulfill({
      status: health?.status ?? 200,
      contentType: "application/json",
      body: JSON.stringify(health?.body ?? HEALTHY),
    }))),
  page.route("**/api/v1/health/jobs", (route) => route.fulfill({
    status: jobs?.status ?? 200,
    contentType: "application/json",
    body: JSON.stringify(jobs?.body ?? { status: "ok", stale: 0, jobs: {} }),
  })),
])

const consentAway = async (page) => {
  const accept = page.getByRole("button", { name: /^(accept all|aceptar todas)$/i })
  await accept.waitFor({ state: "visible", timeout: 10_000 })
  await accept.click()
  await accept.waitFor({ state: "detached", timeout: 10_000 })
}

test("everything green says so, and names the build", async ({ page }) => {
  await stub(page)
  await page.goto("/status")
  await consentAway(page)
  await expect(page.getByText(/Everything is working/i)).toBeVisible()
  await expect(page.getByText("Operational").first()).toBeVisible()
  // The commit is what turns "it is up" into "the fix is deployed".
  await expect(page.getByText(/build abc1234/)).toBeVisible()
})

test("an API that never answers is reported, not spun forever", async ({ page }) => {
  // The failure mode the page exists for. Without the abort timeout the
  // tiles would sit on "Checking" and say less than nothing.
  await stub(page, { health: "hang", jobs: { status: 0 } })
  await page.goto("/status")
  await consentAway(page)
  await expect(page.getByText(/Something is down/i)).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText("Down").first()).toBeVisible()
})

test("200 with the database down is an outage, not a green tile", async ({ page }) => {
  // A naive "is the homepage up?" check calls this healthy. It is a full
  // outage for anyone trying to sign in or check out.
  await stub(page, { health: { body: { ...HEALTHY, database: "down" } } })
  await page.goto("/status")
  await consentAway(page)
  await expect(page.getByText(/Something is down/i)).toBeVisible()
  await expect(page.getByText(/cannot reach its database/i)).toBeVisible()
})

test("a late scheduled job is degraded, not down", async ({ page }) => {
  // The site works; emails are not going out. Telling a customer the site is
  // down for that would be wrong in the other direction.
  await stub(page, { jobs: { status: 503, body: { status: "stale", stale: 2, jobs: {} } } })
  await page.goto("/status")
  await consentAway(page)
  await expect(page.getByText(/Working, with something behind/i)).toBeVisible()
  await expect(page.getByText(/2 jobs have not run on time/i)).toBeVisible()
})

test("a stale Prisma client is surfaced, because 'the API is fine' would mislead", async ({ page }) => {
  await stub(page, { health: { body: { ...HEALTHY, prismaGenerate: "stale" } } })
  await page.goto("/status")
  await consentAway(page)
  await expect(page.getByText(/older than the schema/i)).toBeVisible()
})

test("it renders in Spanish too", async ({ page }) => {
  await stub(page)
  await page.goto("/es/status")
  await consentAway(page)
  await expect(page.getByText(/Todo está funcionando/i)).toBeVisible()
  await expect(page.getByText("Operativo").first()).toBeVisible()
})

test("it is not indexed", async ({ page }) => {
  await stub(page)
  await page.goto("/status")
  await expect(page.locator('meta[name="robots"]').last())
    .toHaveAttribute("content", /noindex/, { timeout: 15_000 })
})
