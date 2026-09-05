// @ts-check
import { test, expect } from "@playwright/test"

/**
 * The dashboard shell (Tier 1: D1-1, D1-2, D1-3, D4-1).
 *
 * These are geometry regressions, and geometry is the one thing a unit test
 * cannot see: every defect below passed lint, passed 1890 jest tests, and was
 * visible the moment somebody opened the page on a laptop.
 *
 *   D1-1  a `sticky top-4` header leaves a 16px window that scrolling cards
 *         slide through in full view. Asserted by hit-testing that strip.
 *   D1-2  the header stacked below xl, so it was 184px tall — 31% of a
 *         600px-tall screen — and sticky, permanently.
 *   D1-3  the sidebar pinned 190px of chrome around a nav needing 642px, so
 *         441px of the nav was unreachable at 1024x600 and rows were sliced
 *         in half by the scroller's edge.
 *   D4-1  two <h1> per page: the layout rendered one and so did the page.
 *
 * Every number here was measured before and after; the thresholds are set
 * where a regression would be a real one, not at the current value.
 */

const USER = { id: "u1", email: "member@example.com", fullName: "Mustapha Ukizuru", role: "member", avatarUrl: null }

/** The heights that actually broke: a laptop with browser chrome, and a netbook. */
const VIEWPORTS = [
  { name: "1920x950", w: 1920, h: 950 },
  { name: "1440x900", w: 1440, h: 900 },
  { name: "1280x650", w: 1280, h: 650 },
  { name: "1024x600", w: 1024, h: 600 },
]

async function signedIn(page) {
  await page.context().addCookies([{ name: "mu_csrf", value: "e2e", url: "http://localhost:4173" }])
  await page.addInitScript((u) => {
    window.localStorage.setItem("auth-user", JSON.stringify(u))
    // Consent stored, or the banner's scrim covers what is being measured.
    window.localStorage.setItem("mu_cookie_consent_v1", JSON.stringify({
      version: 1, necessary: true, analytics: true, marketing: false, at: Date.now(),
    }))
    // A signed-in member is by definition a returning visitor, and the
    // splash is what they skip. Without this flag LoadingScreen covers the
    // app at z-9999 with `pointer-events: none` for ~1.6 s, so anything
    // measured inside that window is measuring the splash: elementFromPoint
    // returns it, and its own controls show up in a11y scans of the page.
    window.localStorage.setItem("ukz-splash-skip", "1")
  }, USER)
  await page.route("**/api/**", (route) => {
    const url = route.request().url()
    const json = (d) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: d }) })
    if (url.includes("/auth/me")) return json(USER)
    return json([])
  })
}

