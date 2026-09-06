/**
 * Dark mode actually flips, and never leaks onto the public site (T3-2).
 *
 * The 66 `!important` rules this replaced were load-bearing by brute force:
 * each one restated a Tailwind utility at a specific opacity band. The
 * replacement redefines the brand VARIABLES those utilities resolve, which
 * is the same result by construction — but "by construction" is exactly the
 * kind of claim that needs a browser to confirm, because it depends on how
 * Tailwind v4 compiles an opacity variant and on the cascade between two
 * rules in the same layer.
 *
 * So these read getComputedStyle against the real compiled stylesheet, on a
 * subtree built to look like the dashboard. No login needed: the CSS does
 * not know or care which page it is on, only what attributes are above it.
 */
import { expect, test } from "@playwright/test"

/**
 * Build a dashboard-shaped subtree and read back what the browser computed.
 *
 * @returns {Promise<Record<string,string>>} class → computed value
 */
async function computeInShell(page, { theme, property, classes }) {
  return page.evaluate(({ theme, property, classes }) => {
    document.documentElement.setAttribute("data-theme", theme)
    const shell = document.createElement("div")
    shell.setAttribute("data-dashboard-shell", "")
    document.body.appendChild(shell)
    const out = {}
    for (const cls of classes) {
      const el = document.createElement("p")
      el.className = cls
      el.textContent = "x"
      shell.appendChild(el)
      out[cls] = getComputedStyle(el)[property]
    }
    shell.remove()
    return out
  }, { theme, property, classes })
}

/**
 * Perceptual lightness of a computed colour, 0 (black) to 1 (white).
 *
 * Two forms come back, and which one depends on how Tailwind compiled the
 * utility: a plain `rgb()` for the base class, and `oklab(L a b / alpha)`
 * for every opacity variant, because those are `color-mix(in oklab, …)`.
 * Asserting on an exact string would have meant asserting on that compiler
 * detail; what the eye cares about, and what this checks, is light text on
 * dark and dark text on light.
 */
function lightness(value) {
  const v = String(value)
  const oklab = v.match(/^oklab\(\s*([0-9.]+)/)
  if (oklab) return Number(oklab[1])
  const rgb = v.match(/^rgba?\(\s*([0-9.]+),\s*([0-9.]+),\s*([0-9.]+)/)
  if (!rgb) return NaN
  // sRGB relative luminance. Close enough to oklab's L for a light/dark
  // question, and this is only ever asked about greys.
  const [r, g, b] = rgb.slice(1, 4).map((n) => {
    const c = Number(n) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// The two greys this file ever asks about are Cloud Mist (oklab L 0.98) and
// Charcoal (0.22), so the midpoint separates them with room on both sides.
// A tighter threshold would fail on Charcoal at 0.2247 and prove nothing
// extra.
const isLight = (value) => lightness(value) > 0.5
const isDark = (value) => lightness(value) < 0.5

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")
})

test("every opacity band of charcoal text flips, not just the base one", async ({ page }) => {
  // The reason the old shim had twelve rules for this. One variable
  // redefinition has to cover all of them, INCLUDING a band nobody wrote a
  // rule for — which is the whole point of doing it this way.
  const bands = [
    "text-charcoal-80",
    "text-charcoal-80/35", "text-charcoal-80/45", "text-charcoal-80/55",
    "text-charcoal-80/65", "text-charcoal-80/70", "text-charcoal-80/90",
    // Never had a rule of its own under the old shim.
    "text-charcoal-80/25",
    "text-charcoal/60", "text-charcoal/80",
  ]
  const computed = await computeInShell(page, { theme: "dark", property: "color", classes: bands })
  const wrong = Object.entries(computed).filter(([, v]) => !isLight(v))
  expect(wrong).toEqual([])
})

test("the same classes stay dark in light mode", async ({ page }) => {
  // The flip must be scoped to the theme, not permanent.
  const computed = await computeInShell(page, {
    theme: "light",
    property: "color",
    classes: ["text-charcoal-80", "text-charcoal-80/65"],
  })
  const wrong = Object.entries(computed).filter(([, v]) => !isDark(v))
  expect(wrong).toEqual([])
})

test("borders and washes flip with the same variable", async ({ page }) => {
  const borders = await computeInShell(page, {
    theme: "dark",
    property: "borderTopColor",
    classes: ["border-charcoal-80/10", "border-charcoal-80/15", "border-charcoal/8"],
  })
  expect(Object.entries(borders).filter(([, v]) => !isLight(v))).toEqual([])

  const washes = await computeInShell(page, {
    theme: "dark",
    property: "backgroundColor",
    classes: ["bg-charcoal-80/5", "bg-charcoal-80/10"],
  })
  expect(Object.entries(washes).filter(([, v]) => !isLight(v))).toEqual([])
})

test("outside the dashboard shell, dark mode changes nothing", async ({ page }) => {
  // The public site is light-only by decision (docs/decisions/0008). The
  // flip is scoped by [data-dashboard-shell]; a leak here would repaint the
  // marketing site for anyone who once toggled the dashboard to dark.
  const computed = await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "dark")
    const el = document.createElement("p")
    el.className = "text-charcoal-80"
    document.body.appendChild(el)
    const color = getComputedStyle(el).color
    const body = getComputedStyle(document.body).backgroundColor
    el.remove()
    return { color, body }
  })
  expect(isDark(computed.color)).toBe(true)
  expect(isLight(computed.color)).toBe(false)
})

