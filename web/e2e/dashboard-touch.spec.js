// @ts-check
import { test, expect } from "@playwright/test"

/**
 * The dashboard on a phone (Tier 2: D2-1 .. D2-6).
 *
 * Two of these are the reason this file exists, and neither was visible in
 * any screenshot taken at desktop width:
 *
 *   THE BOTTOM TAB BAR WAS NOT ON SCREEN. `PageTransition` set a permanent
 *   `will-change: opacity, transform` on the wrapper around every route,
 *   which makes it a containing block for `position: fixed` descendants. So
 *   the bar resolved `bottom-0` against the DOCUMENT: measured at y=1901 in
 *   an 812px viewport, at every scroll position. The primary navigation on a
 *   phone was invisible.
 *
 *   THE NAV DRAWER WAS 2003px TALL for the same reason, with the theme
 *   control at y=1873 and Sign out at y=1943 — both unreachable, because a
 *   fixed panel does not scroll with the page.
 *
 * The rest is reach: 47 distinct interactive targets under 44px across
 * eleven routes, six of them under WCAG 2.5.8's 24px floor, and a
 * 21-extension file-type list overflowing 375px by 205px with no way to
 * wrap.
 *
 * Everything here runs with touch emulation, because `@media (pointer:
 * coarse)` is what carries the 44px minimum and desktop Chrome at 375px
 * wide does not match it. A version of this test without `hasTouch` proved
 * nothing and said so.
 */

const BASE = "http://localhost:4173"
const USER = { id: "u1", email: "member@example.com", fullName: "Mustapha Ukizuru", role: "member", avatarUrl: null }

const ROUTES = [
  "/dashboard", "/dashboard/orders", "/dashboard/downloads", "/dashboard/consultations",
  "/dashboard/projects", "/dashboard/support", "/dashboard/profile",
  "/dashboard/addresses", "/dashboard/2fa", "/dashboard/notifications",
]

test.use({ hasTouch: true, isMobile: true, viewport: { width: 375, height: 812 } })

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

test("the emulation is actually a touch device", async ({ page }) => {
  // Without this the 44px rule does not apply and every assertion below
  // would pass for the wrong reason.
  await signedIn(page)
  await page.goto("/dashboard", { waitUntil: "networkidle" })
  expect(await page.evaluate(() => window.matchMedia("(pointer: coarse)").matches)).toBe(true)
})

test("no interactive target is under 44px, on any dashboard route", async ({ page }) => {
  await signedIn(page)
  const offenders = []
  for (const route of ROUTES) {
    await page.goto(route, { waitUntil: "networkidle" })
    await page.waitForTimeout(350)
    const small = await page.evaluate(() => {
      const out = []
      for (const el of document.querySelectorAll("a[href],button,input,select,textarea,[role=button],[role=radio]")) {
        const r = el.getBoundingClientRect()
        if (r.width < 2 || r.height < 2) continue
        if (getComputedStyle(el).visibility === "hidden") continue
        if (r.height >= 44 && r.width >= 44) continue
        out.push(`${el.tagName.toLowerCase()} ${Math.round(r.width)}x${Math.round(r.height)} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 28)}"`)
      }
      return out
    })
    for (const s of small) offenders.push(`${route} → ${s}`)
  }
  expect(offenders).toEqual([])
})

test("nothing is clipped off the side of a 375px screen", async ({ page }) => {
  await signedIn(page)
  const clipped = []
  for (const route of ROUTES) {
    await page.goto(route, { waitUntil: "networkidle" })
    await page.waitForTimeout(350)
    const found = await page.evaluate(() => {
      const vw = window.innerWidth
      const out = []
      const inScroller = (el) => {
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const ox = getComputedStyle(p).overflowX
          if (ox === "auto" || ox === "scroll") return true
        }
        return false
      }
      for (const el of document.querySelectorAll("#dashboard-main *")) {
        const r = el.getBoundingClientRect()
        if (r.width < 2 || r.height < 2 || r.right <= vw + 1) continue
        // A deliberate horizontal scroller is not a clip — the ProfileTabs
        // row and the orders table both scroll on purpose.
        if (inScroller(el)) continue
        if (el.parentElement && el.parentElement.getBoundingClientRect().right > vw + 1) continue
        out.push(`${el.tagName.toLowerCase()} +${Math.round(r.right - vw)}px "${(el.textContent || "").trim().slice(0, 30)}"`)
      }
      return out
    })
    for (const f of found) clipped.push(`${route} → ${f}`)
  }
  expect(clipped).toEqual([])
})

