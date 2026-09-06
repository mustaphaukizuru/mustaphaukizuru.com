// @ts-check
import { test, expect } from "@playwright/test"

/**
 * The project page's shape (Tier 6: D6-1 .. D6-5).
 *
 * Measured with six milestones and six files at 375×812, which is the size a
 * client actually reads this on:
 *
 *                        before    after
 *   whole page           7,268px   5,234px      9 screens → 6.4
 *   timeline             1,901px     945px      six reply boxes → none
 *   deliverables         2,577px   1,487px      a 4:3 box holding a 40px icon
 *   in-page navigation      none    a jump bar
 *
 * And on a brand-new project, where every panel is empty:
 *
 *   whole page           3,237px   2,337px      4 screens → 2.9
 *   nine placeholders    1,767px     868px      55% of the page → 37%
 *   their size range   68..284px  68..110px     they read as one family now
 *
 * The heights are asserted with headroom — this guards a regression back
 * toward nine screens, not the exact pixel count, which legitimately moves
 * with copy and with the number of milestones.
 */

const BASE = "http://localhost:4173"
const USER = { id: "u1", email: "member@example.com", fullName: "Mustapha Ukizuru", role: "member", avatarUrl: null }
const NOW = new Date().toISOString()

const milestone = (i, status) => ({
  id: `m${i}`, title: `Milestone ${i}`, sortOrder: i, status,
  description: "Delivery of the agreed scope for this stage.",
  dueDate: NOW, completedAt: status === "completed" ? NOW : null,
})

const FULL = {
  id: "p1", userId: "u1", projectName: "Colegio Vista — Plataforma",
  projectStatus: "in_progress", description: "Sitio institucional y portal de padres.",
  dueDate: NOW, createdAt: NOW, updatedAt: NOW, closedAt: null, trackingCode: "MU-7K4C-9XQF",
  previewUrl: "https://staging.example.test/colegio-vista", previewCanFrame: false,
  milestones: [
    milestone(1, "completed"), milestone(2, "completed"), milestone(3, "awaiting_client"),
    milestone(4, "in_progress"), milestone(5, "pending"), milestone(6, "pending"),
  ],
  files: Array.from({ length: 6 }, (_, i) => ({
    id: `f${i}`, fileName: `entregable-0${i + 1}.pdf`, filePath: `/files/projects/p1/f${i}.pdf`,
    fileSize: 482000 + i * 1000, createdAt: NOW, milestoneId: null, purgedAt: null,
    uploadedBy: { id: "a1", fullName: "Mustapha", role: "admin" },
  })),
  comments: [], tickets: [], changeRequests: [],
  user: { id: "u1", fullName: "Mustapha Ukizuru", email: "member@example.com" },
  assignedAdmin: { id: "a1", fullName: "Mustapha", email: "admin@example.test" },
  access: { readOnly: false, isClosed: false, isExpired: false, expiresAt: null, state: "active", suspended: false, handover: false },
  nda: { required: false, accepted: true, version: null, acceptedAt: null },
  _count: { files: 6 },
}

const BLANK = {
  ...FULL, projectName: "Nuevo proyecto", projectStatus: "planning",
  previewUrl: null, milestones: [], files: [], _count: { files: 0 },
}

async function open(page, project, { width = 375, height = 812 } = {}) {
  await page.setViewportSize({ width, height })
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
    if (/\/member\/projects\/p1(\?|$)/.test(url)) return json(project)
    if (url.includes("/invoices")) return json({ invoices: [], billing: null })
    return json([])
  })
  await page.goto("/dashboard/projects/p1", { waitUntil: "networkidle" })
  await page.waitForTimeout(700)
}

const pageHeight = (page) => page.evaluate(() => document.documentElement.scrollHeight)

test("a busy project fits in well under nine screens on a phone", async ({ page }) => {
  await open(page, FULL)
  const h = await pageHeight(page)
  // 5,234px measured. It was 7,268.
  expect(h).toBeLessThan(6200)
})

test("a brand-new project is not four screens of empty boxes", async ({ page }) => {
  await open(page, BLANK)
  const h = await pageHeight(page)
  // 2,337px measured. It was 3,237, of which 1,767 was placeholders.
  expect(h).toBeLessThan(2800)
})

test("empty placeholders are one size, not four", async ({ page }) => {
  await open(page, BLANK)
  const heights = await page.evaluate(() =>
    [...document.querySelectorAll('#dashboard-main [role="status"]')]
      .map((el) => Math.round(el.getBoundingClientRect().height))
      .filter((h) => h > 0))
  expect(heights.length).toBeGreaterThan(3)
  // They ranged 68..284px, so a 260px icon-and-heading block sat next to a
  // 68px line of text on the same page. Nothing should now be more than
  // twice the smallest.
  expect(Math.max(...heights)).toBeLessThanOrEqual(Math.min(...heights) * 2)
})

