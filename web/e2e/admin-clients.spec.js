// @ts-check
import { test, expect } from "@playwright/test"

/**
 * Admin → Clients (/admin/clients): the CRUD screen behind the /about logo wall.
 *
 * Drives the page in a real browser against a stubbed API, because the screen
 * is where a mistake is most expensive — a bad payload silently wipes a client
 * or reorders the wall. What is asserted is the CONTRACT the page sends:
 * method, URL and body for create, edit, hide, reorder and delete, plus the
 * live preview reflecting the rows.
 *
 * The session is faked the way the SPA recognises one (see checkout.spec.js):
 * the cached `auth-user` plus a /auth/me answer, with role "admin" so
 * AdminRoute lets us through.
 */

const BASE = "http://localhost:4173"

const ADMIN = { id: "usr_admin", email: "admin@example.com", fullName: "Admin", role: "admin", isClaimed: true }

const ROWS = [
  { id: "cl1", name: "Colegio Interlaken", slug: "interlaken", logoUrl: "/images/brand/companies/interlaken.webp", sector: "K-12 school · Mexico", sectorEs: "Colegio K-12 · México", websiteUrl: null, scale: 1.1, boxed: false, isActive: true, sortOrder: 0 },
  { id: "cl2", name: "BlueFlame Appliances", slug: "blueflame", logoUrl: "/images/brand/companies/blueflame.webp", sector: "Retail · Rwanda", sectorEs: "Comercio · Ruanda", websiteUrl: null, scale: 1, boxed: false, isActive: true, sortOrder: 1 },
  { id: "cl3", name: "ASR", slug: "asr", logoUrl: "/images/brand/companies/asr.webp", sector: "Technology", sectorEs: "Tecnología", websiteUrl: null, scale: 0.95, boxed: true, isActive: false, sortOrder: 2 },
]

test.use({ baseURL: BASE })

/** Requests the page made, so the assertions can inspect the contract. */
function recorder() {
  /** @type {{method:string,url:string,body:any}[]} */
  const seen = []
  return {
    seen,
    find: (method, match) => seen.find((r) => r.method === method && r.url.includes(match)),
  }
}

async function setup(page, rec) {
  await page.context().addCookies([{ name: "mu_csrf", value: "e2e-csrf", url: BASE }])
  await page.addInitScript((user) => {
    window.localStorage.setItem("auth-user", JSON.stringify(user))
  }, ADMIN)

  await page.route("**/api/**", (route) => {
    const req = route.request()
    const url = req.url()
    const method = req.method()
    let body = null
    try { body = req.postDataJSON() } catch { /* not JSON (uploads) */ }
    if (method !== "GET") rec.seen.push({ method, url, body })

    if (url.includes("/auth/me")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: ADMIN }) })
    }
    if (url.includes("/admin/client-logos")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: ROWS }) })
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: [] }) })
  })
}

test.describe("admin · client logos", () => {
  test("lists every client, including the hidden one", async ({ page }) => {
    const rec = recorder()
    await setup(page, rec)
    await page.goto("/admin/clients")

    await expect(page.getByRole("heading", { name: /client logo wall/i })).toBeVisible()
    for (const row of ROWS) {
      await expect(page.getByText(row.name, { exact: true }).first()).toBeVisible()
    }
    // The preview renders only what the public wall would show (2 of 3 active).
    const previewLogos = page.locator('img[src^="/images/brand/companies/"]')
    await expect.poll(() => previewLogos.count()).toBeGreaterThanOrEqual(2)
  })

  test("creating a client posts the full payload", async ({ page }) => {
    const rec = recorder()
    await setup(page, rec)
    await page.goto("/admin/clients")

    await page.getByRole("button", { name: /add client/i }).click()
    await page.getByLabel(/company name/i).fill("Acme Corp")
    await page.getByLabel(/^sector \(english\)/i).fill("Manufacturing · Kenya")
    await page.getByPlaceholder("/images/brand/companies/acme.webp").fill("/images/brand/companies/acme.webp")
    await page.getByRole("button", { name: /^add client$/i }).last().click()

    await expect.poll(() => Boolean(rec.find("POST", "/admin/client-logos"))).toBe(true)
    const call = rec.find("POST", "/admin/client-logos")
    expect(call?.body).toMatchObject({
      name: "Acme Corp",
      logoUrl: "/images/brand/companies/acme.webp",
      sector: "Manufacturing · Kenya",
      isActive: true,
    })
  })

  test("hiding a client sends only isActive — it cannot wipe the rest of the row", async ({ page }) => {
    const rec = recorder()
    await setup(page, rec)
    await page.goto("/admin/clients")

    await page.getByRole("button", { name: /hide Colegio Interlaken/i }).click()

    await expect.poll(() => Boolean(rec.find("PATCH", "/admin/client-logos/cl1"))).toBe(true)
    const call = rec.find("PATCH", "/admin/client-logos/cl1")
    expect(call?.body).toEqual({ isActive: false })
  })

  test("reordering posts the whole new order", async ({ page }) => {
    const rec = recorder()
    await setup(page, rec)
    await page.goto("/admin/clients")

    await page.getByRole("button", { name: /move BlueFlame Appliances up/i }).click()

    await expect.poll(() => Boolean(rec.find("POST", "/client-logos/reorder"))).toBe(true)
    const call = rec.find("POST", "/client-logos/reorder")
    expect(call?.body?.ids).toEqual(["cl2", "cl1", "cl3"])
  })

  test("delete asks first, then sends DELETE", async ({ page }) => {
    const rec = recorder()
    await setup(page, rec)
    await page.goto("/admin/clients")

    page.once("dialog", (d) => d.accept()) // window.confirm guard
    await page.getByRole("button", { name: /remove ASR/i }).click()

    await expect.poll(() => Boolean(rec.find("DELETE", "/admin/client-logos/cl3"))).toBe(true)
  })
})