test("the bottom tab bar is fixed to the VIEWPORT, not the document", async ({ page }) => {
  await signedIn(page)
  await page.goto("/dashboard", { waitUntil: "networkidle" })
  await page.waitForTimeout(400)

  const read = () => page.evaluate(() => {
    const bar = [...document.querySelectorAll("nav")].find((n) => getComputedStyle(n).position === "fixed")
    if (!bar) return { missing: true }
    const r = bar.getBoundingClientRect()
    return {
      onScreen: r.top < window.innerHeight && r.bottom > 0,
      // Pinned to the bottom edge, within a pixel.
      atBottom: Math.abs(r.bottom - window.innerHeight) <= 1,
    }
  })

  expect(await read()).toMatchObject({ onScreen: true, atBottom: true })
  // And it stays there. This is the assertion the bug would have failed:
  // a document-fixed bar moves with the scroll.
  await page.evaluate(() => window.scrollTo(0, 500))
  await page.waitForTimeout(200)
  expect(await read()).toMatchObject({ onScreen: true, atBottom: true })
})

test("the nav drawer fits the viewport and Sign out is reachable", async ({ page }) => {
  await signedIn(page)
  await page.goto("/dashboard", { waitUntil: "networkidle" })
  await page.waitForTimeout(400)
  await page.getByRole("button", { name: /open menu|abrir/i }).click()
  await page.waitForTimeout(400)

  const drawer = await page.evaluate(() => {
    const panel = document.querySelector('[role="dialog"]')
    const r = panel.getBoundingClientRect()
    const signOut = [...panel.querySelectorAll("button")]
      .find((b) => /sign ?out|cerrar/i.test(b.textContent || b.getAttribute("aria-label") || ""))
    const sr = signOut ? signOut.getBoundingClientRect() : null
    return {
      panelHeight: Math.round(r.height),
      viewportHeight: window.innerHeight,
      signOutOnScreen: sr ? sr.top >= 0 && sr.bottom <= window.innerHeight + 1 : false,
    }
  })
  // It was 2003px in an 812px viewport.
  expect(drawer.panelHeight).toBeLessThanOrEqual(drawer.viewportHeight + 1)
  expect(drawer.signOutOnScreen).toBe(true)
})

test("a route wrapper does not become a containing block for fixed overlays", async ({ page }) => {
  // The systemic guard. PageTransition wraps EVERY route, public and
  // signed-in, so a `will-change: transform` there broke the cookie banner
  // and the cart drawer as well as the two dashboard defects above.
  // Asserted on a public page so the guard is not dashboard-specific.
  await page.goto("/", { waitUntil: "networkidle" })
  await page.waitForTimeout(500)
  const creators = await page.evaluate(() => {
    const out = []
    for (const el of document.querySelectorAll("body *")) {
      const s = getComputedStyle(el)
      const makesContainingBlock = s.transform !== "none" || s.perspective !== "none"
        || s.filter !== "none" || s.backdropFilter !== "none"
        || s.willChange.includes("transform") || s.willChange.includes("perspective")
        || s.contain.includes("paint") || s.contain.includes("layout")
      if (!makesContainingBlock) continue
      // Only report one that actually CONTAINS something fixed.
      if (!el.querySelector) continue
      const fixedInside = [...el.querySelectorAll("*")].some((d) => getComputedStyle(d).position === "fixed")
      if (fixedInside) {
        out.push(`${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]} willChange=${s.willChange} transform=${s.transform.slice(0, 20)}`)
      }
    }
    return out
  })
  expect(creators).toEqual([])
})
