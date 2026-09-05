/**
 * The self-audit actually runs (T2-3).
 *
 * This spec exists because of what it found. `AuditModal` used
 * <AnimatePresence> for its per-item tooltip and never imported it, so the
 * section step threw a ReferenceError on first render and an error boundary
 * swallowed the entire modal. The audit — the site's lead magnet, linked from
 * the services hero and now the footer — had never shown a visitor a single
 * question, and nothing failed: no test covered the modal past the audience
 * picker, and a React error boundary means no unhandled rejection either.
 *
 * So the assertions are deliberately shallow and the coverage is the walk:
 * open the tool, choose an audience, get past the context step, and confirm
 * real questions render with no console error. A unit test cannot catch a
 * missing import that only breaks at render.
 */
import { expect, test } from "@playwright/test"

// Reduced motion for the same reason as every other spec here: the page
// animates on scroll, and a mid-animation click target is not stable.
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
})

/**
 * Dismiss the cookie banner and WAIT for it to go. Swallowing a failure here
 * is what made the first version of this spec time out with no useful
 * message: the banner sits above the modal, so an undismissed one silently
 * eats every click that follows.
 */
const consentAway = async (page) => {
  const accept = page.getByRole("button", { name: /^(accept all|aceptar todas)$/i })
  await accept.waitFor({ state: "visible", timeout: 10_000 })
  await accept.click()
  await accept.waitFor({ state: "detached", timeout: 10_000 })
}

const LOCALES = [
  {
    path: "/self-audit",
    begin: /Begin your free audit/i,
    audience: /Business, SME/i,
    skip: "Skip and start the audit",
    sectionTitle: "IT Strategy Consulting",
    // A statement only the rebuilt instrument has.
    statement: /We know what every software subscription costs us/,
    foreign: /Sabemos cuánto nos cuesta cada suscripción/,
  },
  {
    path: "/es/self-audit",
    begin: /Comienza tu diagn/i,
    audience: /Empresa, PyME/i,
    skip: "Omitir y comenzar",
    sectionTitle: "Consultoría Estratégica de TI",
    statement: /Sabemos cuánto nos cuesta cada suscripción/,
    foreign: /We know what every software subscription costs us/,
  },
]

for (const locale of LOCALES) {
  test(`${locale.path} renders questions, not an empty modal`, async ({ page }) => {
    const errors = []
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`))
    page.on("console", (m) => {
      // The preview server has no API behind it; ignore the failed fetches.
      if (m.type() === "error" && !/ERR_CONNECTION_REFUSED|Failed to load resource/.test(m.text())) {
        errors.push(`console: ${m.text().slice(0, 200)}`)
      }
    })

    await page.goto(locale.path)
    await consentAway(page)

    // Short settles between steps: each one swaps the modal's contents behind
    // an AnimatePresence transition, and clicking into a view that is still
    // animating in lands on whatever was there a frame ago.
    await page.getByRole("button", { name: locale.begin }).first().click()
    await page.waitForTimeout(500)
    await page.getByRole("button", { name: locale.audience }).click()
    await page.waitForTimeout(400)
    await page.getByRole("button", { name: locale.skip }).click()
    await page.waitForTimeout(600)

    // The section step. This is the screen that never rendered.
    await expect(page.getByText(locale.sectionTitle)).toBeVisible()
    await expect(page.getByText(locale.statement)).toBeVisible()

    const body = await page.locator("body").innerText()

    // Statement ids come from the rebuilt instrument's four category codes.
    expect(body).toMatch(/\b(ITS|AIA|CAM|DPE)\.\d+/)

    // The retired SKU taxonomy must not surface anywhere.
    expect(body).not.toMatch(/UKZ-(CS|BD|IC|WD|ET|MS)-/)

    // No half-translated screen: the other language's copy must not appear.
    expect(body).not.toMatch(locale.foreign)

    expect(errors, "the audit must render without errors").toEqual([])
  })
}

test("the audit is reachable from the footer on any page", async ({ page }) => {
  // It used to be linked only from the services hero, which is a lead magnet
  // almost nobody could find.
  await page.goto("/about")
  await consentAway(page)
  await expect(page.locator('footer a[href="/self-audit"]')).toHaveCount(1)
})