test("white cards flip but white button labels do not", async ({ page }) => {
  // The reason --color-white is NOT redefined: it is a card surface and a
  // button label at the same time.
  const surface = await computeInShell(page, {
    theme: "dark", property: "backgroundColor", classes: ["bg-white"],
  })
  expect(surface["bg-white"]).not.toBe("rgb(255, 255, 255)")

  const label = await computeInShell(page, {
    theme: "dark", property: "color", classes: ["text-white"],
  })
  expect(label["text-white"]).toBe("rgb(255, 255, 255)")
})

test("violet text uses the light variant on dark, per Brand v3 §04", async ({ page }) => {
  // Royal Violet on charcoal is 1.1:1.
  const computed = await computeInShell(page, {
    theme: "dark", property: "color", classes: ["text-violet", "text-violet-deep"],
  })
  for (const value of Object.values(computed)) {
    expect(value).toBe("rgb(139, 111, 232)")
  }
})

test("the theme is painted before the first stylesheet resolves", async ({ page, context }) => {
  // The flash this removes: useTheme applied data-theme in an effect, which
  // runs after the first paint, so a dark user got a full white frame on
  // every reload.
  //
  // "Before first paint" is a property of WHERE the script sits, so that is
  // what is asserted: in the head, ahead of every stylesheet link. A test
  // that only read the attribute afterwards would still pass if the script
  // were moved to the end of the body, which is precisely the regression
  // worth catching.
  const html = await (await page.request.get("/index.html")).text()
  const script = html.indexOf('getItem("theme")')
  const firstStylesheet = html.indexOf('rel="stylesheet"')
  const headEnd = html.indexOf("</head>")
  expect(script).toBeGreaterThan(-1)
  expect(script).toBeLessThan(headEnd)
  if (firstStylesheet > -1) expect(script).toBeLessThan(firstStylesheet)

  // And it actually runs.
  await context.addInitScript(() => {
    try { window.localStorage.setItem("theme", "dark") } catch { /* ignore */ }
  })
  await page.goto("/")
  expect(await page.getAttribute("html", "data-theme")).toBe("dark")
})

test("the blocking script and useTheme agree on the storage contract", async ({ page }) => {
  // Two copies of the same three decisions — the key, the values, and
  // "anything but an explicit dark is light". They are duplicated because
  // one has to run before any module loads; this is what keeps them honest.
  const html = await (await page.request.get("/index.html")).text()
  expect(html).toContain('window.localStorage.getItem("theme")')
  expect(html).toContain('t === "dark" ? "dark" : "light"')
  expect(html).toContain('setAttribute("data-theme"')
})

/* ══════════════════════════════════════════════════════════════════════════
   Anchor colours · the other half of T3-2
   ══════════════════════════════════════════════════════════════════════════ */

test("an anchor keeps its own colour utility, at its own opacity", async ({ page }) => {
  // Seven `!important` anchor patches used to live in index.css, added one
  // at a time as `a { color: inherit }` (unlayered, so it beat every layered
  // utility) swallowed one named class after another. Layering the reset
  // fixed the cause and made them redundant; two were worse than redundant,
  // forcing SOLID white on `text-white/60` so a footer link asking for muted
  // got prominent. All seven are gone — this is what says so.
  const computed = await page.evaluate(() => {
    const host = document.createElement("div")
    host.style.background = "#1A1B23"
    document.body.appendChild(host)
    const out = {}
    for (const cls of ["text-white", "text-white/60", "text-violet", "text-charcoal-80"]) {
      const a = document.createElement("a")
      a.href = "#"
      a.className = cls
      a.textContent = "link"
      host.appendChild(a)
      out[cls] = getComputedStyle(a).color
    }
    // No colour utility at all: still inherits, exactly as before.
    const plain = document.createElement("a")
    plain.href = "#"
    plain.textContent = "link"
    host.style.color = "rgb(1, 2, 3)"
    host.appendChild(plain)
    out.__inherited = getComputedStyle(plain).color
    host.remove()
    return out
  })

  expect(computed["text-white"]).toBe("rgb(255, 255, 255)")
  // The point: 60%, not 100%. Either an rgba or an oklab with alpha 0.6.
  expect(computed["text-white/60"]).not.toBe("rgb(255, 255, 255)")
  expect(String(computed["text-white/60"])).toMatch(/0\.6/)
  expect(computed["text-violet"]).toBe("rgb(93, 63, 211)")
  expect(computed.__inherited).toBe("rgb(1, 2, 3)")
})

test("an anchor-shaped primary button still has readable text", async ({ page }) => {
  // The bug the patches never covered: Button's primary variant sets
  // text-[var(--color-text-on-violet)], which no `a.text-*` patch matched,
  // so the same button rendered white as a <button> and near-black ink on
  // violet as a <Link> — 2.54:1, in the header of every page.
  const color = await page.evaluate(() => {
    const a = document.createElement("a")
    a.href = "#"
    a.className = "bg-violet text-[var(--color-text-on-violet)]"
    a.textContent = "Book a call"
    document.body.appendChild(a)
    const c = getComputedStyle(a).color
    a.remove()
    return c
  })
  // Whatever the token resolves to, it must not be the inherited body ink.
  expect(lightness(color)).toBeGreaterThan(0.8)
})
