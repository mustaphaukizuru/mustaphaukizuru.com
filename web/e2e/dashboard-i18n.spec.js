// @ts-check
import { test, expect } from "@playwright/test"

/**
 * The dashboard in Spanish (Tier 3: D3-1, D3-2, D3-3).
 *
 * D3-3 IS THE ONE THAT MATTERS. The dashboard was not mirrored under /es.
 * Language on this site is read off the URL prefix — LanguageWrapper calls
 * changeLanguage() from detectLanguageFromPath() on every navigation — so
 * /dashboard resolved to "en" unconditionally and NO URL existed that would
 * render the member dashboard in Spanish. es/dashboard.json holds 1,078
 * translated keys; only the handful under `portal` were reachable, through
 * /es/portal/:token, which was mirrored. Everything else had never rendered
 * on a screen.
 *
 * That is also why D3-1 (twelve hardcoded English page titles) read as the
 * whole finding at first: with the tree pinned to English there was nothing
 * to compare them against.
 *
 * The three assertions that would have caught the original defect, and would
 * catch it coming back:
 *   · /es/dashboard/* resolves to a route (not the 404 catch-all)
 *   · a link clicked inside the Spanish dashboard stays Spanish
 *   · the heading and the tab title are translated, per route
 */

const BASE = "http://localhost:4173"
const USER = { id: "u1", email: "member@example.com", fullName: "Mustapha Ukizuru", role: "member", avatarUrl: null }

/** Route → the Spanish heading it must render, and the English one it must not. */
const CASES = [
  { path: "/dashboard", es: "Inicio", en: "Overview" },
  { path: "/dashboard/orders", es: "Pedidos", en: "Order History" },
  { path: "/dashboard/downloads", es: "Descargas", en: "Downloads" },
  { path: "/dashboard/projects", es: "Proyectos", en: "Projects" },
  { path: "/dashboard/support", es: "Soporte", en: "Support" },
  { path: "/dashboard/profile", es: "Perfil", en: "Profile" },
  { path: "/dashboard/2fa", es: "Verificación en dos pasos", en: "Two-Factor Auth" },
]

async function signedIn(page) {
  await page.context().addCookies([{ name: "mu_csrf", value: "e2e", url: BASE }])
  await page.addInitScript((u) => {
    window.localStorage.setItem("auth-user", JSON.stringify(u))
    window.localStorage.setItem("mu_cookie_consent_v1", JSON.stringify({
      version: 1, necessary: true, analytics: true, marketing: false, at: Date.now(),
    }))
  }, USER)
  await page.route("**/api/**", (route) => {
    const url = route.request().url()
    const json = (d) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: d }) })
    if (url.includes("/auth/me")) return json(USER)
    if (url.includes("/downloads/my/library")) return json({ orders: [] })
    return json([])
  })
}

const es = (p) => (p === "/dashboard" ? "/es/dashboard" : `/es${p}`)