for (const vp of VIEWPORTS) {
  test.describe(`shell @ ${vp.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: vp.w, height: vp.h })
      await signedIn(page)
      await page.goto("/dashboard", { waitUntil: "networkidle" })
      await page.waitForTimeout(400)
    })

    test("nothing scrolls through the strip above the sticky header", async ({ page }) => {
      await page.evaluate(() => window.scrollTo(0, 600))
      await page.waitForTimeout(200)

      const bleeding = await page.evaluate(() => {
        const shell = document.querySelector("[data-dashboard-shell]")
        const header = [...shell.querySelectorAll("header")].find((h) => getComputedStyle(h).display !== "none")
        // The sticky ancestor is the WRAPPER, which is the fix: it carries
        // the page's 16px gap as its own padding on an opaque ground.
        let sticky = header
        while (sticky && getComputedStyle(sticky).position !== "sticky") sticky = sticky.parentElement
        if (!sticky) return ["no sticky ancestor"]

        const out = []
        for (const x of [0.5, 0.75].map((f) => Math.round(window.innerWidth * f))) {
          for (const y of [2, 8, 14]) {
            const el = document.elementFromPoint(x, y)
            if (el && !sticky.contains(el)) {
              out.push(`${x},${y} → ${el.tagName.toLowerCase()} "${(el.textContent || "").trim().slice(0, 30)}"`)
            }
          }
        }
        return out
      })
      expect(bleeding).toEqual([])
    })

    test("the header is one row and stays under a fifth of the screen", async ({ page }) => {
      const { height, share } = await page.evaluate(() => {
        const shell = document.querySelector("[data-dashboard-shell]")
        const header = [...shell.querySelectorAll("header")].find((h) => getComputedStyle(h).display !== "none")
        const h = header.getBoundingClientRect().height
        return { height: Math.round(h), share: h / window.innerHeight }
      })
      // It was 184px / 31% at 1024x600. A single row is ~80px at every width.
      expect(height).toBeLessThan(110)
      expect(share).toBeLessThan(0.2)
    })

    test("no navigation row is left sliced by the scroller's edge", async ({ page }) => {
      const sliced = await page.evaluate(() => {
        const aside = document.querySelector("[data-dashboard-shell] aside")
        if (!aside || getComputedStyle(aside).display === "none") return []
        const scroller = aside.querySelector(".overflow-y-auto")
        const sr = scroller.getBoundingClientRect()
        const out = []
        for (const link of scroller.querySelectorAll("a")) {
          const lr = link.getBoundingClientRect()
          // Cut by more than a hairline at either edge.
          if (lr.top < sr.bottom - 2 && lr.bottom > sr.bottom + 2) out.push((link.textContent || "").trim().slice(0, 24))
        }
        return out
      })
      // 1440x700 still cuts one row: seven described items plus the brand and
      // the footer genuinely do not fit 700px, and the fade says so. What is
      // asserted is that it is never more than one.
      expect(sliced.length).toBeLessThanOrEqual(1)
    })

    test("exactly one h1, and the layout owns it", async ({ page }) => {
      // Two per page was the finding. The layout is the owner because nine
      // of the fourteen dashboard pages have no heading of their own, so
      // moving it to the page left those documents with none.
      const { total, inMain } = await page.evaluate(() => {
        const shell = document.querySelector("[data-dashboard-shell]")
        const all = [...shell.querySelectorAll("h1")]
        const main = shell.querySelector("#dashboard-main")
        return { total: all.length, inMain: all.filter((h) => main.contains(h)).length }
      })
      expect({ total, inMain }).toEqual({ total: 1, inMain: 0 })
    })

    test("heading levels do not skip", async ({ page }) => {
      const jumps = await page.evaluate(() => {
        const shell = document.querySelector("[data-dashboard-shell]")
        const levels = [...shell.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((h) => Number(h.tagName[1]))
        const out = []
        for (let i = 1; i < levels.length; i += 1) {
          if (levels[i] - levels[i - 1] > 1) out.push(`${levels[i - 1]}→${levels[i]}`)
        }
        return out
      })
      expect(jumps).toEqual([])
    })
  })
}

test("the whole navigation is reachable without scrolling on a normal laptop", async ({ page }) => {
  // 1920x950 is the window the bug report came from: 91px of the nav was
  // hidden there, and the footer's three stacked blocks are what took it.
  await page.setViewportSize({ width: 1920, height: 950 })
  await signedIn(page)
  await page.goto("/dashboard", { waitUntil: "networkidle" })
  await page.waitForTimeout(400)

  const hidden = await page.evaluate(() => {
    const scroller = document.querySelector("[data-dashboard-shell] aside .overflow-y-auto")
    return scroller.scrollHeight - scroller.clientHeight
  })
  expect(hidden).toBe(0)
})

test("every nav destination is still present after the rewrite", async ({ page }) => {
  // The footer was rebuilt and the nav retuned; a lost route would be a
  // silent regression that no geometry assertion above would catch.
  await page.setViewportSize({ width: 1920, height: 1080 })
  await signedIn(page)
  await page.goto("/dashboard", { waitUntil: "networkidle" })
  await page.waitForTimeout(400)

  const hrefs = await page.evaluate(() => {
    const aside = document.querySelector("[data-dashboard-shell] aside")
    return [...aside.querySelectorAll("a")].map((a) => new URL(a.href).pathname)
  })
  for (const path of [
    "/dashboard", "/dashboard/orders", "/dashboard/downloads",
    "/dashboard/consultations", "/dashboard/projects", "/dashboard/support",
    "/dashboard/profile",
  ]) {
    expect(hrefs).toContain(path)
  }
})

test("logout and the theme control survived the footer rebuild", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await signedIn(page)
  await page.goto("/dashboard", { waitUntil: "networkidle" })
  await page.waitForTimeout(400)

  const aside = page.locator("[data-dashboard-shell] aside")
  // Logout became a 44px icon button, so its name is its aria-label.
  await expect(aside.getByRole("button", { name: /sign ?out|cerrar/i })).toBeVisible()
  // All three theme modes, not just a light/dark toggle. The segmented
  // control is a radiogroup, so each mode is a radio rather than a button.
  const themes = aside.getByRole("radiogroup")
  await expect(themes).toBeVisible()
  for (const name of [/light|claro/i, /dark|oscuro/i, /system|sistema/i]) {
    await expect(themes.getByRole("radio", { name })).toBeVisible()
  }
})
