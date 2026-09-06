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
    const name = url.split("/assets/")[1]
    // The web-vitals chunk is deferred behind afterFirstPaint (load + 1500ms
    // + idle) and a visitor never waits for it — but the boundary below is
    // "the nav is visible", and on a fast machine the idle callback
    // sometimes fires inside that window and sometimes does not. So the
    // total swung 1453 / 1455 KB across runs, 44 files or 45, and the budget
    // assertion flaked at exactly the value T3-6 had raised it to.
    //
    // Excluded rather than budgeted for. Counting a chunk that is on the
    // critical path in some runs and not others measures the machine, not
    // the payload; the 5.4 KB it contributes was never the thing the budget
    // is trying to hold down.
    if (/^web-vitals-/.test(name)) return
    try {
      assets.push({ name, kb: (await res.body()).length / 1024 })
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

    // 1451 KB measured. The history, because the direction matters more than
    // the number: 1683 before the fallback locale (-136) and gsap (-112) came
    // off the critical path, then 1446 after the `dashboard` namespace
    // (-40, T5-5) — 50 KB of JSON per language that no public page has ever
    // read, sitting on the homepage since it existed.
    //
    // RAISED 1450 → 1455 in T3-6 to cover the Web Vitals chunk, then put
    // back to 1452 in D3-3/D4-2 by excluding that chunk in collectAssets
    // instead — see the note there. It was never on the critical path; it
    // was only sometimes inside the measurement window, which is a
    // different thing. Net: three kilobytes tighter than it was found.
    //
    // RAISED 1452 → 1457 when MediaSlot landed, and the accounting matters
    // more than the number. The first build measured 1468 KB / 47 files: the
    // `ui/index.jsx` barrel was pulling MediaSlot.js, accent.js and Image.js
    // onto the HOMEPAGE, which renders none of them — Rollup cannot
    // tree-shake a barrel re-export once anything in the file is reached.
    // Importing those three from their own modules at the call sites took it
    // to 1454 KB / 46, recovering 14 of the 18.
    //
    // The remaining ~4 KB is real and is bought: `ProjectShowcase` IS on the
    // homepage (featured work), and its no-cover fallback is now on-brand
    // generative art instead of a grey grid icon. Only three case studies
    // have photo sets, so that was the common path, not the edge one.
    //
    // 1454 KB measured, stable across three runs.
    //
    // 1450.1 KB was the figure before this; 1450 was
    // tried first and missed by SIXTY BYTES — three i18n strings for the
    // splash and the session spinner (D4-2) land in the locale chunk, which
    // is on the critical path. Not worth chasing; worth writing down, so the
    // next person does not read 1452 as slack.
    //
    // The reported count wobbles between 43 and 44 files: `res.body()`
    // occasionally throws for an already-discarded response and that asset
    // is dropped, which can only make the total LOWER. The threshold is set
    // against the complete measurement.
    //
    // The history, because the
    // direction matters more than the number: 1683 before the fallback
    // locale (-136) and gsap (-112) came off the critical path, then 1446
    // after the `dashboard` namespace (-40, T5-5) — 50 KB of JSON per
    // language that no public page has ever read, sitting on the homepage
    // since it existed.
    //
    // Lower it as the remaining wins land. What is left, in order: 324 KB
    // CSS, 276 KB entry, 188 KB react-vendor, 150 KB vendor, and a 60 KB
    // bioService chunk that has no business on the homepage.
    expect(totalKb, `first paint fetched ${totalKb.toFixed(0)} KB across ${assets.length} files`).toBeLessThan(1457)
  })

  test("pdf.js is not on the critical path", async ({ page }) => {
    const assets = await collectAssets(page)
    // 327 KB, the largest chunk in the build, and needed only by the CV and
    // invoice viewers. It is correctly lazy today; this keeps it that way.
    expect(assets.filter((a) => /pdf/i.test(a.name)).map((a) => a.name)).toHaveLength(0)
  })
})