test("the jump bar lists only sections that exist, and every chip resolves", async ({ page }) => {
  await open(page, FULL)
  const { hrefs, missing } = await page.evaluate(() => {
    const nav = document.querySelector("#dashboard-main nav")
    const hs = [...nav.querySelectorAll("a")].map((a) => a.getAttribute("href"))
    return { hrefs: hs, missing: hs.filter((h) => !document.querySelector(h)) }
  })
  expect(missing).toEqual([])
  // Preview is present on this fixture (it has a previewUrl) and hours is
  // not (no ledger) — the bar is built from what renders, not a fixed list.
  expect(hrefs).toContain("#preview")
  expect(hrefs).not.toContain("#hours")
  expect(hrefs).toContain("#invoices")
})

test("a chip scrolls its section clear of the sticky header", async ({ page }) => {
  // `scroll-mt-20` is the whole reason this passes: without a scroll margin
  // the heading lands UNDER the sticky header and reads as the wrong section.
  //
  // Asserted on a MID-page section, not the last one. #invoices begins past
  // the maximum scroll position on a 375px screen, so no amount of scrolling
  // can bring it to the top and a strict assertion there measures the page
  // length rather than the anchor. That reading — 353px — is what first
  // looked like Lenis fighting the jump; it was clamping.
  await open(page, FULL)
  await page.locator('#dashboard-main nav a[href="#deliverables"]').click()
  await page.waitForTimeout(1500)   // Lenis eases; give it time to settle
  const { top, headerBottom } = await page.evaluate(() => {
    const shell = document.querySelector("[data-dashboard-shell]")
    const hdr = [...shell.querySelectorAll("header")].find((x) => getComputedStyle(x).display !== "none")
    return {
      top: Math.round(document.querySelector("#deliverables h2").getBoundingClientRect().top),
      headerBottom: hdr ? Math.round(hdr.getBoundingClientRect().bottom) : 0,
    }
  })
  // Below the sticky header — the failure this guards is a heading hidden
  // behind it — and inside the first quarter of the screen.
  expect(top).toBeGreaterThan(headerBottom)
  expect(top).toBeLessThan(220)
})

test("every section is reachable from the bar, including the last one", async ({ page }) => {
  // The weaker but honest assertion for a section near the page bottom: the
  // heading has to end up ON SCREEN, which is what the reader needs. Where
  // exactly is the browser's business.
  await open(page, FULL)
  const offScreen = []
  for (const id of ["timeline", "preview", "file-requests", "deliverables", "messages", "invoices", "secrets", "activity"]) {
    await page.goto("/dashboard/projects/p1", { waitUntil: "networkidle" })
    await page.waitForTimeout(600)
    await page.locator(`#dashboard-main nav a[href="#${id}"]`).click()
    await page.waitForTimeout(1500)
    const visible = await page.evaluate((sid) => {
      const h = document.querySelector(`#${sid} h2`)
      const r = h.getBoundingClientRect()
      return r.top < window.innerHeight && r.bottom > 0
    }, id)
    if (!visible) offScreen.push(id)
  }
  expect(offScreen).toEqual([])
})

test("the milestone reply box opens on the one waiting for the client, and is closed elsewhere", async ({ page }) => {
  // Six always-on textareas were the largest single cost in the timeline.
  // Removing the one on `awaiting_client` too would have hidden the point of
  // the screen, so that one stays open — the assertion is exactly one.
  await open(page, FULL)
  const boxes = await page.evaluate(() =>
    [...document.querySelectorAll("#timeline textarea")].length)
  expect(boxes).toBe(1)

  const toggles = await page.evaluate(() =>
    [...document.querySelectorAll("#timeline button")]
      .filter((b) => /comment|reply|comentar|responder/i.test(b.textContent || "")).length)
  expect(toggles).toBe(5)
})

test("a hidden reply box is one tap away and really opens", async ({ page }) => {
  await open(page, FULL)
  await page.locator("#timeline button", { hasText: /comment on this milestone/i }).first().click()
  await page.waitForTimeout(300)
  expect(await page.evaluate(() => document.querySelectorAll("#timeline textarea").length)).toBe(2)
})

test("a file with no picture does not reserve a picture-sized box", async ({ page }) => {
  await open(page, FULL)
  const heights = await page.evaluate(() =>
    [...document.querySelectorAll("#deliverables li a, #deliverables li > div")]
      .map((el) => Math.round(el.getBoundingClientRect().height))
      .filter((h) => h > 40))
  expect(heights.length).toBeGreaterThan(0)
  // Six PDFs measured 430px each — a 257px 4:3 panel around a 40px icon.
  expect(Math.max(...heights)).toBeLessThan(200)
})
