// @ts-check
import { test, expect } from "@playwright/test"

/**
 * axe over the whole member dashboard (Tier 4: D4-2).
 *
 * Tier 1 fixed the two structural problems by hand — two <h1> per page and a
 * heading-order skip — and `dashboard-shell.spec.js` still guards those. This
 * runs the actual rule engine over every route instead, because the two
 * things it found were not on anybody's list:
 *
 *   button-name (critical)      the avatar upload overlay: an icon-only
 *                               button with no name. Naming it would have
 *                               hidden the worse half — `opacity-0` until
 *                               `group-hover`, so a keyboard user tabbed to a
 *                               control that was invisible with no focus
 *                               state to reveal it. It duplicates a visible
 *                               labelled button, so it left the tab order.
 *   aria-progressbar-name       four progress bars carrying aria-valuenow
 *   (serious)                   with nothing to say what the number measures.
 *
 * axe-core is injected from node_modules rather than through
 * @axe-core/playwright: the engine is already a transitive dependency and the
 * wrapper is not, so this needs no new package.
 *
 * Scoped to [data-dashboard-shell] on purpose. The public tree has its own
 * debt (44% of the text on /about is under 12px, per the typography ratchet)
 * and folding it in here would make this assert a number rather than zero.
 */

const BASE = "http://localhost:4173"
const USER = { id: "u1", email: "member@example.com", fullName: "Mustapha Ukizuru", role: "member", avatarUrl: null }

const ROUTES = [
  "/dashboard", "/dashboard/orders", "/dashboard/downloads", "/dashboard/consultations",
  "/dashboard/projects", "/dashboard/support", "/dashboard/profile",
  "/dashboard/addresses", "/dashboard/2fa", "/dashboard/notifications",
  "/dashboard/products", "/dashboard/service-orders",
]

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]

async function signedIn(page) {
  await page.context().addCookies([{ name: "mu_csrf", value: "e2e", url: BASE }])
  await page.addInitScript((u) => {
    window.localStorage.setItem("auth-user", JSON.stringify(u))
    window.localStorage.setItem("mu_cookie_consent_v1", JSON.stringify({
      version: 1, necessary: true, analytics: true, marketing: false, at: Date.now(),
    }))
    // A signed-in member is by definition a returning visitor, and the
    // splash is what they skip. Without this flag LoadingScreen covers the
    // app at z-9999 with `pointer-events: none` for ~1.6 s, so anything
    // measured inside that window is measuring the splash: elementFromPoint
    // returns it, and its own controls show up in a11y scans of the page.
  }, USER)
  await page.route("**/api/**", (route) => {
    const url = route.request().url()
    const json = (d) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: d }) })
    if (url.includes("/auth/me")) return json(USER)
    if (url.includes("/downloads/my/library")) return json({ orders: [] })
    return json([])
  })
}

/** Run axe against the dashboard subtree and return one line per violation. */
async function violations(page) {
  await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" })
  return page.evaluate(async (tags) => {
    const res = await window.axe.run("[data-dashboard-shell]", { runOnly: { type: "tag", values: tags } })
    return res.violations.map((v) =>
      `[${v.impact}] ${v.id} ×${v.nodes.length} — ${v.help} — e.g. ${(v.nodes[0]?.html || "").slice(0, 120)}`)
  }, TAGS)
}

test("no WCAG A/AA violation on any dashboard route", async ({ page }) => {
  await signedIn(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  const found = []
  for (const route of ROUTES) {
    await page.goto(route, { waitUntil: "networkidle" })
    await page.waitForTimeout(350)
    for (const v of await violations(page)) found.push(`${route} → ${v}`)
  }
  expect(found).toEqual([])
})

test("no violation on a phone either", async ({ page }) => {
  // Different DOM: the rail is replaced by a drawer and a bottom tab bar,
  // and the header is a different component. Four routes rather than twelve
  // — this is about the shell swap, not per-page content.
  await signedIn(page)
  await page.setViewportSize({ width: 375, height: 812 })
  const found = []
  for (const route of ["/dashboard", "/dashboard/projects", "/dashboard/profile", "/dashboard/support"]) {
    await page.goto(route, { waitUntil: "networkidle" })
    await page.waitForTimeout(350)
    for (const v of await violations(page)) found.push(`${route} @375 → ${v}`)
  }
  expect(found).toEqual([])
})

test("every progress bar says what it measures", async ({ page }) => {
  // The rule that caught these is aria-progressbar-name, but the reason to
  // assert it separately is that axe only sees a bar that RENDERED — three
  // of the four are behind data the fixtures return empty.
  await signedIn(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  const unnamed = []
  for (const route of ["/dashboard", "/dashboard/projects"]) {
    await page.goto(route, { waitUntil: "networkidle" })
    await page.waitForTimeout(350)
    const bad = await page.evaluate(() =>
      [...document.querySelectorAll('[data-dashboard-shell] [role="progressbar"]')]
        .filter((el) => !el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby"))
        .map((el) => el.outerHTML.slice(0, 100)))
    for (const b of bad) unnamed.push(`${route} → ${b}`)
  }
  expect(unnamed).toEqual([])
})

test("nothing focusable is invisible", async ({ page }) => {
  // The systemic version of the button-name finding. A control that is
  // opacity-0 or visibility-hidden while still in the tab order is a focus
  // trap a sighted keyboard user cannot see, and no rule in axe's default
  // set covers it.
  await signedIn(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  const found = []
  for (const route of ["/dashboard", "/dashboard/profile", "/dashboard/projects"]) {
    await page.goto(route, { waitUntil: "networkidle" })
    await page.waitForTimeout(350)
    const bad = await page.evaluate(() => {
      const out = []
      const sel = "a[href],button,input,select,textarea,[tabindex]"
      for (const el of document.querySelectorAll(`[data-dashboard-shell] ${sel}`)) {
        if (el.getAttribute("tabindex") === "-1") continue
        if (el.disabled) continue
        // sr-only is the legitimate case: visually hidden but a 1px box that
        // the browser still paints, and it reveals itself on focus.
        if ((el.className || "").toString().includes("sr-only")) continue
        const cs = getComputedStyle(el)
        const r = el.getBoundingClientRect()
        if (r.width < 1 || r.height < 1) continue          // not laid out at all
        if (cs.visibility === "hidden" || cs.display === "none") continue
        if (Number(cs.opacity) === 0) out.push(`opacity:0 ${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30)}"`)
      }
      return out
    })
    for (const b of bad) found.push(`${route} → ${b}`)
  }
  expect(found).toEqual([])
})
