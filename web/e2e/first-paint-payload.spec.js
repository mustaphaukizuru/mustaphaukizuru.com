// @ts-check
import { test, expect } from "@playwright/test"

/**
 * What the browser actually downloads for a first visit.
 *
 * This exists because reading the build output misled us twice, in opposite
 * directions. Summing the files in public/assets said 3.31 MB — but most of
 * those are lazy route chunks nobody fetches on the homepage. Reading
 * i18n/resources.js said the locales were already code-split — but a trace
 * showed BOTH being fetched anyway, because the fallback bundle was warmed
 * eagerly during init.
 *
 * Neither the file listing nor the source told the truth. Only the network
 * did, so the assertions below are network assertions.
 */

const BASE = "http://localhost:4173"

test.use({ baseURL: BASE })

/** Every /assets/ response the page pulled, with real transferred sizes. */
async function collectAssets(page, path = "/") {
  /** @type {{name: string, kb: number}[]} */
  const assets = []
  page.on("response", async (res) => {
    const url = res.url()
    if (!url.includes("/assets/")) return
    try {
      assets.push({ name: url.split("/assets/")[1], kb: (await res.body()).length / 1024 })
    } catch {
      /* response body already discarded — not an asset we can weigh */
    }
  })

  await page.route("**/api/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: [], items: [], posts: [], products: [], total: 0 }),
    })
  )

  // The boundary is FIRST RENDER — not `load`, not `networkidle`. Both of
  // the obvious choices measure the wrong thing here, and each was tried:
  //
  //   networkidle waits for 500ms of network silence, which is precisely the
  //   condition that lets a deferred idle callback run. It counts work that
  //   was deliberately moved off the critical path, and reports it as though
  //   it were on it.
  //
  //   `load` fires at ~470ms, before React has mounted — it misses the active
  //   locale bundle, which genuinely IS on the critical path.
  //
  // Waiting for the nav to be visible captures exactly what the browser
  // needed in order to show the page, which is the question being asked.
  await page.goto(path, { waitUntil: "load" })
  await page.getByRole("navigation").first().waitFor({ state: "visible", timeout: 15000 })
  return assets
}

test.describe("first-paint payload", () => {
  test("only the active locale is fetched, never both", async ({ page }) => {
    const assets = await collectAssets(page)
    const locales = assets.filter((a) => a.name.startsWith("locale-"))

    // The regression this guards: `fallbackLng` needs the fallback bundle
    // present, and warming it during init put a second 124-137 KB chunk on
    // the critical path. It is now warmed after the load event instead —
    // still fetched, just no longer competing with first paint — so exactly
    // one locale belongs in a trace taken at first render.
    expect(
      locales.map((l) => l.name),
      "both locale chunks were fetched during first paint — the fallback warm is back on the critical path"
    ).toHaveLength(1)
  })

  test("the first-paint payload stays under budget", async ({ page }) => {
    const assets = await collectAssets(page)
    const totalKb = assets.reduce((sum, a) => sum + a.kb, 0)

    // The budget sits just above the measured figure, not at a round number:
    // a ceiling with slack in it does not catch the thing it was set to
    // catch. Lower it as the remaining wins land (CSS is 325 KB, GSAP is
    // 112 KB); raise it only with a reason written down here.
    expect(totalKb, `first paint fetched ${totalKb.toFixed(0)} KB across ${assets.length} files`).toBeLessThan(1600)
  })

  test("pdf.js is not on the critical path", async ({ page }) => {
    const assets = await collectAssets(page)
    // 327 KB, the largest chunk in the build, and needed only by the CV and
    // invoice viewers. It is correctly lazy today; this keeps it that way.
    expect(assets.filter((a) => /pdf/i.test(a.name)).map((a) => a.name)).toHaveLength(0)
  })
})