test.describe("the Spanish mirror exists", () => {
  test.beforeEach(async ({ page }) => {
    await signedIn(page)
    await page.setViewportSize({ width: 1440, height: 900 })
  })

  test("every /es/dashboard route resolves to the dashboard, not the 404", async ({ page }) => {
    // Before D3-3 these paths had no route behind them: the catch-all served
    // ErrorPage 404, which is why localizeTo refused to prefix them at all.
    const missing = []
    for (const c of CASES) {
      await page.goto(es(c.path), { waitUntil: "networkidle" })
      await page.waitForTimeout(300)
      const shell = await page.locator("[data-dashboard-shell]").count()
      if (!shell) missing.push(`${es(c.path)} → no dashboard shell`)
    }
    expect(missing).toEqual([])
  })

  test("the page heading is Spanish on every mirrored route", async ({ page }) => {
    const wrong = []
    for (const c of CASES) {
      await page.goto(es(c.path), { waitUntil: "networkidle" })
      await page.waitForTimeout(300)
      const h1 = (await page.locator("[data-dashboard-shell] h1").first().textContent())?.trim()
      if (h1 !== c.es) wrong.push(`${es(c.path)} → "${h1}" (expected "${c.es}")`)
    }
    expect(wrong).toEqual([])
  })

  test("no English page title survives anywhere in the Spanish shell", async ({ page }) => {
    // A guard rather than a list: reads the whole header, so a title that
    // comes back through a NEW route is caught as well as the twelve that
    // were there.
    const found = []
    for (const c of CASES) {
      await page.goto(es(c.path), { waitUntil: "networkidle" })
      await page.waitForTimeout(300)
      const header = await page.evaluate(() => {
        const shell = document.querySelector("[data-dashboard-shell]")
        const h = [...shell.querySelectorAll("header")].find((x) => getComputedStyle(x).display !== "none")
        return h?.textContent || ""
      })
      if (header.includes(c.en)) found.push(`${es(c.path)} → header still says "${c.en}"`)
    }
    expect(found).toEqual([])
  })

  test("the sidebar navigation is Spanish and points at Spanish URLs", async ({ page }) => {
    // The second half of the bug: even with the route mirrored, an
    // unprefixed <Link to="/dashboard/orders"> navigates to the ENGLISH
    // tree, and LanguageWrapper then switches the whole interface back.
    // Eleven files held ~19 of those, exempted from the lint rule.
    await page.goto("/es/dashboard", { waitUntil: "networkidle" })
    await page.waitForTimeout(400)
    const links = await page.evaluate(() => {
      const aside = document.querySelector("[data-dashboard-shell] aside")
      return [...aside.querySelectorAll("a")]
        .map((a) => new URL(a.href).pathname)
        .filter((p) => p.includes("dashboard"))
    })
    expect(links.length).toBeGreaterThan(5)
    expect(links.filter((p) => !p.startsWith("/es/"))).toEqual([])
  })

  test("clicking into a project keeps the reader in Spanish", async ({ page }) => {
    await page.goto("/es/dashboard", { waitUntil: "networkidle" })
    await page.waitForTimeout(400)
    await page.locator('[data-dashboard-shell] aside a[href$="/es/dashboard/projects"]').click()
    await page.waitForTimeout(600)
    expect(new URL(page.url()).pathname).toBe("/es/dashboard/projects")
    const h1 = (await page.locator("[data-dashboard-shell] h1").first().textContent())?.trim()
    expect(h1).toBe("Proyectos")
  })

  test("the tab title is translated", async ({ page }) => {
    await page.goto("/es/dashboard/projects", { waitUntil: "networkidle" })
    await page.waitForTimeout(400)
    expect(await page.title()).toContain("Proyectos")
  })

  test("the Spanish dashboard is noindex, like the English one", async ({ page }) => {
    // shouldNoindex() tested the raw pathname against unprefixed rules, so
    // /es/login, /es/signup, /es/checkout and /es/cart were already being
    // served index,follow while their English twins were not. Mirroring the
    // dashboard would have added seven more.
    await page.goto("/es/dashboard", { waitUntil: "networkidle" })
    await page.waitForTimeout(400)
    // Read ALL of them, not the first. index.html ships a static
    // `index,follow` robots meta as the default for anything Helmet does not
    // cover, so the first match on every page is that one and an assertion
    // on it would fail for /dashboard and /login too. A crawler takes the
    // most restrictive of the set, so what matters is that a noindex is
    // present.
    const robots = await page.evaluate(() =>
      [...document.querySelectorAll('meta[name="robots"]')].map((m) => m.content))
    expect(robots.some((r) => r.includes("noindex"))).toBe(true)
  })
})

test.describe("the English tree is unchanged", () => {
  test.beforeEach(async ({ page }) => {
    await signedIn(page)
    await page.setViewportSize({ width: 1440, height: 900 })
  })

  test("the heading matches the sidebar entry that leads to it", async ({ page }) => {
    // The titles resolve through the SAME `nav.*` key the sidebar uses. You
    // clicked "Orders" and landed on a page headed "Order History" before.
    await page.goto("/dashboard/orders", { waitUntil: "networkidle" })
    await page.waitForTimeout(300)
    const heading = (await page.locator("[data-dashboard-shell] h1").first().textContent())?.trim()
    const navLabel = await page.evaluate(() => {
      const aside = document.querySelector("[data-dashboard-shell] aside")
      const link = [...aside.querySelectorAll("a")].find((a) => new URL(a.href).pathname === "/dashboard/orders")
      // First text node of the row; the description sits in a sibling.
      return link.textContent.trim()
    })
    expect(navLabel.startsWith(heading)).toBe(true)
  })

  test("each dashboard route has its own browser tab title", async ({ page }) => {
    const titles = []
    for (const c of CASES) {
      await page.goto(c.path, { waitUntil: "networkidle" })
      await page.waitForTimeout(300)
      titles.push(await page.title())
    }
    // All seven distinct — they were seven copies of siteConfig.defaultTitle,
    // because /dashboard is in pageSeo's noindexPrefixes and nowhere in
    // staticSeoByRoute.
    expect(new Set(titles).size).toBe(CASES.length)
    // Page first, brand second: the tab strip truncates from the right.
    expect(titles[0].startsWith("Overview · ")).toBe(true)
  })

  test("English sidebar links stay unprefixed", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "networkidle" })
    await page.waitForTimeout(400)
    const prefixed = await page.evaluate(() => {
      const aside = document.querySelector("[data-dashboard-shell] aside")
      return [...aside.querySelectorAll("a")].map((a) => new URL(a.href).pathname).filter((p) => p.startsWith("/es/"))
    })
    expect(prefixed).toEqual([])
  })
})

test("the language control is reachable from inside the dashboard", async ({ page }) => {
  // There was none: the only switcher lives in the public header and footer,
  // so a member would have had to leave the dashboard to change language —
  // and before D3-3 that would not have helped, because coming back to
  // /dashboard switched them straight back to English.
  await signedIn(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/dashboard", { waitUntil: "networkidle" })
  await page.waitForTimeout(400)

  const header = page.locator("[data-dashboard-shell] header").last()
  await header.getByRole("button", { name: /español|spanish/i }).click()
  await page.waitForTimeout(900)
  expect(new URL(page.url()).pathname).toBe("/es/dashboard")
  expect((await page.locator("[data-dashboard-shell] h1").first().textContent())?.trim()).toBe("Inicio")
})
